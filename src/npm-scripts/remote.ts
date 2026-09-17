import os from 'os';
import readline from 'readline/promises';

import { MCPDevice } from '../device/device.js';
import { GatewayDeviceChannel } from '../device/gateway-channel.js';
import { GatewayDeviceConfigStore, captureGatewayConfigFromEnvironment, createGatewayProxyAgent } from '../device/gateway-config.js';
import { GatewayDeviceIdentity, deviceIdentityNeedsPairing } from '../device/gateway-identity.js';
import { pairGatewayDevice } from '../device/gateway-pairing.js';
import { bootstrapOfficialGatewayTrust } from '../device/official-trust.js';
import { GatewayDeviceStatusStore, effectiveGatewayStatus, formatGatewayStatus, type GatewayDeviceStatus } from '../device/device-status.js';
import { GatewayToolAdapter } from '../device/gateway-tool-adapter.js';
import { chooseLinuxManager, discoverLinuxManagers, Pm2DeviceService, SystemdUserDeviceService } from '../device/linux-service.js';
import { RuntimeOwner, acquireRuntimeOwner, probeRuntimeOwner, stopRuntimeOwner, type RuntimeOwnerStatus } from '../device/runtime-owner.js';
import { WindowsDeviceService } from '../device/windows-service.js';

function commandName(): string {
    const value = String(process.argv[3] || '').trim().toLowerCase();
    if (['help', '-h', '--help'].includes(value)) return 'help';
    if (!value || value.startsWith('--')) return 'start';
    return value;
}

function printRemoteUsage(): void {
    console.log([
        'Usage: mcp-device [command]',
        '',
        'Commands: start, login, logout, status, install, stop, uninstall'
    ].join('\n'));
}

async function persistGatewayPayload(
    store: GatewayDeviceStatusStore,
    gatewayUrl: string,
    identity: GatewayDeviceIdentity,
    payload: any
): Promise<GatewayDeviceStatus> {
    const record = await identity.loadOrCreate();
    const current = await store.load();
    return await store.update({
        gatewayUrl,
        deviceId: record.deviceId,
        deviceName: payload?.device?.name || current.deviceName || os.hostname(),
        identityPresent: true,
        account: payload?.account || current.account,
        connection: {
            online: payload?.device?.online !== false,
            connectionEpoch: payload?.device?.connectionEpoch ?? current.connection.connectionEpoch,
            lastConnectedAt: payload?.device?.connectedAt || Date.now()
        },
        usage: payload?.usage ?? current.usage,
        schema: payload?.schema ?? current.schema,
        usageFreshAt: Date.now()
    });
}

function controlAdapter(): GatewayToolAdapter {
    return { async call() { throw new Error('Tool calls are disabled for this control-only connection.'); } } as unknown as GatewayToolAdapter;
}

async function lifecycleSnapshot(status: GatewayDeviceStatus) {
    const owner = await probeRuntimeOwner();
    if (process.platform === 'win32' && status.deviceId) {
        const service = await new WindowsDeviceService().status(status.deviceId);
        const managers = service.installed ? [{
            manager: service.registration === 'task' ? 'windows-task' : service.registration === 'run' ? 'windows-run' : 'windows-manual',
            installed: service.installed,
            running: service.running,
            autostart: service.autostart
        }] : [];
        return { owner, service, managers };
    }
    if (process.platform === 'linux') {
        const managers = await discoverLinuxManagers();
        const installed = managers.some(manager => manager.installed);
        const running = managers.some(manager => manager.running);
        const autostart = managers.some(manager => manager.autostart);
        return { owner, service: { installed, running, autostart }, managers };
    }
    return { owner, service: { installed: false, running: false, autostart: false }, managers: [] };
}

async function confirmRuntimeTakeover(existing: RuntimeOwnerStatus): Promise<boolean> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await rl.question(`MCP Device is running in ${existing.mode} mode (PID ${existing.pid}). Stop it and take over? [Y/n] `);
        return !['n', 'no'].includes(String(answer || '').trim().toLowerCase());
    } finally {
        rl.close();
    }
}

export async function applyServiceCommandStatus(
    store: GatewayDeviceStatusStore,
    command: 'install' | 'start' | 'stop' | 'uninstall'
): Promise<void> {
    if (command === 'stop' || command === 'uninstall') await store.markOffline();
}

async function showStatus(json: boolean): Promise<void> {
    const store = new GatewayDeviceStatusStore();
    const status = await store.load();
    const config = await new GatewayDeviceConfigStore().load();
    const lifecycle = await lifecycleSnapshot(status);
    const effectiveStatus = effectiveGatewayStatus(status, { runtimeOwned: Boolean(lifecycle.owner), serviceRunning: lifecycle.service.running });
    console.log(formatGatewayStatus(effectiveStatus, {
        json,
        service: lifecycle.service,
        runtime: lifecycle.owner ? { mode: lifecycle.owner.mode, pid: lifecycle.owner.pid } : null,
        managers: lifecycle.managers,
        security: { protocolFloor: config.securityProtocolFloor, appCaProvisioned: Boolean(config.appCaPem) },
        proxy: { mode: config.proxy.mode }
    }));
}

async function withBootstrapOwner<T>(action: () => Promise<T>, allowTakeover = true): Promise<T> {
    const owner = new RuntimeOwner({ mode: 'bootstrap' });
    await acquireRuntimeOwner(owner, { confirmTakeover: allowTakeover ? confirmRuntimeTakeover : undefined });
    try {
        await owner.bootstrap();
        await bootstrapOfficialGatewayTrust(new GatewayDeviceConfigStore());
        return await action();
    } finally {
        await owner.release();
    }
}

async function ensureLinkedDeviceUnderOwner(forcePair = false): Promise<{ deviceId: string; accountLabel: string | null }> {
    const store = new GatewayDeviceStatusStore();
    const current = await store.load();
    const config = await captureGatewayConfigFromEnvironment(new GatewayDeviceConfigStore(), { fallbackGatewayUrl: current.gatewayUrl });
    const gatewayUrl = String(config.gatewayUrl || '').trim();
    const identity = new GatewayDeviceIdentity();
    const record = await identity.loadOrCreate();
    await store.update({
        gatewayUrl,
        deviceId: record.deviceId,
        deviceName: current.deviceName || os.hostname(),
        identityPresent: true
    });
    if (!forcePair && !deviceIdentityNeedsPairing(record)) {
        return { deviceId: record.deviceId, accountLabel: current.account.label };
    }

    const proxy = createGatewayProxyAgent(config);
    let channel: GatewayDeviceChannel | undefined;
    try {
        const pairing = await pairGatewayDevice({ gatewayUrl, identity, proxyAgent: proxy.agent, deviceName: os.hostname() });
        await store.update({
            gatewayUrl,
            deviceId: record.deviceId,
            deviceName: os.hostname(),
            identityPresent: true,
            account: { connected: false, label: pairing.account.label },
            connection: { ...current.connection, online: false }
        });
        channel = new GatewayDeviceChannel({
            gatewayUrl,
            pairingGrant: pairing.enrollmentGrant,
            identity,
            proxyAgent: proxy.agent,
            securityProtocolFloor: config.securityProtocolFloor,
            appCaPem: config.appCaPem || undefined,
            adapter: controlAdapter(),
            agentVersion: process.env.npm_package_version,
            onStatus: async payload => { await persistGatewayPayload(store, gatewayUrl, identity, payload); }
        });
        await channel.start();
        const linked = await store.load();
        return { deviceId: record.deviceId, accountLabel: linked.account.label };
    } finally {
        await channel?.stop().catch(() => {});
        proxy.agent.destroy();
        await store.markOffline().catch(() => {});
    }
}

async function login(): Promise<void> {
    return await withBootstrapOwner(async () => {
        const linked = await ensureLinkedDeviceUnderOwner(true);
        console.log(`Account connected: ${linked.accountLabel || 'gateway account'}`);
    });
}

async function logout(): Promise<void> {
    return await withBootstrapOwner(async () => {
    const store = new GatewayDeviceStatusStore();
    const current = await store.load();
    const config = await new GatewayDeviceConfigStore().load();
    const gatewayUrl = String(config.gatewayUrl || current.gatewayUrl || '').trim();
    if (!gatewayUrl || !current.identityPresent) throw new Error('No connected gateway identity is available to log out.');
    const proxy = createGatewayProxyAgent(config);
    const identity = new GatewayDeviceIdentity();
    const channel = new GatewayDeviceChannel({
        gatewayUrl,
        identity,
        proxyAgent: proxy.agent,
        securityProtocolFloor: config.securityProtocolFloor,
        appCaPem: config.appCaPem || undefined,
        adapter: controlAdapter(),
        agentVersion: process.env.npm_package_version,
        onStatus: async payload => { await persistGatewayPayload(store, gatewayUrl, identity, payload); }
    });
    try {
        await channel.start();
        await channel.logoutAccount();
        console.log('Account disconnected from this device.');
    } finally {
        await channel.stop().catch(() => {});
        proxy.agent.destroy();
        await store.markOffline().catch(() => {});
    }
    });
}

async function waitForOwnerRelease(timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!await probeRuntimeOwner()) return;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('MCP Device runtime did not release ownership after authenticated stop.');
}

async function serviceCommand(command: 'install' | 'stop' | 'uninstall'): Promise<void> {
    const store = new GatewayDeviceStatusStore();
    const owner = await probeRuntimeOwner();
    if ((command === 'stop' || command === 'uninstall') && owner) {
        if (!await stopRuntimeOwner()) throw new Error('MCP Device runtime did not accept authenticated stop.');
        await waitForOwnerRelease();
        await store.markOffline();
        if (command === 'stop') {
            console.log('MCP Device stop requested.');
            return;
        }
    }

    if (!['win32', 'linux'].includes(process.platform)) {
        throw new Error('Background lifecycle is currently supported on Windows and Linux only.');
    }

    if (command === 'install') {
        const linuxManager = process.platform === 'linux' ? await chooseLinuxManager() : null;
        const deviceId = await withBootstrapOwner(async () => {
            const linked = await ensureLinkedDeviceUnderOwner(false);
            if (process.platform === 'win32') await new WindowsDeviceService().install({ deviceId: linked.deviceId });
            else if (linuxManager === 'pm2') await new Pm2DeviceService().install();
            else await new SystemdUserDeviceService().install();
            return linked.deviceId;
        });
        if (process.platform === 'win32') await new WindowsDeviceService().start(deviceId);
        console.log(`Background device installed and started: ${deviceId}`);
        return;
    }

    if (command === 'stop') {
        const status = await store.load();
        if (process.platform === 'win32') {
            if (!status.deviceId || !status.identityPresent) throw new Error('No installed MCP Device identity was found.');
            await new WindowsDeviceService().stop(status.deviceId);
        } else {
            const systemd = new SystemdUserDeviceService();
            const pm2 = new Pm2DeviceService();
            if ((await systemd.status()).installed) await systemd.stop();
            if ((await pm2.status()).installed) await pm2.stop();
        }
        await applyServiceCommandStatus(store, command);
        console.log('MCP Device background runtime stop requested.');
        return;
    }

    await withBootstrapOwner(async () => {
        const status = await store.load();
        if (process.platform === 'win32') {
            if (!status.deviceId || !status.identityPresent) throw new Error('No installed MCP Device identity was found.');
            await new WindowsDeviceService().uninstall(status.deviceId);
        } else {
            await new SystemdUserDeviceService().uninstall();
            await new Pm2DeviceService().uninstall();
        }
        await applyServiceCommandStatus(store, command);
    }, false);
    console.log('MCP Device background registration removed; identity and account state were preserved.');
}

export async function runRemote() {
    // MCP Device owns its account-scoped usage telemetry at the gateway.
    // Never send inherited Desktop Commander analytics from the remote execution path.
    process.env.DESKTOP_COMMANDER_DISABLE_TELEMETRY = 'true';

    const disableNoSleep = process.argv.includes('--disable-no-sleep');
    const verbose = process.argv.includes('--debug');
    if (!verbose) console.debug = () => { };
    else console.debug('[DEBUG] Verbose mode:', verbose);

    const command = commandName();
    if (command === 'help') return printRemoteUsage();
    if (command === 'status') return await showStatus(process.argv.includes('--json'));
    if (command === 'login') return await login();
    if (command === 'logout') return await logout();
    if (command === 'install' || command === 'stop' || command === 'uninstall') {
        return await serviceCommand(command);
    }
    if (command !== 'start') {
        throw new Error('Unknown MCP Device command. Use start, status, login, logout, install, stop, or uninstall.');
    }

    if (!disableNoSleep && os.platform() === 'darwin') {
        try {
            const { default: caffeinate } = await import('caffeinate');
            caffeinate({ pid: process.pid });
            console.log('No sleep mode enabled');
        } catch (error) {
            console.warn('Failed to start caffeinate:', error);
        }
    }

    const device = new MCPDevice();
    await device.start({ confirmTakeover: process.argv.includes('--service') ? undefined : confirmRuntimeTakeover });
}
