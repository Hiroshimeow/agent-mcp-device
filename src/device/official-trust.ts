import { X509Certificate } from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

import { GatewayDeviceConfigStore, type GatewayDeviceConfig } from './gateway-config.js';

export const OFFICIAL_GATEWAY_URL = 'https://mcp-v2.hcu-lab.me/mcp';

function normalizedUrl(value: string): string {
    return new URL(value).toString();
}

function defaultOfficialCaPath(): string {
    return fileURLToPath(new URL('../data/official-app-ca.pem', import.meta.url));
}

export function isOfficialGatewayUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    try { return normalizedUrl(value) === normalizedUrl(OFFICIAL_GATEWAY_URL); }
    catch { return false; }
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
        return current;
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
        gatewayUrl: OFFICIAL_GATEWAY_URL,
        appCaPem,
        securityProtocolFloor: 2
    });
}
