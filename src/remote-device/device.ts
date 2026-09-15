#!/usr/bin/env node

import { fileURLToPath } from 'url';
import os from 'os';
import path from 'path';

import { DesktopCommanderIntegration } from './desktop-commander-integration.js';
import { GatewayDeviceChannel } from './gateway-channel.js';
import { GatewayDeviceIdentity } from './gateway-identity.js';
import { pairGatewayDevice } from './gateway-pairing.js';
import { GatewayDeviceStatusStore } from './device-status.js';
import { GatewayToolAdapter } from './gateway-tool-adapter.js';
import { captureRemote } from '../utils/capture.js';

export class MCPDevice {
    private isShuttingDown = false;
    private desktop = new DesktopCommanderIntegration();
    private gatewayChannel?: GatewayDeviceChannel;

    constructor() {
        this.setupShutdownHandlers();
    }

    private setupShutdownHandlers() {
        const handleShutdown = async (signal: string) => {
            if (this.isShuttingDown) {
                console.log(`\n${signal} received, but already shutting down...`);
                process.exit(1);
                return;
            }

            console.log(`\n${signal} received, initiating graceful shutdown...`);
            const forceExit = setTimeout(() => {
                console.error('\n⚠️ Graceful shutdown timed out, forcing exit...');
                process.exit(1);
            }, 5000);

            try {
                await this.shutdown();
                clearTimeout(forceExit);
                process.exit(0);
            } catch (error) {
                console.error('Error during shutdown:', error);
                await captureRemote('remote_device_shutdown_handler_error', { error });
                process.exit(1);
            }
        };

        process.on('SIGINT', () => {
            handleShutdown('SIGINT').catch((error) => {
                console.error('Fatal error during shutdown:', error);
                captureRemote('remote_device_shutdown_handler_error', { error, signal: 'SIGINT' }).catch(() => {});
                process.exit(1);
            });
        });

        process.on('SIGTERM', () => {
            handleShutdown('SIGTERM').catch((error) => {
                console.error('Fatal error during shutdown:', error);
                captureRemote('remote_device_shutdown_handler_error', { error, signal: 'SIGTERM' }).catch(() => {});
                process.exit(1);
            });
        });
    }

    async start() {
        try {
            console.log('🚀 Starting HCU Device...');
            if (process.env.DEBUG_MODE === 'true') console.log('  - 🐞 DEBUG_MODE');

            await this.desktop.initialize();

            const gatewayStatus = new GatewayDeviceStatusStore();
            const storedGatewayStatus = await gatewayStatus.load();
            const gatewayUrl = String(process.env.MCP_GATEWAY_URL || storedGatewayStatus.gatewayUrl || '').trim();
            if (!gatewayUrl) throw new Error('MCP_GATEWAY_URL is required for the first HCU device connection.');

            process.env.DC_REMOTE_DEVICE = 'true';
            console.log(`⏳ Connecting directly to MCP Gateway ${gatewayUrl}`);

            const identity = new GatewayDeviceIdentity();
            const identityRecord = await identity.loadOrCreate();
            const enrollmentCredential = String(
                process.env.MCP_GATEWAY_ENROLLMENT_TOKEN || process.env.MCP_DEVICE_ENROLLMENT_TOKEN || ''
            ).trim() || undefined;
            let pairingGrant: string | undefined;

            if (!identityRecord.enrolled && !enrollmentCredential) {
                const pairing = await pairGatewayDevice({ gatewayUrl, identity, deviceName: os.hostname() });
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
                adapter: new GatewayToolAdapter(this.desktop),
                agentVersion: process.env.npm_package_version,
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

            await this.gatewayChannel.start();
            console.log('✓ Device ready through direct Gateway channel');
        } catch (error: any) {
            console.error(' - ❌ Device startup failed:', error.message);
            if (error.stack && process.env.DEBUG_MODE === 'true') console.error('Stack trace:', error.stack);
            await captureRemote('remote_device_startup_failed', { error });
            await this.shutdown();
            process.exit(1);
        }
    }

    async shutdown() {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        console.log('\n🛑 Shutting down device...');
        try {
            if (this.gatewayChannel) {
                console.log('  → Closing direct Gateway channel...');
                await this.gatewayChannel.stop();
                this.gatewayChannel = undefined;
            }
            await new GatewayDeviceStatusStore().markOffline().catch(() => {});
            await this.desktop.shutdown();
            console.log('✓ Device shutdown complete');
        } catch (error: any) {
            console.error('Shutdown error:', error.message);
            await captureRemote('remote_device_shutdown_error', { error });
        }
    }
}

// Start only when this module itself is the entrypoint. Package/bin execution goes
// through src/hcu-device.ts -> src/index.ts, which owns the single device lifecycle.
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
