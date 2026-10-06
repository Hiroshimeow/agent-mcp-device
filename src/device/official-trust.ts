import { X509Certificate, createPublicKey, verify, type KeyObject } from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

import { GatewayDeviceConfigStore, type GatewayDeviceConfig } from './gateway-config.js';

export const OFFICIAL_GATEWAY_URL = 'https://device.hcu-lab.me';

// Sole compiled-in SOC trust anchor: no runtime/env/filesystem override.
// Fail-closed bootstrap pin; private key was not retained. An authenticated
// corporate SOC replacement requires a reviewed source/build change.
export const SOC_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAKhves7kRYVJvUh3S9nyZr7g3nhSuibxSz819C85ECfA=
-----END PUBLIC KEY-----`;

// SHA-256 over DER SPKI (not PEM formatting).
export const SOC_PUBLIC_KEY_SHA256 = '45fa563ffc94da59545a6f0956f00b3a14ba7a521d999ad124d93196d0d6a7c4';

/** Pure signature verification seam. The explicit key is for local tests only:
 * runtime authorization never supplies it and always uses the compiled pin.
 * This helper alone does not authorize execution or check revocation. */
export function verifyOfficialApproval(artifact: { expires_at: number; features: string[]; schema_version: number; signature: string }, testPublicKeyForTestingOnly?: KeyObject): boolean {
    try {
        const key = testPublicKeyForTestingOnly ?? createPublicKey(SOC_PUBLIC_KEY);
        const signature = Buffer.from(artifact.signature, 'base64');
        if (key.asymmetricKeyType !== 'ed25519' || signature.length !== 64 || signature.toString('base64') !== artifact.signature) return false;
        const payload = JSON.stringify({ expires_at: artifact.expires_at, features: artifact.features, schema_version: artifact.schema_version });
        return verify(null, Buffer.from(payload), key, signature);
    } catch { return false; }
}

function normalizedUrl(value: string): string {
    return new URL(value).toString();
}

function isOfficialGatewayHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    return host === 'hcu-lab.me' || host.endsWith('.hcu-lab.me');
}

function defaultOfficialCaPath(): string {
    return fileURLToPath(new URL('../data/official-app-ca.pem', import.meta.url));
}

export function isOfficialGatewayUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && isOfficialGatewayHost(url.hostname);
    } catch {
        return false;
    }
}

export async function bootstrapOfficialGatewayTrust(
    store: GatewayDeviceConfigStore,
    options: { gatewayUrl?: string | null; caPath?: string } = {}
): Promise<GatewayDeviceConfig> {
    const current = await store.load();
    const gatewayUrl = String(
        process.env.MCP_GATEWAY_URL || options.gatewayUrl || current.gatewayUrl || OFFICIAL_GATEWAY_URL
    ).trim();

    if (!isOfficialGatewayUrl(gatewayUrl)) {
        if (isOfficialGatewayUrl(current.gatewayUrl) && current.appCaPem) {
            return await store.update({ gatewayUrl, appCaPem: null });
        }
        return await store.update({ gatewayUrl });
    }
    if (current.appCaPem && current.securityProtocolFloor >= 2 && isOfficialGatewayUrl(current.gatewayUrl || gatewayUrl)) {
        if (current.gatewayUrl && normalizedUrl(current.gatewayUrl) === normalizedUrl(gatewayUrl)) return current;
        return await store.update({ gatewayUrl });
    }

    const caPath = options.caPath || defaultOfficialCaPath();
    let appCaPem: string;
    try {
        appCaPem = await fs.readFile(caPath, 'utf8');
        const certificate = new X509Certificate(appCaPem);
        if (!certificate.ca) throw new Error('certificate is not a CA');
    } catch (error: any) {
        throw new Error(`Official MCP Device application CA is not provisioned in this package; refusing network bootstrap: ${error?.message || error}`);
    }

    return await store.update({
        gatewayUrl,
        appCaPem,
        securityProtocolFloor: 2
    });
}
