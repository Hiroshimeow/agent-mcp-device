import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { deviceStatePaths } from './device-state.js';

export interface GatewayIdentityRecord {
    deviceId: string;
    publicKeyPem: string;
    privateKeyPem: string;
    enrolled: boolean;
}

export function deviceIdentityNeedsPairing(record: Pick<GatewayIdentityRecord, 'enrolled'>): boolean {
    return record.enrolled !== true;
}

function defaultIdentityPath(): string {
    const secureRoot = deviceStatePaths().root;
    const fallback = deviceStatePaths().identity;
    const configured = String(process.env.MCP_GATEWAY_DEVICE_IDENTITY_PATH || '').trim();
    if (!configured) return fallback;
    const resolved = path.resolve(configured);
    if (process.platform === 'win32') {
        const relative = path.relative(secureRoot, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error('MCP_GATEWAY_DEVICE_IDENTITY_PATH must stay inside ~/.mcp-device on Windows');
        }
    }
    return resolved;
}

function newDeviceId(): string {
    const host = os.hostname().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 54) || 'device';
    return `${host}-${randomUUID().slice(0, 8)}`;
}

function validateRecord(value: any): GatewayIdentityRecord {
    if (!value || typeof value !== 'object') throw new Error('Invalid gateway identity record');
    const deviceId = String(value.deviceId || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(deviceId)) throw new Error('Invalid persisted device ID');
    const publicKeyPem = String(value.publicKeyPem || '');
    const privateKeyPem = String(value.privateKeyPem || '');
    const publicKey = createPublicKey(publicKeyPem);
    const privateKey = createPrivateKey(privateKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519' || privateKey.asymmetricKeyType !== 'ed25519') {
        throw new Error('Gateway identity must use Ed25519 keys');
    }
    const normalizedPublic = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const derivedPublic = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
    if (normalizedPublic !== derivedPublic) throw new Error('Gateway identity private key does not match the stored public key');
    return { deviceId, publicKeyPem: normalizedPublic, privateKeyPem, enrolled: value.enrolled === true };
}

export class GatewayDeviceIdentity {
    readonly identityPath: string;
    private record?: GatewayIdentityRecord;
    constructor(identityPath = defaultIdentityPath(), _options: { platform?: NodeJS.Platform | string } = {}) {
        this.identityPath = identityPath;
    }

    async loadOrCreate(): Promise<GatewayIdentityRecord> {
        if (this.record) return { ...this.record };
        try {
            const parsed = JSON.parse(await fs.readFile(this.identityPath, 'utf8'));
            if (parsed?.privateKey?.scheme) {
                await this.archiveLegacyProtectedIdentity();
            } else {
                this.record = validateRecord(parsed);
                return { ...this.record };
            }
        } catch (error: any) {
            if (error?.code !== 'ENOENT') throw error;
        }

        const { publicKey, privateKey } = generateKeyPairSync('ed25519');
        this.record = validateRecord({
            deviceId: String(process.env.MCP_DEVICE_ID || '').trim() || newDeviceId(),
            publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
            privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
            enrolled: false
        });
        await this.persist();
        return { ...this.record };
    }

    async markEnrolled(): Promise<void> {
        const current = await this.loadOrCreate();
        if (current.enrolled) return;
        this.record = { ...current, enrolled: true };
        await this.persist();
    }

    async forget(): Promise<void> {
        this.record = undefined;
        await fs.rm(this.identityPath, { force: true });
    }

    async signChallenge(nonce: string): Promise<string> {
        const current = await this.loadOrCreate();
        const challenge = Buffer.from(`mcp-device-auth-v1\n${current.deviceId}\n${nonce}`, 'utf8');
        return sign(null, challenge, current.privateKeyPem).toString('base64');
    }

    async signChallengeV2(options: {
        mode: 'reconnect' | 'enroll' | 'pair';
        nonce: Buffer | string;
        exporter: Buffer | string;
        grant?: string | null;
    }): Promise<string> {
        const current = await this.loadOrCreate();
        const modeByte = { reconnect: 0, enroll: 1, pair: 2 }[options.mode];
        const nonce = Buffer.isBuffer(options.nonce) ? options.nonce : Buffer.from(String(options.nonce || ''), 'base64url');
        const exporter = Buffer.isBuffer(options.exporter) ? options.exporter : Buffer.from(String(options.exporter || ''), 'base64url');
        if (nonce.length !== 32) throw new Error('gateway nonce must be exactly 32 bytes.');
        if (exporter.length !== 32) throw new Error('TLS exporter must be exactly 32 bytes.');
        const deviceBytes = Buffer.from(current.deviceId, 'utf8');
        const deviceLength = Buffer.allocUnsafe(2);
        deviceLength.writeUInt16BE(deviceBytes.length, 0);
        const publicKeyDer = createPublicKey(current.publicKeyPem).export({ type: 'spki', format: 'der' });
        const grantDigest = options.mode === 'reconnect'
            ? Buffer.alloc(32)
            : createHash('sha256').update(String(options.grant || ''), 'utf8').digest();
        const challenge = Buffer.concat([
            Buffer.from('hcu-mcp-device-auth-v2\0', 'ascii'),
            Buffer.from([2, modeByte]),
            deviceLength,
            deviceBytes,
            nonce,
            exporter,
            createHash('sha256').update(publicKeyDer).digest(),
            grantDigest
        ]);
        return sign(null, challenge, current.privateKeyPem).toString('base64');
    }

    private async archiveLegacyProtectedIdentity(): Promise<void> {
        const archivePath = `${this.identityPath}.legacy-protected.${Date.now()}`;
        await fs.rename(this.identityPath, archivePath);
    }

    private async persist(): Promise<void> {
        if (!this.record) throw new Error('Gateway identity is not initialized');
        await this.persistSerialized(this.record);
    }

    private async persistSerialized(value: any): Promise<void> {
        await fs.mkdir(path.dirname(this.identityPath), { recursive: true });
        const temporary = `${this.identityPath}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
        await fs.rename(temporary, this.identityPath);
        try { await fs.chmod(this.identityPath, 0o600); } catch { /* Windows ACLs are inherited from the user profile. */ }
    }
}
