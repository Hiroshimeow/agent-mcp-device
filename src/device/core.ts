import { randomUUID } from 'node:crypto';
import path from 'node:path';

export interface DeviceCoreOptions {
    deviceId: string;
    /** Must match MCP_DEVICE_CONFIG_DIR before existing Device modules are imported. */
    stateRoot?: string;
    allowedRoots?: string[];
}

export interface DeviceCore {
    readonly deviceId: string;
    readonly stateRoot: string;
    readonly runtimeInstanceId: string;
    /** Existing broker capabilities; native tools retain their separate contracts. */
    readonly capabilities: string[];
    invoke(tool: string, args?: unknown): Promise<any>;
    /** The existing rich native surface, without rewriting it into broker arguments. */
    invokeNative(tool: string, args?: unknown): Promise<any>;
    close(): Promise<void>;
}

function samePath(left: string, right: string): boolean {
    const normalize = (value: string) => {
        const resolved = path.resolve(value);
        return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    return normalize(left) === normalize(right);
}

/**
 * The transport-neutral execution owner shared by remote Device and server.
 *
 * No account enrollment, socket, self-MCP child, plugin, or Palace is created
 * here. Authorization belongs to the caller's broker; file/process semantics
 * remain owned by the existing Device handlers and GatewayToolAdapter.
 *
 * Existing native managers are process-scoped. A server must configure its
 * isolated state root before importing them; silently changing a global root
 * after import could write to the user's normal Device state.
 */
export async function createDeviceCore(options: DeviceCoreOptions): Promise<DeviceCore> {
    if (!options.deviceId || typeof options.deviceId !== 'string' || !options.deviceId.trim()) {
        throw Object.assign(new Error('Device Core requires a device identity'), { code: 'DEVICE_ID_REQUIRED' });
    }

    // This module intentionally has no eager imports of existing Device modules.
    const { CONFIG_DIR } = await import('../config.js');
    const stateRoot = path.resolve(options.stateRoot ?? CONFIG_DIR);
    if (!samePath(stateRoot, CONFIG_DIR)) {
        throw Object.assign(new Error(
            'Device Core stateRoot must match MCP_DEVICE_CONFIG_DIR set before importing Device modules'
        ), { code: 'CONFIG_ROOT_MISMATCH' });
    }

    const [{ GatewayToolAdapter, gatewayCapabilities }, { dispatchToolCall }] = await Promise.all([
        import('./gateway-tool-adapter.js'),
        import('../tool-dispatcher.js')
    ]);
    const adapter = new GatewayToolAdapter(undefined, {
        allowedRoots: options.allowedRoots,
        context: { deviceId: options.deviceId, stateRoot }
    });
    const runtimeInstanceId = `direct-in-process:${randomUUID()}`;
    let closed = false;
    const assertOpen = () => {
        if (closed) throw Object.assign(new Error('Device Core is closed'), { code: 'DEVICE_NOT_READY' });
    };

    return {
        deviceId: options.deviceId,
        stateRoot,
        runtimeInstanceId,
        get capabilities() {
            return closed ? [] : gatewayCapabilities();
        },
        async invoke(tool, args = {}) {
            assertOpen();
            return adapter.call(tool, args);
        },
        async invokeNative(tool, args = {}) {
            assertOpen();
            return dispatchToolCall(tool, args, { isRemote: true });
        },
        async close() {
            // The core owns no second runtime or socket. Its host owns process
            // shutdown; existing native process session retention is unchanged.
            closed = true;
        }
    };
}
