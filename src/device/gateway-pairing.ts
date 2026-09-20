import { createHash, randomBytes } from 'crypto';
import type { Agent } from 'http';
import { createRequire } from 'module';
import os from 'os';
import fetch from 'cross-fetch';

import { GatewayDeviceIdentity } from './gateway-identity.js';
import { gatewayHttpBase } from './gateway-url-policy.js';

const CLIENT_ID = 'mcp-device';
const SCOPE = 'mcp:tools';
const require = createRequire(import.meta.url);

type AccountStatus = { connected: boolean; label: string | null };

export interface GatewayPairingResult {
    enrollmentGrant: string;
    deviceId: string;
    account: AccountStatus;
}

export interface GatewayPairingOptions {
    gatewayUrl: string;
    identity: GatewayDeviceIdentity;
    deviceName?: string;
    fetchFn?: typeof fetch;
    proxyAgent?: Agent;
    /** @deprecated Pairing is intentionally terminal-only; this hook is ignored. */
    openBrowser?: (url: string) => Promise<unknown>;
    renderQr?: (value: string) => void;
    sleep?: (ms: number) => Promise<void>;
    log?: (value: string) => void;
}

interface DeviceStartResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval: number;
}

function pkce(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

function defaultQrRenderer(value: string): void {
    const qr = require('qrcode-terminal') as { generate: (text: string, options?: { small?: boolean }, callback?: (output: string) => void) => void };
    qr.generate(value, { small: true }, output => process.stdout.write(`${output}\n`));
}

async function jsonResponse(response: Response): Promise<any> {
    let payload: any = null;
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok) {
        const code = String(payload?.error || `http_${response.status}`);
        const error: any = new Error(String(payload?.error_description || code));
        error.code = code;
        error.status = response.status;
        throw error;
    }
    return payload;
}

export async function pairGatewayDevice(options: GatewayPairingOptions): Promise<GatewayPairingResult> {
    const baseUrl = gatewayHttpBase(options.gatewayUrl);
    const fetchFn = options.fetchFn || fetch;
    const renderQr = options.renderQr || defaultQrRenderer;
    const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const log = options.log || (value => console.log(value));
    const identity = await options.identity.loadOrCreate();
    const verifier = pkce();
    const deviceName = String(options.deviceName || os.hostname() || identity.deviceId).trim().slice(0, 128) || identity.deviceId;

    const start = await jsonResponse(await fetchFn(`${baseUrl}/device/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        ...(options.proxyAgent ? { agent: options.proxyAgent } : {}),
        body: JSON.stringify({
            client_id: CLIENT_ID,
            scope: SCOPE,
            device_id: identity.deviceId,
            device_name: deviceName,
            public_key_pem: identity.publicKeyPem,
            code_challenge: verifier.challenge,
            code_challenge_method: 'S256'
        })
    })) as DeviceStartResponse;

    const verificationUrl = String(start.verification_uri_complete || start.verification_uri || '').trim();
    if (!verificationUrl || !start.device_code || !start.user_code) throw new Error('Gateway returned an incomplete device pairing response.');

    log(`Gateway: ${baseUrl}`);
    log(`Pair this device: ${verificationUrl}`);
    log(`Code: ${start.user_code}`);
    renderQr(verificationUrl);

    const intervalMs = Math.max(1000, Math.min(30_000, Number(start.interval || 2) * 1000));
    const deadline = Date.now() + Math.max(1, Number(start.expires_in || 600)) * 1000;
    while (Date.now() < deadline) {
        try {
            const payload = await jsonResponse(await fetchFn(`${baseUrl}/device/poll`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                ...(options.proxyAgent ? { agent: options.proxyAgent } : {}),
                body: JSON.stringify({
                    device_code: start.device_code,
                    client_id: CLIENT_ID,
                    code_verifier: verifier.verifier
                })
            }));
            const enrollmentGrant = String(payload?.enrollment_grant || '').trim();
            const deviceId = String(payload?.device_id || identity.deviceId).trim();
            if (!enrollmentGrant) throw new Error('Gateway approval did not return an enrollment grant.');
            if (deviceId !== identity.deviceId) throw new Error('Gateway pairing response device_id mismatch.');
            return {
                enrollmentGrant,
                deviceId,
                account: {
                    connected: payload?.account?.connected === true,
                    label: payload?.account?.label ? String(payload.account.label) : null
                }
            };
        } catch (error: any) {
            if (error?.code !== 'authorization_pending') throw error;
            await sleep(intervalMs);
        }
    }
    throw new Error('Device pairing code expired before approval.');
}
