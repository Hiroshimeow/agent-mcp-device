import os from 'os';
import path from 'path';

export const DEVICE_STATE_FILES = Object.freeze([
    'gateway-identity.json',
    'gateway-config.json',
    'gateway-status.json'
]);

export interface DeviceStatePaths {
    root: string;
    identity: string;
    config: string;
    status: string;
    runtime: string;
    update: string;
}

export function deviceStatePaths(home = os.homedir()): DeviceStatePaths {
    const root = path.resolve(home, '.mcp-device');
    return {
        root,
        identity: path.join(root, 'gateway-identity.json'),
        config: path.join(root, 'gateway-config.json'),
        status: path.join(root, 'gateway-status.json'),
        runtime: path.join(root, 'runtime'),
        update: path.join(root, 'update')
    };
}
