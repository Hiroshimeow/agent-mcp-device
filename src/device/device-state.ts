import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export const DEVICE_STATE_FILES = Object.freeze([
    'gateway-identity.json',
    'gateway-config.json',
    'gateway-status.json'
]);

export interface DeviceStatePaths {
    root: string;
    legacyRoot: string;
    identity: string;
    config: string;
    status: string;
    runtime: string;
    update: string;
}

export function deviceStatePaths(home = os.homedir()): DeviceStatePaths {
    const root = path.resolve(home, '.mcp-device');
    const legacyRoot = path.resolve(home, '.hcu-device');
    return {
        root,
        legacyRoot,
        identity: path.join(root, 'gateway-identity.json'),
        config: path.join(root, 'gateway-config.json'),
        status: path.join(root, 'gateway-status.json'),
        runtime: path.join(root, 'runtime'),
        update: path.join(root, 'update')
    };
}

async function readJsonIfExists(filePath: string): Promise<any | null> {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (error: any) {
        if (error?.code === 'ENOENT') return null;
        throw new Error(`Invalid MCP Device state file ${filePath}: ${error?.message || error}`);
    }
}

async function copyAtomic(source: string, target: string): Promise<void> {
    const content = await fs.readFile(source);
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, target);
    try { await fs.chmod(target, 0o600); } catch { /* Windows ACLs inherit from the user profile. */ }
}

function identityFingerprint(value: any): string | null {
    if (!value) return null;
    const deviceId = String(value.deviceId || '').trim();
    const publicKeyPem = String(value.publicKeyPem || '').trim();
    return deviceId && publicKeyPem ? `${deviceId}\n${publicKeyPem}` : null;
}

export async function migrateLegacyDeviceState(paths = deviceStatePaths()): Promise<{ migrated: string[]; legacyStateSeen: boolean }> {
    await fs.mkdir(paths.root, { recursive: true, mode: 0o700 });
    const legacyIdentityPath = path.join(paths.legacyRoot, 'gateway-identity.json');
    const canonicalIdentity = await readJsonIfExists(paths.identity);
    const legacyIdentity = await readJsonIfExists(legacyIdentityPath);
    const legacyPresence = await Promise.all(DEVICE_STATE_FILES.map(async name => {
        try { await fs.access(path.join(paths.legacyRoot, name)); return true; } catch { return false; }
    }));
    const legacyStateSeen = legacyPresence.some(Boolean);

    if (canonicalIdentity && legacyIdentity) {
        const canonicalFingerprint = identityFingerprint(canonicalIdentity);
        const legacyFingerprint = identityFingerprint(legacyIdentity);
        if (!canonicalFingerprint || !legacyFingerprint || canonicalFingerprint !== legacyFingerprint) {
            throw new Error('MCP Device migration conflict: canonical and legacy device identities differ.');
        }
    }
    if (legacyStateSeen && !legacyIdentity && !canonicalIdentity) {
        throw new Error('MCP Device migration failed closed: legacy state exists without a device identity.');
    }

    const migrated: string[] = [];
    for (const name of DEVICE_STATE_FILES) {
        const source = path.join(paths.legacyRoot, name);
        const target = path.join(paths.root, name);
        let sourceExists = true;
        try { await fs.access(source); } catch { sourceExists = false; }
        if (!sourceExists) continue;
        await readJsonIfExists(source);
        let targetExists = true;
        try { await fs.access(target); } catch { targetExists = false; }
        if (!targetExists) {
            await copyAtomic(source, target);
            migrated.push(name);
        }
    }
    return { migrated, legacyStateSeen };
}
