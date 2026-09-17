import crypto from 'crypto';
import fs from 'fs/promises';
import net from 'net';
import os from 'os';
import path from 'path';

import { deviceStatePaths, type DeviceStatePaths, migrateLegacyDeviceState } from './device-state.js';

export type RuntimeMode = 'foreground' | 'windows' | 'systemd' | 'pm2' | 'bootstrap';

export interface RuntimeOwnerStatus {
    product: 'MCP Device';
    mode: RuntimeMode;
    pid: number;
    startedAt: number;
    executable: string;
    entrypoint: string;
    deviceId: string | null;
}

function endpointFor(paths: DeviceStatePaths, platform: NodeJS.Platform | string = process.platform): string {
    const digest = crypto.createHash('sha256').update(paths.root, 'utf8').digest('hex').slice(0, 24);
    if (platform === 'win32') return `\\\\.\\pipe\\mcp-device-${digest}`;
    return path.join(paths.root, `runtime-${digest}.sock`);
}

function controlFileFor(paths: DeviceStatePaths): string {
    return path.join(paths.root, 'runtime-control.json');
}

async function request(endpoint: string, message: Record<string, unknown>, timeoutMs = 800): Promise<any | null> {
    return await new Promise(resolve => {
        const socket = net.createConnection(endpoint);
        let data = '';
        const finish = (value: any | null) => {
            socket.destroy();
            resolve(value);
        };
        socket.setEncoding('utf8');
        socket.setTimeout(timeoutMs, () => finish(null));
        socket.once('error', () => finish(null));
        socket.on('data', chunk => { data += chunk; });
        socket.once('end', () => {
            try { finish(JSON.parse(data)); } catch { finish(null); }
        });
        socket.once('connect', () => socket.write(`${JSON.stringify(message)}\n`));
    });
}

export async function probeRuntimeOwner(paths = deviceStatePaths(), platform: NodeJS.Platform | string = process.platform): Promise<RuntimeOwnerStatus | null> {
    const response = await request(endpointFor(paths, platform), { action: 'status' });
    return response?.ok === true && response.status?.product === 'MCP Device' ? response.status as RuntimeOwnerStatus : null;
}

export class RuntimeOwner {
    readonly paths: DeviceStatePaths;
    readonly endpoint: string;
    readonly mode: RuntimeMode;
    private readonly platform: NodeJS.Platform | string;
    private readonly nonce: string;
    private readonly status: RuntimeOwnerStatus;
    private server?: net.Server;
    private onStop?: () => Promise<void> | void;

    constructor({
        paths = deviceStatePaths(),
        platform = process.platform,
        mode,
        onStop
    }: {
        paths?: DeviceStatePaths;
        platform?: NodeJS.Platform | string;
        mode: RuntimeMode;
        onStop?: () => Promise<void> | void;
    }) {
        this.paths = paths;
        this.platform = platform;
        this.endpoint = endpointFor(paths, platform);
        this.mode = mode;
        this.nonce = crypto.randomBytes(32).toString('base64url');
        this.onStop = onStop;
        this.status = {
            product: 'MCP Device',
            mode,
            pid: process.pid,
            startedAt: Date.now(),
            executable: path.resolve(process.execPath),
            entrypoint: path.resolve(process.argv[1] || process.execPath),
            deviceId: null
        };
    }

    async acquire(): Promise<void> {
        await fs.mkdir(this.paths.root, { recursive: true, mode: 0o700 });
        const existing = await probeRuntimeOwner(this.paths, this.platform);
        if (existing) throw new Error(`MCP Device runtime is already owned by PID ${existing.pid} (${existing.mode}).`);
        if (this.platform !== 'win32') {
            try { await fs.unlink(this.endpoint); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
        }
        this.server = net.createServer(socket => {
            socket.setEncoding('utf8');
            socket.on('error', () => {});
            let data = '';
            socket.on('data', async chunk => {
                data += chunk;
                const newline = data.indexOf('\n');
                if (newline < 0) return;
                const frame = data.slice(0, newline);
                data = data.slice(newline + 1);
                let message: any = null;
                try { message = JSON.parse(frame); } catch {}
                if (message?.action === 'status') {
                    socket.end(JSON.stringify({ ok: true, status: this.status }));
                    return;
                }
                if (message?.action === 'stop' && message?.nonce === this.nonce) {
                    socket.end(JSON.stringify({ ok: true }));
                    await this.onStop?.();
                    return;
                }
                socket.end(JSON.stringify({ ok: false }));
            });
        });
        await new Promise<void>((resolve, reject) => {
            this.server!.once('error', reject);
            this.server!.listen(this.endpoint, resolve);
        });
        await fs.writeFile(controlFileFor(this.paths), JSON.stringify({ endpoint: this.endpoint, nonce: this.nonce }, null, 2), { mode: 0o600 });
    }

    async bootstrap(): Promise<void> {
        await migrateLegacyDeviceState(this.paths);
    }

    setDeviceId(deviceId: string): void {
        this.status.deviceId = String(deviceId || '').trim() || null;
    }

    async release(): Promise<void> {
        if (this.server) {
            const server = this.server;
            this.server = undefined;
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
        try { await fs.unlink(controlFileFor(this.paths)); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
        if (this.platform !== 'win32') {
            try { await fs.unlink(this.endpoint); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
        }
    }
}

export async function stopRuntimeOwner(paths = deviceStatePaths(), platform: NodeJS.Platform | string = process.platform): Promise<boolean> {
    let control: any;
    try { control = JSON.parse(await fs.readFile(controlFileFor(paths), 'utf8')); } catch (error: any) {
        if (error?.code === 'ENOENT') return false;
        throw error;
    }
    if (String(control.endpoint || '') !== endpointFor(paths, platform) || !control.nonce) return false;
    const response = await request(String(control.endpoint), { action: 'stop', nonce: control.nonce }, 1500);
    return response?.ok === true;
}

export async function acquireRuntimeOwner(
    owner: RuntimeOwner,
    {
        confirmTakeover,
        waitMs = 5000,
        pollMs = 50
    }: {
        confirmTakeover?: (existing: RuntimeOwnerStatus) => Promise<boolean> | boolean;
        waitMs?: number;
        pollMs?: number;
    } = {}
): Promise<{ takenOver: boolean; previous: RuntimeOwnerStatus | null }> {
    const existing = await probeRuntimeOwner(owner.paths);
    if (!existing) {
        await owner.acquire();
        return { takenOver: false, previous: null };
    }
    if (existing.mode === 'bootstrap') {
        throw new Error(`MCP Device bootstrap is busy in PID ${existing.pid}; retry after it completes.`);
    }
    if (!confirmTakeover || !await confirmTakeover(existing)) {
        throw new Error(`MCP Device is already running in ${existing.mode} mode; takeover declined.`);
    }
    if (!await stopRuntimeOwner(owner.paths)) {
        throw new Error('MCP Device owner did not accept authenticated stop.');
    }
    const deadline = Date.now() + Math.max(1, waitMs);
    while (Date.now() < deadline) {
        if (!await probeRuntimeOwner(owner.paths)) {
            await owner.acquire();
            return { takenOver: true, previous: existing };
        }
        await new Promise(resolve => setTimeout(resolve, Math.max(1, pollMs)));
    }
    throw new Error(`MCP Device owner PID ${existing.pid} did not release runtime ownership.`);
}
