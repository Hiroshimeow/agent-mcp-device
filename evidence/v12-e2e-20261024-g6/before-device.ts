#!/usr/bin/env node

import { fileURLToPath } from 'url';
import os from 'os';
import path from 'path';

import { LocalExecutionEngine } from './execution-engine.js';
import { GatewayDeviceChannel } from './gateway-channel.js';
import { GatewayDeviceConfigStore, createGatewayProxyAgent } from './gateway-config.js';
import { GatewayDeviceIdentity } from './gateway-identity.js';
import { pairGatewayDevice } from './gateway-pairing.js';
import { bootstrapOfficialGatewayTrust } from './official-trust.js';
import { GatewayDeviceStatusStore } from './device-status.js';
import { createPlatformDeviceCore as createDeviceCore, type PlatformDeviceCore as DeviceCore } from '../platform/device-runtime.js';
import { RuntimeOwner, acquireRuntimeOwner, type RuntimeOwnerStatus } from './runtime-owner.js';
import { acquireServerLease } from '../platform/runtime-lease.js';
import {
    assertDeviceStartupAllowedDuringUpdate,
    launchDeviceUpdateHelper,
    prepareDevicePackageUpdate,
    reconcileDeviceUpdateAfterStart,
    retireDeviceUpdateState,
    signalDeviceUpdateHandoff
} from './self-update.js';
import { captureRemote } from '../utils/capture.js';
import { VERSION } from '../version.js';

export class MCPDevice {
    private isShuttingDown = false;
    private shutdownRequest?: Promise<void>;
    private core?: DeviceCore;
    private unsubscribeCapabilities?: () => void;
    private executionEngine = new LocalExecutionEngine();
    private gatewayChannel?: GatewayDeviceChannel;
    private gatewayProxyAgent?: { destroy: () => void };
    private runtimeOwner?: RuntimeOwner;
    private stateLeases: Array<() => Promise<void>> = [];

    constructor() {
        this.setupShutdownHandlers();
    }

    private setupShutdownHandlers() {
        const handleShutdown = async (signal: string) => {
            console.log(this.isShuttingDown
                ? `\n${signal} received, waiting for owned resources to stop...`
                : `\n${signal} received, initiating graceful shutdown...`);
            const shutdownWarning = setTimeout(() => {
                console.error('\n⚠️ Graceful shutdown is still waiting for owned resources; runtime ownership is retained.');
                process.exitCode = 1;
            }, 5000);

            try {
                await this.shutdown();
                process.exit(0);
            } catch (error) {
                console.error('Error during shutdown:', error);
                await captureRemote('remote_device_shutdown_handler_error', { error }).catch(() => {});
                // Exiting here would make the PID lease stale while a plugin
                // may still own its files. Keep the owner available for retry.
                process.exitCode = 1;
            } finally {
                clearTimeout(shutdownWarning);
            }
        };

        process.on('SIGINT', () => {
            handleShutdown('SIGINT').catch((error) => {
                console.error('Fatal error during shutdown:', error);
                captureRemote('remote_device_shutdown_handler_error', { error, signal: 'SIGINT' }).catch(() => {});
                process.exitCode = 1;
            });
        });

        process.on('SIGTERM', () => {
            handleShutdown('SIGTERM').catch((error) => {
                console.error('Fatal error during shutdown:', error);
                captureRemote('remote_device_shutdown_handler_error', { error, signal: 'SIGTERM' }).catch(() => {});
                process.exitCode = 1;
            });
        });
    }

    async start(options: { confirmTakeover?: (existing: RuntimeOwnerStatus) => Promise<boolean> | boolean } = {}) {
        try {
            console.log('🚀 Starting MCP Device...');
            if (process.env.DEBUG_MODE === 'true') console.log('  - 🐞 DEBUG_MODE');

            // A fresh external update helper owns the package lifecycle.
            // Refuse a competing runtime until it completes or becomes stale.
            await assertDeviceStartupAllowedDuringUpdate(VERSION);

            const managerArg = process.argv.find(value => value.startsWith('--manager='));
            const manager = managerArg?.slice('--manager='.length);
            const mode = process.argv.includes('--service')
                ? (process.platform === 'win32' ? 'windows' : manager === 'pm2' ? 'pm2' : 'systemd')
                : 'foreground';
            this.runtimeOwner = new RuntimeOwner({ mode, onStop: () => this.shutdown() });
            await acquireRuntimeOwner(this.runtimeOwner, { confirmTakeover: options.confirmTakeover });
            const { CONFIG_DIR } = await import('../config.js');
            const stateRoots = new Map<string, string>();
            for (const root of [this.runtimeOwner.paths.root, CONFIG_DIR]) {
                const absolute = path.resolve(root);
                stateRoots.set(process.platform === 'win32' ? absolute.toLowerCase() : absolute, absolute);
            }
            for (const [, root] of [...stateRoots].sort(([a], [b]) => a.localeCompare(b))) {
                this.stateLeases.push(await acquireServerLease(root, { allowDeviceOwnerPid: process.pid }));
            }
            await this.runtimeOwner.bootstrap();
            await bootstrapOfficialGatewayTrust(new GatewayDeviceConfigStore());
            // Remote mode uses direct in-process dispatch (tool-dispatcher.ts).
            // Do not eagerly initialize LocalExecutionEngine, avoiding child dist/index.js process spawn.

            const gatewayStatus = new GatewayDeviceStatusStore();
            const storedGatewayStatus = await gatewayStatus.load();
            const gatewayConfig = await new GatewayDeviceConfigStore().load();
            const gatewayUrl = String(gatewayConfig.gatewayUrl || storedGatewayStatus.gatewayUrl || '').trim();
            if (!gatewayUrl) throw new Error('Gateway configuration is missing. Run `mcp-device login` or `mcp-device install` first.');
            if (gatewayConfig.securityProtocolFloor >= 2 && !gatewayConfig.appCaPem) {
                throw new Error('Gateway security protocol floor requires a provisioned application CA.');
            }
            const proxy = createGatewayProxyAgent(gatewayConfig);
            this.gatewayProxyAgent = proxy.agent;

            process.env.MCP_DEVICE_REMOTE = 'true';
            console.log(`⏳ Connecting directly to MCP Device server ${gatewayUrl}`);

            const identity = new GatewayDeviceIdentity();
            const identityRecord = await identity.loadOrCreate();
            this.runtimeOwner.setDeviceId(identityRecord.deviceId);
            // Local providers start before pairing; local indexing needs no account session.
            this.core = await createDeviceCore({
                deviceId: identityRecord.deviceId,
                allowedRoots: gatewayConfig.allowedRoots
            });
            const enrollmentCredential = String(
                process.env.MCP_GATEWAY_ENROLLMENT_TOKEN || process.env.MCP_DEVICE_ENROLLMENT_TOKEN || ''
            ).trim() || undefined;
            let pairingGrant: string | undefined;

            if (!identityRecord.enrolled && !enrollmentCredential) {
                const pairing = await pairGatewayDevice({ gatewayUrl, identity, proxyAgent: proxy.agent, deviceName: os.hostname() });
                pairingGrant = pairing.enrollmentGrant;
                await gatewayStatus.update({
                    gatewayUrl,
                    deviceId: identityRecord.deviceId,
                    deviceName: os.hostname(),
                    identityPresent: true,
                    account: { connected: false, label: pairing.account.label },
                    connection: { ...storedGatewayStatus.connection, online: false }
                });
                console.log(`✓ Authorized account: ${pairing.account.label || 'connected'}`);
            }

            this.gatewayChannel = new GatewayDeviceChannel({
                gatewayUrl,
                enrollmentToken: enrollmentCredential,
                pairingGrant,
                identity,
                proxyAgent: proxy.agent,
                securityProtocolFloor: gatewayConfig.securityProtocolFloor,
                appCaPem: gatewayConfig.appCaPem || undefined,
                adapter: { call: (tool, args) => this.core!.invoke(tool, args) },
                capabilities: () => this.core?.capabilities ?? [],
                // In remote direct-dispatch mode, the daemon is ready once the gateway channel & dispatch are established.
                runtimeState: () => ({
                    runtime_ready: true,
                    runtime_reason: null,
                    execution_runtime_generation: this.core!.runtimeInstanceId
                }),
                agentVersion: VERSION || process.env.npm_package_version || '1.0.11',
                onUpdateRequest: async (targetVersion, { requestId }) => {
                    const record = await identity.loadOrCreate();
                    const prepared = await prepareDevicePackageUpdate({
                        targetVersion,
                        requestId,
                        deviceId: record.deviceId,
                        childPid: this.executionEngine.getChildPid(),
                        fromVersion: VERSION
                    });
                    try {
                        // Launch the helper while the service is healthy. The
                        // helper remains inert until the explicit handoff marker.
                        await launchDeviceUpdateHelper(prepared);
                    } catch (error) {
                        await retireDeviceUpdateState(prepared.state).catch(() => {});
                        throw error;
                    }
                    return {
                        mode: 'detached' as const,
                        handoff: async () => {
                            // Capture the last live child PID, then complete graceful
                            // shutdown and RuntimeOwner release before arming the helper.
                            // This preserves G5.6: no destructive update work may begin
                            // until the old runtime has finished releasing package handles.
                            const childPid = this.executionEngine.getChildPid();
                            await this.shutdown();
                            await signalDeviceUpdateHandoff({ childPid });
                            process.exit(0);
                        }
                    };
                },
                onStatus: async payload => {
                    const record = await identity.loadOrCreate();
                    await gatewayStatus.update({
                        gatewayUrl,
                        deviceId: record.deviceId,
                        deviceName: payload?.device?.name || os.hostname(),
                        identityPresent: true,
                        account: payload?.account || storedGatewayStatus.account,
                        connection: {
                            online: payload?.device?.online !== false,
                            connectionEpoch: payload?.device?.connectionEpoch ?? null,
                            lastConnectedAt: payload?.device?.connectedAt || Date.now()
                        },
                        usage: payload?.usage || null,
                        schema: payload?.schema || null,
                        usageFreshAt: Date.now()
                    });
                }
            });

            this.unsubscribeCapabilities = this.core.onCapabilitiesChanged?.(() => {
                this.gatewayChannel?.updateCapabilities();
            });
            await this.gatewayChannel.start();

            const updateReconciliation = await reconcileDeviceUpdateAfterStart(VERSION);
            if (updateReconciliation.action === 'success') {
                // Successful reconnect already advertised the target package_version
                // in auth_hello; that reconnect is the authoritative completion proof.
                // Do not send a late "installed" status: the gateway completes the
                // update from the authenticated reconnect itself.
                try {
                    await retireDeviceUpdateState(updateReconciliation.state);
                } catch (error: any) {
                    // A transient Windows EPERM/EBUSY while the detached helper is
                    // exiting must not turn a healthy target reconnect into startup failure.
                    console.warn('Update cleanup deferred:', error?.message || error);
                }
            } else if (updateReconciliation.action === 'report-failed') {
                try {
                    await this.gatewayChannel.reportUpdateFailure(
                        updateReconciliation.state.requestId,
                        updateReconciliation.state.targetVersion,
                        updateReconciliation.state.errorCode || 'DEVICE_UPDATE_FAILED',
                        updateReconciliation.state.message || 'MCP Device update rolled back.'
                    );
                    await retireDeviceUpdateState(updateReconciliation.state).catch((error: any) => {
                        console.warn('Failed update cleanup deferred:', error?.message || error);
                    });
                } catch (error: any) {
                    // Keep durable failed state for a later reporting attempt; do not
                    // make the restored runtime unavailable because reporting raced.
                    console.warn('Failed update report deferred:', error?.message || error);
                }
            }

            console.log('✓ Device ready through direct Gateway channel');
        } catch (error: any) {
            console.error(' - ❌ Device startup failed:', error.message);
            if (error.stack && process.env.DEBUG_MODE === 'true') console.error('Stack trace:', error.stack);
            await captureRemote('remote_device_startup_failed', { error });
            await this.shutdown();
            process.exit(1);
        }
    }

    shutdown(): Promise<void> {
        if (this.shutdownRequest) return this.shutdownRequest;
        this.isShuttingDown = true;
        const request = this.performShutdown();
        this.shutdownRequest = request;
        // Concurrent callers share the same outcome. A rejected cleanup keeps
        // ownership and resources available for a real retry; only success is cached.
        void request.catch(() => {
            if (this.shutdownRequest === request) this.shutdownRequest = undefined;
        });
        return request;
    }

    private async performShutdown(): Promise<void> {
        console.log('\n🛑 Shutting down device...');
        try {
            try {
                this.unsubscribeCapabilities?.();
                this.unsubscribeCapabilities = undefined;
                if (this.gatewayChannel) {
                    console.log('  → Closing direct Gateway channel...');
                    await this.gatewayChannel.stop();
                    this.gatewayChannel = undefined;
                }
                if (this.gatewayProxyAgent) {
                    this.gatewayProxyAgent.destroy();
                    this.gatewayProxyAgent = undefined;
                }
                await new GatewayDeviceStatusStore().markOffline().catch(() => {});
            } finally {
                // Release shared state only after the same Core and its plugins
                // have stopped, including failures partway through startup.
                await this.core?.close();
                this.core = undefined;
                await this.executionEngine.shutdown();
                while (this.stateLeases.length) {
                    await this.stateLeases[this.stateLeases.length - 1]();
                    this.stateLeases.pop();
                }
                if (this.runtimeOwner) {
                    await this.runtimeOwner.release();
                    this.runtimeOwner = undefined;
                }
            }
            console.log('✓ Device shutdown complete');
        } catch (error: any) {
            console.error('Shutdown error:', error.message);
            await captureRemote('remote_device_shutdown_error', { error }).catch(() => {});
            throw error;
        }
    }
}

// Start only when this module itself is the entrypoint. Package/bin execution goes
// through src/mcp-device.ts -> src/index.ts, which owns the single device lifecycle.
export function isModuleEntrypoint(moduleUrl: string, argvEntry?: string, pmExecPath?: string): boolean {
    const moduleEntryPath = path.resolve(fileURLToPath(moduleUrl));
    const candidates = [argvEntry, pmExecPath]
        .map(value => value ? path.resolve(value) : '')
        .filter(Boolean);
    return candidates.some(candidate => process.platform === 'win32'
        ? moduleEntryPath.toLowerCase() === candidate.toLowerCase()
        : moduleEntryPath === candidate);
}

const isMainModule = isModuleEntrypoint(import.meta.url, process.argv[1], process.env.pm_exec_path);
if (isMainModule) {
    const device = new MCPDevice();
    device.start();
}