import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export interface GatewayIdentityRecord {
    deviceId: string;
    publicKeyPem: string;
    privateKeyPem: string;
    enrolled: boolean;
}

function defaultIdentityPath(): string {
    const home = path.resolve(os.homedir());
    const secureRoot = path.join(home, '.hcu-device');
    const fallback = path.join(secureRoot, 'gateway-identity.json');
    const configured = String(process.env.MCP_GATEWAY_DEVICE_IDENTITY_PATH || '').trim();
    if (!configured) return fallback;
    const resolved = path.resolve(configured);
    if (process.platform === 'win32') {
        const relative = path.relative(secureRoot, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error('MCP_GATEWAY_DEVICE_IDENTITY_PATH must stay inside ~/.hcu-device on Windows');
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
    return { deviceId, publicKeyPem, privateKeyPem, enrolled: value.enrolled === true };
}
export class GatewayDeviceIdentity {
    readonly identityPath: string;
    private record?: GatewayIdentityRecord;

    constructor(identityPath = defaultIdentityPath()) {
        this.identityPath = identityPath;
    }

    async loadOrCreate(): Promise<GatewayIdentityRecord> {
        if (this.record) return { ...this.record };
        try {
            const parsed = JSON.parse(await fs.readFile(this.identityPath, 'utf8'));
            this.record = validateRecord(parsed);
            return { ...this.record };
        } catch (error: any) {
            if (error?.code !== 'ENOENT') throw error;
        }

        const { publicKey, privateKey } = generateKeyPairSync('ed25519');
        this.record = {
            deviceId: String(process.env.MCP_DEVICE_ID || '').trim() || newDeviceId(),
            publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
            privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
            enrolled: false
        };
        await this.persist();
        return { ...this.record };
    }

    async markEnrolled(): Promise<void> {
        const current = await this.loadOrCreate();
        if (current.enrolled) return;
        this.record = { ...current, enrolled: true };
        await this.persist();
    }
    async signChallenge(nonce: string): Promise<string> {
        const current = await this.loadOrCreate();
        const challenge = Buffer.from(`mcp-device-auth-v1\n${current.deviceId}\n${nonce}`, 'utf8');
        return sign(null, challenge, current.privateKeyPem).toString('base64');
    }

    private async persist(): Promise<void> {
        if (!this.record) throw new Error('Gateway identity is not initialized');
        await fs.mkdir(path.dirname(this.identityPath), { recursive: true });
        const temporary = `${this.identityPath}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(temporary, JSON.stringify(this.record, null, 2), { mode: 0o600 });
        await fs.rename(temporary, this.identityPath);
        try { await fs.chmod(this.identityPath, 0o600); } catch { /* Windows ACLs are inherited from the user profile. */ }
    }
}
