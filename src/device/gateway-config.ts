import { X509Certificate } from 'crypto';
import fs from 'fs/promises';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { ProxyAgent } from 'proxy-agent';

import { deviceStatePaths } from './device-state.js';

const require = createRequire(import.meta.url);
const { getProxyForUrl } = require('proxy-from-env') as { getProxyForUrl: (url: string | URL) => string };
const PROXY_ENV_NAMES = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'all_proxy'] as const;

export interface GatewayProxyConfig {
    mode: 'direct' | 'configured';
    url: string | null;
}

export interface GatewayDeviceConfig {
    version: 1;
    gatewayUrl: string | null;
    allowedRoots: string[];
    proxy: GatewayProxyConfig;
    appCaPem: string | null;
    securityProtocolFloor: number;
}

function defaultConfigPath(): string {
    return deviceStatePaths().config;
}

function emptyConfig(): GatewayDeviceConfig {
    return {
        version: 1,
        gatewayUrl: null,
        allowedRoots: [],
        proxy: { mode: 'direct', url: null },
        appCaPem: null,
        securityProtocolFloor: 1
    };
}

function normalizeGatewayUrl(value: unknown): string | null {
    const text = String(value || '').trim();
    if (!text) return null;
    const parsed = new URL(text);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) throw new Error('Gateway URL must use http(s) or ws(s).');
    return parsed.toString();
}

function normalizeAllowedRoots(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
}

function normalizeAppCa(value: unknown): string | null {
    const text = String(value || '').trim();
    if (!text) return null;
    new X509Certificate(text);
    return `${text}\n`;
}

function normalizedProxy(value: any): GatewayProxyConfig {
    if (!value || value.mode === 'direct') return { mode: 'direct', url: null };
    if (value.mode !== 'configured') throw new Error('Invalid persisted gateway proxy mode.');
    const url = String(value.url || '').trim();
    if (!url) throw new Error('Configured gateway proxy URL is missing.');
    const parsed = new URL(url);
    if (!['http:', 'https:', 'socks:', 'socks4:', 'socks5:'].includes(parsed.protocol)) {
        throw new Error('Unsupported gateway proxy URL scheme.');
    }
    return { mode: 'configured', url: parsed.toString() };
}

function normalizeFloor(value: unknown): number {
    const parsed = Math.trunc(Number(value) || 1);
    return Math.max(1, parsed);
}

export class GatewayDeviceConfigStore {
    readonly configPath: string;
    constructor(configPath = defaultConfigPath(), _options: { platform?: NodeJS.Platform | string } = {}) {
        this.configPath = path.resolve(configPath);
    }

    async load(): Promise<GatewayDeviceConfig> {
        let parsed: any;
        try {
            parsed = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
        } catch (error: any) {
            if (error?.code === 'ENOENT') return emptyConfig();
            throw error;
        }
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid gateway config record.');
        if (parsed.proxy?.mode === 'configured' && parsed.proxy?.protected) {
            throw new Error('Legacy protected proxy configuration is unsupported in MCP Device 1.0.2+. Re-run `mcp-device login` with your proxy environment configured.');
        }
        const proxy = normalizedProxy(parsed.proxy);
        const appCaPem = normalizeAppCa(parsed.appCaPem);
        const requestedFloor = normalizeFloor(parsed.securityProtocolFloor);
        return {
            version: 1,
            gatewayUrl: normalizeGatewayUrl(parsed.gatewayUrl),
            allowedRoots: normalizeAllowedRoots(parsed.allowedRoots),
            proxy,
            appCaPem,
            securityProtocolFloor: Math.max(requestedFloor, appCaPem ? 2 : 1)
        };
    }

    async update(patch: Partial<GatewayDeviceConfig>): Promise<GatewayDeviceConfig> {
        const current = await this.load();
        const appCaPem = patch.appCaPem === undefined ? current.appCaPem : normalizeAppCa(patch.appCaPem);
        const requestedFloor = patch.securityProtocolFloor === undefined
            ? current.securityProtocolFloor
            : normalizeFloor(patch.securityProtocolFloor);
        const next: GatewayDeviceConfig = {
            version: 1,
            gatewayUrl: patch.gatewayUrl === undefined ? current.gatewayUrl : normalizeGatewayUrl(patch.gatewayUrl),
            allowedRoots: patch.allowedRoots === undefined ? current.allowedRoots : normalizeAllowedRoots(patch.allowedRoots),
            proxy: patch.proxy === undefined ? current.proxy : normalizedProxy(patch.proxy),
            appCaPem,
            securityProtocolFloor: Math.max(current.securityProtocolFloor, requestedFloor, appCaPem ? 2 : 1)
        };
        await this.persist(next);
        return next;
    }

    private async persist(config: GatewayDeviceConfig): Promise<void> {
        const proxy: any = config.proxy.mode === 'configured' && config.proxy.url
            ? { mode: 'configured', url: config.proxy.url }
            : { mode: 'direct' };
        const persisted = {
            version: 1,
            gatewayUrl: config.gatewayUrl,
            allowedRoots: config.allowedRoots,
            proxy,
            appCaPem: config.appCaPem,
            securityProtocolFloor: config.securityProtocolFloor
        };
        await fs.mkdir(path.dirname(this.configPath), { recursive: true });
        const temporary = `${this.configPath}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(temporary, JSON.stringify(persisted, null, 2), { mode: 0o600 });
        await fs.rename(temporary, this.configPath);
        try { await fs.chmod(this.configPath, 0o600); } catch { /* Windows ACLs inherit from the profile. */ }
    }
}

function proxyResolutionUrl(raw: string): string {
    const url = new URL(raw);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString();
}

export function resolveProxyDecisionFromEnvironment(gatewayUrl: string): { explicit: boolean; proxyUrl: string | null } {
    const explicit = PROXY_ENV_NAMES.some(name => process.env[name] !== undefined);
    if (!explicit) return { explicit: false, proxyUrl: null };
    const resolved = String(getProxyForUrl(proxyResolutionUrl(gatewayUrl)) || '').trim();
    return { explicit: true, proxyUrl: resolved || null };
}

function parseAllowedRootsEnvironment(value: string): string[] {
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { throw new Error('MCP_GATEWAY_ALLOWED_ROOTS must be a JSON array of absolute paths'); }
    if (!Array.isArray(parsed)) throw new Error('MCP_GATEWAY_ALLOWED_ROOTS must be a JSON array of absolute paths');
    return normalizeAllowedRoots(parsed);
}

export async function captureGatewayConfigFromEnvironment(
    store: GatewayDeviceConfigStore,
    options: { fallbackGatewayUrl?: string | null } = {}
): Promise<GatewayDeviceConfig> {
    const current = await store.load();
    const gatewayUrl = String(process.env.MCP_GATEWAY_URL || current.gatewayUrl || options.fallbackGatewayUrl || '').trim();
    if (!gatewayUrl) throw new Error('MCP_GATEWAY_URL is required for the first login or install.');
    const patch: Partial<GatewayDeviceConfig> = { gatewayUrl };
    if (process.env.MCP_GATEWAY_ALLOWED_ROOTS !== undefined) {
        patch.allowedRoots = parseAllowedRootsEnvironment(String(process.env.MCP_GATEWAY_ALLOWED_ROOTS || ''));
    }
    const proxy = resolveProxyDecisionFromEnvironment(gatewayUrl);
    if (proxy.explicit) {
        patch.proxy = proxy.proxyUrl
            ? { mode: 'configured', url: proxy.proxyUrl }
            : { mode: 'direct', url: null };
    }
    const appCaPath = String(process.env.MCP_GATEWAY_APP_CA_PATH || '').trim();
    if (appCaPath) patch.appCaPem = await fs.readFile(path.resolve(appCaPath), 'utf8');
    return await store.update(patch);
}

export function createGatewayProxyAgent(config: GatewayDeviceConfig): { agent: ProxyAgent } {
    const proxyUrl = config.proxy.mode === 'configured' ? String(config.proxy.url || '') : '';
    return {
        agent: new ProxyAgent({ getProxyForUrl: () => proxyUrl })
    };
}
