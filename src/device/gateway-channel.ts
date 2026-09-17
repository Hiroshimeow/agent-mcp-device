import type { Agent } from 'http';
import os from 'os';
import type tls from 'tls';
import WebSocket from 'ws';

import { GatewayDeviceIdentity } from './gateway-identity.js';
import {
    DEVICE_INNER_TLS_SUBPROTOCOL,
    createClientInnerTls,
    createJsonFrameParser,
    encodeJsonFrame,
    exportDeviceAuthKeyingMaterial
} from './gateway-secure-transport.js';
import { GATEWAY_CAPABILITIES, GatewayToolAdapter } from './gateway-tool-adapter.js';
import { gatewaySocketUrl } from './gateway-url-policy.js';

const PROTOCOL_VERSION = 1;
const PROTOCOL_VERSION_V2 = 2;
const HEARTBEAT_MS = 20_000;
const MAX_OUTBOUND_MESSAGE_BYTES = 56 * 1024;

export interface GatewayChannelOptions {
    gatewayUrl: string;
    enrollmentToken?: string;
    pairingGrant?: string;
    identity?: GatewayDeviceIdentity;
    proxyAgent?: Agent;
    securityProtocolFloor?: number;
    appCaPem?: string;
    adapter: GatewayToolAdapter;
    agentVersion?: string;
    onStatus?: (payload: any) => void | Promise<void>;
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
    private authenticatedDeviceId?: string;
    private connectionEpoch?: string | number;
    private accountLogoutResolve?: (payload: any) => void;
    private accountLogoutReject?: (error: Error) => void;
    private messageQueue: Promise<void> = Promise.resolve();
    private protocolVersion = PROTOCOL_VERSION;
    private secureSocket?: tls.TLSSocket;
    private authMode: 'reconnect' | 'enroll' | 'pair' = 'reconnect';

    constructor(private options: GatewayChannelOptions) {
        this.identity = options.identity || new GatewayDeviceIdentity();
    }

    async start(): Promise<void> {
        this.authenticatedDeviceId = undefined;
        this.connectionEpoch = undefined;
        this.messageQueue = Promise.resolve();
        const record = await this.identity.loadOrCreate();
        this.protocolVersion = Number(this.options.securityProtocolFloor || 1) >= 2 ? PROTOCOL_VERSION_V2 : PROTOCOL_VERSION;
        if (this.protocolVersion === PROTOCOL_VERSION_V2 && !String(this.options.appCaPem || '').trim()) {
            throw new Error('Protocol v2 requires a provisioned gateway application CA.');
        }
        const credential = this.options.pairingGrant || (!record.enrolled ? this.options.enrollmentToken : undefined);
        const webSocketOptions = this.options.proxyAgent ? { agent: this.options.proxyAgent } : {};
        const socket = this.protocolVersion === PROTOCOL_VERSION_V2
            ? new WebSocket(gatewaySocketUrl(this.options.gatewayUrl), DEVICE_INNER_TLS_SUBPROTOCOL, webSocketOptions)
            : new WebSocket(gatewaySocketUrl(this.options.gatewayUrl), {
                ...(credential ? { headers: { authorization: `Bearer ${credential}` } } : {}),
                ...webSocketOptions
            });
        this.socket = socket;
        const ready = new Promise<void>((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
        if (this.protocolVersion === PROTOCOL_VERSION_V2) {
            socket.once('open', () => this.startV2Transport().catch(error => this.fail(error)));
        } else {
            socket.once('open', () => this.sendHello().catch(error => this.fail(error)));
            socket.on('message', raw => {
                this.messageQueue = this.messageQueue
                    .then(() => this.handleMessage(raw.toString()))
                    .catch(error => this.fail(error));
            });
        }
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

    private async startV2Transport(): Promise<void> {
        const socket = this.socket;
        if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('Gateway socket is not open');
        if (socket.protocol !== DEVICE_INNER_TLS_SUBPROTOCOL) {
            throw new Error('Gateway did not negotiate the required v2 inner TLS subprotocol.');
        }
        const url = new URL(gatewaySocketUrl(this.options.gatewayUrl));
        const secure = createClientInnerTls(socket, {
            ca: String(this.options.appCaPem || ''),
            servername: url.hostname
        });
        this.secureSocket = secure;
        const parser = createJsonFrameParser({
            onMessage: message => {
                this.messageQueue = this.messageQueue
                    .then(() => this.handleMessage(message))
                    .catch(error => this.fail(error));
            }
        });
        secure.on('data', chunk => {
            try { parser.push(chunk); }
            catch (error: any) { this.fail(error instanceof Error ? error : new Error(String(error))); }
        });
        secure.once('error', error => this.fail(error));
        await new Promise<void>((resolve, reject) => {
            secure.once('secureConnect', resolve);
            secure.once('error', reject);
        });
        await this.sendHelloV2();
    }

    async stop(): Promise<void> {
        this.shuttingDown = true;
        this.stopHeartbeat();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        const secure = this.secureSocket;
        this.secureSocket = undefined;
        if (secure && !secure.destroyed) secure.destroy();
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
        const pairing = record.enrolled && Boolean(this.options.pairingGrant);
        const enrolling = !record.enrolled && Boolean(this.options.pairingGrant || this.options.enrollmentToken);
        this.send({
            protocol_version: PROTOCOL_VERSION,
            type: pairing ? 'pair_hello' : enrolling ? 'enroll_hello' : 'auth_hello',
            device_id: record.deviceId,
            timestamp: Date.now(),
            payload: {
                agent_version: this.options.agentVersion || 'mcp-device-1',
                hostname: os.hostname(),
                platform: process.platform,
                arch: process.arch,
                path_style: process.platform === 'win32' ? 'windows' : 'posix',
                capabilities: [...GATEWAY_CAPABILITIES],
                ...(enrolling || pairing ? { public_key_pem: record.publicKeyPem } : {})
            }
        });
    }

    private async sendHelloV2(): Promise<void> {
        const record = await this.identity.loadOrCreate();
        const pairing = record.enrolled && Boolean(this.options.pairingGrant);
        const enrolling = !record.enrolled && Boolean(this.options.pairingGrant || this.options.enrollmentToken);
        this.authMode = pairing ? 'pair' : enrolling ? 'enroll' : 'reconnect';
        const grant = pairing || enrolling ? String(this.options.pairingGrant || this.options.enrollmentToken || '') : '';
        this.send({
            protocol_version: PROTOCOL_VERSION_V2,
            type: pairing ? 'pair_hello' : enrolling ? 'enroll_hello' : 'auth_hello',
            device_id: record.deviceId,
            timestamp: Date.now(),
            payload: {
                agent_version: this.options.agentVersion || 'mcp-device-1',
                hostname: os.hostname(),
                platform: process.platform,
                arch: process.arch,
                path_style: process.platform === 'win32' ? 'windows' : 'posix',
                capabilities: [...GATEWAY_CAPABILITIES],
                ...(pairing || enrolling ? { public_key_pem: record.publicKeyPem, enrollment_grant: grant } : {})
            }
        });
    }

    private async handleMessage(raw: string | any): Promise<void> {
        const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (message?.protocol_version !== this.protocolVersion) throw new Error('Unsupported gateway protocol version');
        if (['auth_challenge', 'auth_ok', 'tool_call'].includes(String(message?.type || ''))) {
            const record = await this.identity.loadOrCreate();
            if (String(message?.device_id || '') !== record.deviceId) throw new Error('Gateway message device_id mismatch');
        }
        if (message.type === 'auth_challenge') {
            const nonce = String(message.payload?.nonce || '');
            if (!nonce) throw new Error('Gateway authentication challenge is missing a nonce');
            const record = await this.identity.loadOrCreate();
            if (this.protocolVersion === PROTOCOL_VERSION_V2) {
                const mode = String(message.payload?.mode || '');
                if (mode !== this.authMode) throw new Error('Gateway authentication challenge mode mismatch');
                const nonceBytes = Buffer.from(nonce, 'base64url');
                if (nonceBytes.length !== 32) throw new Error('Gateway v2 authentication challenge nonce must be exactly 32 bytes');
                if (!this.secureSocket) throw new Error('Gateway v2 inner TLS socket is unavailable');
                const exporter = exportDeviceAuthKeyingMaterial(this.secureSocket, record.deviceId, this.authMode);
                const grant = this.authMode === 'reconnect' ? null : String(this.options.pairingGrant || this.options.enrollmentToken || '');
                this.send({
                    protocol_version: PROTOCOL_VERSION_V2,
                    type: 'auth_response',
                    device_id: record.deviceId,
                    timestamp: Date.now(),
                    payload: {
                        signature: await this.identity.signChallengeV2({ mode: this.authMode, nonce: nonceBytes, exporter, grant })
                    }
                });
                return;
            }
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
            if (message.connection_epoch === undefined || message.connection_epoch === null || String(message.connection_epoch).trim() === '') throw new Error('Gateway auth_ok is missing connection_epoch');
            const record = await this.identity.loadOrCreate();
            this.authenticatedDeviceId = record.deviceId;
            this.connectionEpoch = message.connection_epoch;
            await this.identity.markEnrolled();
            this.options.pairingGrant = undefined;
            if (this.options.onStatus && message.payload) await this.options.onStatus(message.payload);
            this.startHeartbeat();
            this.reconnectAttempt = 0;
            this.readyResolve?.();
            this.readyResolve = undefined;
            this.readyReject = undefined;
            return;
        }
        if (message.type === 'status_snapshot') {
            if (this.connectionEpoch === undefined || this.authenticatedDeviceId === undefined) return;
            if (String(message.connection_epoch) !== String(this.connectionEpoch)) return;
            if (this.options.onStatus && message.payload) await this.options.onStatus(message.payload);
            if (message.payload?.account?.connected === false && this.accountLogoutResolve) {
                this.accountLogoutResolve(message.payload);
                this.accountLogoutResolve = undefined;
                this.accountLogoutReject = undefined;
            }
            return;
        }
        if (message.type !== 'tool_call') return;
        if (this.connectionEpoch === undefined || this.authenticatedDeviceId === undefined) throw new Error('Gateway tool_call arrived before authentication');
        if (String(message.connection_epoch) !== String(this.connectionEpoch)) throw new Error('Gateway tool_call connection_epoch mismatch');
        await this.handleToolCall(message);
    }

    async logoutAccount(timeoutMs = 5000): Promise<any> {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.connectionEpoch === undefined || !this.authenticatedDeviceId) {
            throw new Error('Gateway device is not authenticated.');
        }
        if (this.accountLogoutResolve) throw new Error('Account logout is already pending.');
        const result = new Promise<any>((resolve, reject) => {
            this.accountLogoutResolve = resolve;
            this.accountLogoutReject = reject;
        });
        this.send({
            protocol_version: this.protocolVersion,
            type: 'account_logout',
            device_id: this.authenticatedDeviceId,
            connection_epoch: this.connectionEpoch,
            timestamp: Date.now(),
            payload: {}
        });
        const timer = setTimeout(() => {
            if (!this.accountLogoutReject) return;
            const reject = this.accountLogoutReject;
            this.accountLogoutResolve = undefined;
            this.accountLogoutReject = undefined;
            reject(new Error('Timed out waiting for account logout status.'));
        }, timeoutMs);
        try { return await result; }
        finally { clearTimeout(timer); }
    }

    private async handleToolCall(message: any): Promise<void> {
        if (this.connectionEpoch === undefined || !this.authenticatedDeviceId) throw new Error('Gateway tool_call arrived before authentication');
        const requestId = String(message.request_id || '');
        const tool = String(message.payload?.tool || '');
        try {
            const result = await this.options.adapter.call(tool, message.payload?.arguments || {});
            this.send({
                protocol_version: this.protocolVersion,
                type: 'tool_result',
                request_id: requestId,
                device_id: this.authenticatedDeviceId,
                connection_epoch: this.connectionEpoch,
                timestamp: Date.now(),
                payload: result
            });
        } catch (error: any) {
            this.send({
                protocol_version: this.protocolVersion,
                type: 'tool_error',
                request_id: requestId,
                device_id: this.authenticatedDeviceId,
                connection_epoch: this.connectionEpoch,
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
                protocol_version: this.protocolVersion,
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
        if (this.protocolVersion === PROTOCOL_VERSION_V2) {
            if (!this.secureSocket || this.secureSocket.destroyed) throw new Error('Gateway v2 inner TLS socket is not open');
            this.secureSocket.write(encodeJsonFrame(message));
            return;
        }
        this.socket.send(encoded);
    }

    private fail(error: Error): void {
        const reject = this.readyReject;
        this.readyResolve = undefined;
        this.readyReject = undefined;
        if (reject) {
            reject(error);
            return;
        }
        const socket = this.socket;
        if (socket && socket.readyState !== WebSocket.CLOSED) {
            try { socket.terminate(); } catch {}
        }
    }
}
