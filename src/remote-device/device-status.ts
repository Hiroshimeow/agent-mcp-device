import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export interface GatewayAccountStatus {
    connected: boolean;
    label: string | null;
}

export interface GatewayUsageStatus {
    connections: number;
    reconnects: number;
    toolCallsStarted: number;
    toolCallsSucceeded: number;
    toolCallsFailed: number;
    requestBytes: number;
    responseBytes: number;
    lastSeenAt: number | null;
    lastErrorCode: string | null;
}

export interface GatewaySchemaStatus {
    toolCount: number;
    toolSchemaBytes: number;
    toolSchemaTokenEstimate: number;
    tokenEstimateMethod: string;
    tokenUsageKind: 'schema_estimate_not_billing';
}

export interface GatewayDeviceStatus {
    version: 1;
    gatewayUrl: string | null;
    deviceId: string | null;
    deviceName: string | null;
    identityPresent: boolean;
    account: GatewayAccountStatus;
    connection: {
        online: boolean;
        connectionEpoch: number | string | null;
        lastConnectedAt: number | null;
    };
    usage: GatewayUsageStatus | null;
    schema: GatewaySchemaStatus | null;
    usageFreshAt: number | null;
}

export interface GatewayServiceStatus {
    installed: boolean;
    running: boolean;
    taskName?: string | null;
}

function defaultStatusPath(): string {
    return path.join(path.resolve(os.homedir()), '.hcu-device', 'gateway-status.json');
}

function emptyStatus(): GatewayDeviceStatus {
    return {
        version: 1,
        gatewayUrl: null,
        deviceId: null,
        deviceName: null,
        identityPresent: false,
        account: { connected: false, label: null },
        connection: { online: false, connectionEpoch: null, lastConnectedAt: null },
        usage: null,
        schema: null,
        usageFreshAt: null
    };
}

function sanitizedStatus(value: Partial<GatewayDeviceStatus> | null | undefined): GatewayDeviceStatus {
    const base = emptyStatus();
    if (!value || typeof value !== 'object') return base;
    const usage = value.usage && typeof value.usage === 'object' ? {
        connections: Number(value.usage.connections || 0),
        reconnects: Number(value.usage.reconnects || 0),
        toolCallsStarted: Number(value.usage.toolCallsStarted || 0),
        toolCallsSucceeded: Number(value.usage.toolCallsSucceeded || 0),
        toolCallsFailed: Number(value.usage.toolCallsFailed || 0),
        requestBytes: Number(value.usage.requestBytes || 0),
        responseBytes: Number(value.usage.responseBytes || 0),
        lastSeenAt: value.usage.lastSeenAt == null ? null : Number(value.usage.lastSeenAt),
        lastErrorCode: value.usage.lastErrorCode ? String(value.usage.lastErrorCode).slice(0, 64) : null
    } : null;
    const schema = value.schema && typeof value.schema === 'object' ? {
        toolCount: Number(value.schema.toolCount || 0),
        toolSchemaBytes: Number(value.schema.toolSchemaBytes || 0),
        toolSchemaTokenEstimate: Number(value.schema.toolSchemaTokenEstimate || 0),
        tokenEstimateMethod: String(value.schema.tokenEstimateMethod || 'utf8_bytes_div_4_estimate').slice(0, 64),
        tokenUsageKind: 'schema_estimate_not_billing' as const
    } : null;
    return {
        version: 1,
        gatewayUrl: value.gatewayUrl ? String(value.gatewayUrl) : null,
        deviceId: value.deviceId ? String(value.deviceId) : null,
        deviceName: value.deviceName ? String(value.deviceName) : null,
        identityPresent: value.identityPresent === true,
        account: {
            connected: value.account?.connected === true,
            label: value.account?.label ? String(value.account.label).slice(0, 128) : null
        },
        connection: {
            online: value.connection?.online === true,
            connectionEpoch: value.connection?.connectionEpoch ?? null,
            lastConnectedAt: value.connection?.lastConnectedAt == null ? null : Number(value.connection.lastConnectedAt)
        },
        usage,
        schema,
        usageFreshAt: value.usageFreshAt == null ? null : Number(value.usageFreshAt)
    };
}

export class GatewayDeviceStatusStore {
    readonly statusPath: string;

    constructor(statusPath = defaultStatusPath()) {
        this.statusPath = path.resolve(statusPath);
    }

    async load(): Promise<GatewayDeviceStatus> {
        try {
            return sanitizedStatus(JSON.parse(await fs.readFile(this.statusPath, 'utf8')));
        } catch (error: any) {
            if (error?.code === 'ENOENT') return emptyStatus();
            throw error;
        }
    }

    async update(patch: Partial<GatewayDeviceStatus>): Promise<GatewayDeviceStatus> {
        const current = await this.load();
        const merged = sanitizedStatus({
            ...current,
            ...patch,
            account: patch.account ? { ...current.account, ...patch.account } : current.account,
            connection: patch.connection ? { ...current.connection, ...patch.connection } : current.connection,
            usage: patch.usage === undefined ? current.usage : patch.usage,
            schema: patch.schema === undefined ? current.schema : patch.schema
        });
        await this.persist(merged);
        return merged;
    }

    async markOffline(): Promise<GatewayDeviceStatus> {
        const current = await this.load();
        return await this.update({ connection: { ...current.connection, online: false } });
    }

    async clearAccount(): Promise<GatewayDeviceStatus> {
        return await this.update({ account: { connected: false, label: null } });
    }

    private async persist(status: GatewayDeviceStatus): Promise<void> {
        await fs.mkdir(path.dirname(this.statusPath), { recursive: true });
        const temporary = `${this.statusPath}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(temporary, JSON.stringify(status, null, 2), { mode: 0o600 });
        await fs.rename(temporary, this.statusPath);
        try { await fs.chmod(this.statusPath, 0o600); } catch { /* Windows ACL inherits from user profile. */ }
    }
}

function dateText(value: number | null | undefined): string {
    if (!value) return 'never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString();
}

export function formatGatewayStatus(
    status: GatewayDeviceStatus,
    options: { json?: boolean; service?: GatewayServiceStatus } = {}
): string {
    const service = options.service || { installed: false, running: false };
    const payload = { ...status, service };
    if (options.json) return JSON.stringify(payload, null, 2);
    const accountText = status.account.connected
        ? `connected${status.account.label ? ` (${status.account.label})` : ''}`
        : 'not connected';
    const usage = status.usage;
    const schema = status.schema;
    return [
        `Gateway: ${status.gatewayUrl || 'not configured'}`,
        `Device: ${status.deviceName || status.deviceId || 'unknown'}${status.deviceId ? ` (${status.deviceId})` : ''}`,
        `Identity: ${status.identityPresent ? 'present' : 'missing'}`,
        `Account: ${accountText}`,
        `Connection: ${status.connection.online ? 'online' : 'offline'}; last connected ${dateText(status.connection.lastConnectedAt)}`,
        `Service: ${service.installed ? (service.running ? 'installed/running' : 'installed/stopped') : 'not installed'}`,
        `Usage: calls ${usage?.toolCallsStarted ?? 0} started / ${usage?.toolCallsSucceeded ?? 0} succeeded / ${usage?.toolCallsFailed ?? 0} failed; bytes ${usage?.requestBytes ?? 0} in / ${usage?.responseBytes ?? 0} out`,
        `Schema: ${schema?.toolCount ?? 0} tools / ${schema?.toolSchemaBytes ?? 0} bytes`,
        `Schema token estimate: ${schema?.toolSchemaTokenEstimate ?? 0} (${schema?.tokenEstimateMethod || 'unavailable'}; not ChatGPT billing usage)`,
        `Usage fresh at: ${dateText(status.usageFreshAt)}`
    ].join('\n');
}
