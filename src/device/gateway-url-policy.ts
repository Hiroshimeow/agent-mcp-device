function isLoopbackHostname(hostname: string): boolean {
    const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host === '::1') return true;
    const parts = host.split('.');
    return parts.length === 4 && parts.every(part => /^\d+$/.test(part)) && Number(parts[0]) === 127 && parts.every(part => Number(part) >= 0 && Number(part) <= 255);
}

export function assertSecureGatewayUrl(url: URL): void {
    if ((url.protocol === 'http:' || url.protocol === 'ws:') && !isLoopbackHostname(url.hostname)) {
        throw new Error('Plaintext MCP gateway URLs are allowed only on loopback; use https/wss for non-loopback gateways.');
    }
}

export function gatewaySocketUrl(raw: string): string {
    const url = new URL(raw);
    const configuredProtocol = url.protocol;
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('MCP_GATEWAY_URL must use http(s) or ws(s)');
    assertSecureGatewayUrl(url);
    if (configuredProtocol === 'http:' || configuredProtocol === 'https:' || !url.pathname || url.pathname === '/') {
        url.pathname = '/device';
        url.search = '';
        url.hash = '';
    }
    return url.toString();
}

export function gatewayHttpBase(raw: string): string {
    const url = new URL(raw);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Gateway URL must use http(s) or ws(s).');
    assertSecureGatewayUrl(url);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
}
