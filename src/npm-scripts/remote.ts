import os from 'os';

import { MCPDevice } from '../remote-device/device.js';
import { GatewayDeviceChannel } from '../remote-device/gateway-channel.js';
import { GatewayDeviceIdentity } from '../remote-device/gateway-identity.js';
import { pairGatewayDevice } from '../remote-device/gateway-pairing.js';
import { GatewayDeviceStatusStore, formatGatewayStatus, type GatewayDeviceStatus } from '../remote-device/device-status.js';
import { GatewayToolAdapter } from '../remote-device/gateway-tool-adapter.js';
import { WindowsDeviceService } from '../remote-device/windows-service.js';

function commandName(): string {
    const value = String(process.argv[3] || '').trim().toLowerCase();
    if (!value || value.startsWith('--')) return 'run';
    return value;
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

async function serviceStatus(status: GatewayDeviceStatus) {
    if (process.platform !== 'win32' || !status.deviceId) return { installed: false, running: false, taskName: null };
    return await new WindowsDeviceService().status(status.deviceId);
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
    console.log(formatGatewayStatus(status, { json, service: await serviceStatus(status) }));
}

async function login(): Promise<void> {
    const store = new GatewayDeviceStatusStore();
    const current = await store.load();
    const gatewayUrl = String(process.env.MCP_GATEWAY_URL || current.gatewayUrl || '').trim();
    if (!gatewayUrl) throw new Error('MCP_GATEWAY_URL is required for the first remote login.');
    const identity = new GatewayDeviceIdentity();
    const record = await identity.loadOrCreate();
    const pairing = await pairGatewayDevice({ gatewayUrl, identity, deviceName: os.hostname() });
    await store.update({
        gatewayUrl,
        deviceId: record.deviceId,
        deviceName: os.hostname(),
        identityPresent: true,
        account: { connected: false, label: pairing.account.label },
        connection: { ...current.connection, online: false }
    });
    const channel = new GatewayDeviceChannel({
        gatewayUrl,
        pairingGrant: pairing.enrollmentGrant,
        identity,
        adapter: controlAdapter(),
        agentVersion: process.env.npm_package_version,
        onStatus: async payload => { await persistGatewayPayload(store, gatewayUrl, identity, payload); }
    });
    try {
        await channel.start();
        const linked = await store.load();
        console.log(`Account connected: ${linked.account.label || 'gateway account'}`);
    } finally {
        await channel.stop().catch(() => {});
        await store.markOffline().catch(() => {});
    }
}

async function logout(): Promise<void> {
    const store = new GatewayDeviceStatusStore();
    const current = await store.load();
    const gatewayUrl = String(process.env.MCP_GATEWAY_URL || current.gatewayUrl || '').trim();
    if (!gatewayUrl || !current.identityPresent) throw new Error('No connected gateway identity is available to log out.');
    const identity = new GatewayDeviceIdentity();
    const channel = new GatewayDeviceChannel({
        gatewayUrl,
        identity,
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
        await store.markOffline().catch(() => {});
    }
}

async function serviceCommand(command: 'install' | 'start' | 'stop' | 'uninstall'): Promise<void> {
    if (process.platform !== 'win32') throw new Error('remote service lifecycle is currently supported on Windows only.');
    const store = new GatewayDeviceStatusStore();
    const status = await store.load();
    if (!status.deviceId || !status.identityPresent) throw new Error('Pair this device first with `remote login` or `remote`.');
    const service = new WindowsDeviceService();
    if (command === 'install') {
        const gatewayUrl = String(process.env.MCP_GATEWAY_URL || status.gatewayUrl || '').trim();
        const allowedRoots = String(process.env.MCP_GATEWAY_ALLOWED_ROOTS || '').trim();
        if (!gatewayUrl) throw new Error('Gateway URL is missing from status and MCP_GATEWAY_URL.');
        await service.install({ deviceId: status.deviceId, gatewayUrl, ...(allowedRoots ? { allowedRoots } : {}) });
        await service.start(status.deviceId);
        console.log(`Background device installed and started: ${status.deviceId}`);
        return;
    }
    if (command === 'start') {
        await service.start(status.deviceId);
        console.log(`Background device start requested: ${status.deviceId}`);
        return;
    }
    if (command === 'stop') {
        await service.stop(status.deviceId);
        await applyServiceCommandStatus(store, command);
        console.log(`Background device stop requested: ${status.deviceId}`);
        return;
    }
    await service.uninstall(status.deviceId);
    await applyServiceCommandStatus(store, command);
    console.log(`Background device uninstalled: ${status.deviceId}`);
}

export async function runRemote() {
    const persistSession = process.argv.includes('--persist-session');
    const disableNoSleep = process.argv.includes('--disable-no-sleep');
    const verbose = process.argv.includes('--debug');
    if (!verbose) console.debug = () => { };
    else console.debug('[DEBUG] Verbose mode:', verbose);

    const command = commandName();
    if (command === 'status') return await showStatus(process.argv.includes('--json'));
    if (command === 'login') return await login();
    if (command === 'logout') return await logout();
    if (command === 'install' || command === 'start' || command === 'stop' || command === 'uninstall') {
        return await serviceCommand(command);
    }
    if (command !== 'run') {
        throw new Error('Unknown remote command. Use remote, status, login, logout, install, start, stop, or uninstall.');
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

    const device = new MCPDevice({ persistSession });
    await device.start();
}
