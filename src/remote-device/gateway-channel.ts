import WebSocket from 'ws';

import { GatewayDeviceIdentity } from './gateway-identity.js';
import { GATEWAY_CAPABILITIES, GatewayToolAdapter } from './gateway-tool-adapter.js';

const PROTOCOL_VERSION = 1;
const HEARTBEAT_MS = 20_000;
const MAX_OUTBOUND_MESSAGE_BYTES = 56 * 1024;

function gatewaySocketUrl(raw: string): string {
    const url = new URL(raw);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('MCP_GATEWAY_URL must use http(s) or ws(s)');
    if (!url.pathname || url.pathname === '/') url.pathname = '/device';
    return url.toString();
}

export interface GatewayChannelOptions {
    gatewayUrl: string;
    enrollmentToken?: string;
    identity?: GatewayDeviceIdentity;
    adapter: GatewayToolAdapter;
    agentVersion?: string;
}

export class GatewayDeviceChannel {
    private socket?: WebSocket;
    private heartbeat?: NodeJS.Timeout;
    private shuttingDown = false;
    private identity: GatewayDeviceIdentity;
    private readyResolve?: () => void;
    private readyReject?: (error: Error) => void;
    private reconnectTimer?: NodeJS.Timeout;
    private reconnectAttempt = 0;

    constructor(private options: GatewayChannelOptions) {
        this.identity = options.identity || new GatewayDeviceIdentity();
    }

    async start(): Promise<void> {
        const record = await this.identity.loadOrCreate();
        const headers = !record.enrolled && this.options.enrollmentToken
            ? { authorization: `Bearer ${this.options.enrollmentToken}` }
            : undefined;
        const socket = new WebSocket(gatewaySocketUrl(this.options.gatewayUrl), { headers });
        this.socket = socket;
        const ready = new Promise<void>((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
        socket.once('open', () => this.sendHello().catch(error => this.fail(error)));
        socket.on('message', raw => this.handleMessage(raw.toString()).catch(error => this.fail(error)));
        socket.once('error', error => this.fail(error));
        socket.once('close', (code, reason) => {
            this.stopHeartbeat();
            if (!this.shuttingDown && this.readyReject) {
                this.fail(new Error(`Gateway connection closed (${code}): ${reason.toString()}`));
            } else if (!this.shuttingDown) {
                this.scheduleReconnect();
            }
        });
        await ready;
    }
    async stop(): Promise<void> {
        this.shuttingDown = true;
        this.stopHeartbeat();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        const socket = this.socket;
        this.socket = undefined;
        if (!socket || socket.readyState === WebSocket.CLOSED) return;
        await new Promise<void>(resolve => {
            const timer = setTimeout(() => {
                try { socket.terminate(); } catch {}
                resolve();
            }, 1500);
            socket.once('close', () => {
                clearTimeout(timer);
                resolve();
            });
            socket.close(1000, 'device shutdown');
        });
    }

    private async sendHello(): Promise<void> {
        const record = await this.identity.loadOrCreate();
        this.send({
            protocol_version: PROTOCOL_VERSION,
            type: record.enrolled ? 'auth_hello' : 'enroll_hello',
            device_id: record.deviceId,
            timestamp: Date.now(),
            payload: {
                agent_version: this.options.agentVersion || 'desktop-commander-gateway-1',
                capabilities: [...GATEWAY_CAPABILITIES],
                ...(record.enrolled ? {} : { public_key_pem: record.publicKeyPem })
            }
        });
    }

    private async handleMessage(raw: string): Promise<void> {
        const message = JSON.parse(raw);
        if (message?.protocol_version !== PROTOCOL_VERSION) throw new Error('Unsupported gateway protocol version');
        if (message.type === 'auth_challenge') {
            const nonce = String(message.payload?.nonce || '');
            if (!nonce) throw new Error('Gateway authentication challenge is missing a nonce');
            const record = await this.identity.loadOrCreate();
            this.send({
                protocol_version: PROTOCOL_VERSION,
                type: 'auth_response',
                device_id: record.deviceId,
                timestamp: Date.now(),
                payload: { signature: await this.identity.signChallenge(nonce) }
            });
            return;
        }
        if (message.type === 'auth_ok') {
            await this.identity.markEnrolled();
            this.startHeartbeat();
            this.reconnectAttempt = 0;
            this.readyResolve?.();
            this.readyResolve = undefined;
            this.readyReject = undefined;
            return;
        }
        if (message.type !== 'tool_call') return;
        await this.handleToolCall(message);
    }

    private async handleToolCall(message: any): Promise<void> {
        const requestId = String(message.request_id || '');
        const tool = String(message.payload?.tool || '');
        try {
            const result = await this.options.adapter.call(tool, message.payload?.arguments || {});
            this.send({
                protocol_version: PROTOCOL_VERSION,
                type: 'tool_result',
                request_id: requestId,
                device_id: message.device_id,
                connection_epoch: message.connection_epoch,
                timestamp: Date.now(),
                payload: result
            });
        } catch (error: any) {
            this.send({
                protocol_version: PROTOCOL_VERSION,
                type: 'tool_error',
                request_id: requestId,
                device_id: message.device_id,
                connection_epoch: message.connection_epoch,
                timestamp: Date.now(),
                payload: {
                    message: String(error?.message || error),
                    code: String(error?.code || 'REMOTE_DEVICE_ERROR').slice(0, 64)
                }
            });
        }
    }

    private scheduleReconnect(): void {
        if (this.shuttingDown || this.reconnectTimer) return;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt, 5));
        this.reconnectAttempt += 1;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            this.start().catch(() => this.scheduleReconnect());
        }, delay);
        this.reconnectTimer.unref?.();
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeat = setInterval(async () => {
            const record = await this.identity.loadOrCreate();
            this.send({
                protocol_version: PROTOCOL_VERSION,
                type: 'heartbeat',
                device_id: record.deviceId,
                timestamp: Date.now(),
                payload: {}
            });
        }, HEARTBEAT_MS);
        this.heartbeat.unref?.();
    }
    private stopHeartbeat(): void {
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = undefined;
    }

    private send(message: any): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('Gateway socket is not open');
        const encoded = JSON.stringify(message);
        if (Buffer.byteLength(encoded, 'utf8') > MAX_OUTBOUND_MESSAGE_BYTES) {
            const error: any = new Error('Gateway device response exceeds the outbound message limit');
            error.code = 'DEVICE_OUTPUT_TOO_LARGE';
            throw error;
        }
        this.socket.send(encoded);
    }

    private fail(error: Error): void {
        const reject = this.readyReject;
        this.readyResolve = undefined;
        this.readyReject = undefined;
        reject?.(error);
    }
}
