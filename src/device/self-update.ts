import { execFile as execFileCallback, spawn as spawnCallback } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { VERSION } from '../version.js';
import { deviceStatePaths, type DeviceStatePaths } from './device-state.js';
import { PM2_NAME, Pm2DeviceService, SYSTEMD_UNIT, SystemdUserDeviceService } from './linux-service.js';
import { runtimeOwnerControlFileFor } from './runtime-owner.js';
import { buildWindowsTaskName, WindowsDeviceService } from './windows-service.js';

const execFileAsync = promisify(execFileCallback);

export const MCP_DEVICE_PACKAGE = '@hcu-lab.me/mcp-device';
const UPDATE_STATE_SCHEMA = 1;
const UPDATE_STATE_STALE_MS = 15 * 60 * 1000;

export type DeviceUpdateManagerKind =
    | 'windows-task'
    | 'windows-run'
    | 'windows-manual'
    | 'systemd'
    | 'pm2';

export type DeviceUpdatePhase =
    | 'prepared'
    | 'helper_started'
    | 'handoff_ready'
    | 'quiescing'
    | 'installing'
    | 'installed_waiting_reconnect'
    | 'rollback'
    | 'failed';

export interface DeviceUpdateState {
    schema: number;
    requestId: string;
    fromVersion: string;
    targetVersion: string;
    state: DeviceUpdatePhase;
    startedAt: number;
    updatedAt?: number;
    completedAt: number | null;
    errorCode: string | null;
    message: string | null;
    deviceId: string;
    managerKind: DeviceUpdateManagerKind;
    parentPid: number;
    childPid: number | null;
    packageRoot: string;
    globalPrefix: string;
    nodePath: string;
    npmCliPath: string;
    targetTarball: string;
    cacheDir: string;
    rollbackSnapshot: string;
    rollbackPath: string;
    helperPath: string;
    handoffPath: string;
    runtimeOwnerControlPath: string;
    windowsRunnerPath?: string;
    windowsTaskName?: string;
    windowsUpdateTaskName?: string;
    powershellPath?: string;
    schtasksPath?: string;
    systemctlPath?: string;
    systemdRunPath?: string;
    systemdUnit?: string;
    systemdUpdateUnit?: string;
    pm2Path?: string;
    pm2Name?: string;
}

export interface PreparedDeviceUpdate {
    state: DeviceUpdateState;
    statePath: string;
    helperRunnerPath?: string;
}

type ExecFileFn = (file: string, args: string[]) => Promise<{ stdout?: string; stderr?: string }>;

export interface DeviceUpdateManagerOverride {
    managerKind: DeviceUpdateManagerKind;
    windowsRunnerPath?: string;
    windowsTaskName?: string;
    powershellPath?: string;
    schtasksPath?: string;
    systemctlPath?: string;
    systemdRunPath?: string;
    systemdUnit?: string;
    pm2Path?: string;
    pm2Name?: string;
}

function updateError(code: string, message: string): Error & { code: string } {
    return Object.assign(new Error(message), { code });
}

export function normalizeUpdateVersion(value: string): string {
    const version = String(value || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
        throw updateError('DEVICE_UPDATE_INVALID_VERSION', 'Update target must be an exact stable semantic version.');
    }
    return version;
}

function safeToken(value: string): string {
    const normalized = String(value || '').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 40);
    const digest = crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 10);
    return (normalized || 'update') + '-' + digest;
}

async function equalPath(
    left: string,
    right: string,
    platform: NodeJS.Platform | string = process.platform
): Promise<boolean> {
    const canonical = async (value: string) => {
        const resolved = path.resolve(value);
        return await fs.realpath(resolved).catch(() => resolved);
    };
    const a = await canonical(left);
    const b = await canonical(right);
    return platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

async function exists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function defaultExecFile(file: string, args: string[]): Promise<{ stdout?: string; stderr?: string }> {
    const result = await execFileAsync(file, args, {
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
    });
    return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary =
        filePath + '.' + process.pid + '.' + Date.now() + '.' +
        crypto.randomBytes(6).toString('hex') + '.tmp';
    try {
        await fs.writeFile(temporary, JSON.stringify(value, null, 2), {
            encoding: 'utf8',
            mode: 0o600,
            flag: 'wx'
        });
        await fs.rename(temporary, filePath);
        try {
            await fs.chmod(filePath, 0o600);
        } catch {
            // Windows ACLs inherit from the user profile.
        }
    } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => {});
        throw error;
    }
}

function updateFiles(paths: DeviceStatePaths = deviceStatePaths()) {
    return {
        root: paths.update,
        state: path.join(paths.update, 'update-state.json'),
        helper: path.join(paths.update, 'update-helper.cjs'),
        helperRunner: path.join(paths.update, 'run-update.ps1'),
        handoff: path.join(paths.update, 'handoff.ready'),
        stage: path.join(paths.update, 'stage'),
        verify: path.join(paths.update, 'verify'),
        cache: path.join(paths.update, 'npm-cache'),
        rollbackSnapshot: path.join(paths.update, 'rollback-package')
    };
}

export async function readDeviceUpdateState(paths = deviceStatePaths()): Promise<DeviceUpdateState | null> {
    const filePath = updateFiles(paths).state;
    try {
        const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as DeviceUpdateState;
        return parsed?.schema === UPDATE_STATE_SCHEMA ? parsed : null;
    } catch (error: any) {
        if (error?.code === 'ENOENT') return null;
        throw error;
    }
}

function updateStateAgeMs(state: DeviceUpdateState, now = Date.now()): number {
    const touchedAt = Number(state.updatedAt || state.startedAt || 0);
    return Number.isFinite(touchedAt) && touchedAt > 0 ? Math.max(0, now - touchedAt) : Number.POSITIVE_INFINITY;
}

function isStaleUpdateState(state: DeviceUpdateState, now = Date.now()): boolean {
    return updateStateAgeMs(state, now) > UPDATE_STATE_STALE_MS;
}

function isHelperOwnedUpdatePhase(state: DeviceUpdateState): boolean {
    return ['helper_started', 'handoff_ready', 'quiescing', 'installing', 'rollback'].includes(state.state);
}

async function markInterruptedUpdateState(
    state: DeviceUpdateState,
    code: string,
    message: string,
    paths: DeviceStatePaths
): Promise<DeviceUpdateState> {
    const next: DeviceUpdateState = {
        ...state,
        state: 'failed',
        updatedAt: Date.now(),
        completedAt: Date.now(),
        errorCode: code,
        message
    };
    await writeDeviceUpdateState(next, paths);
    return next;
}

export async function assertDeviceStartupAllowedDuringUpdate(
    currentVersion = VERSION,
    paths = deviceStatePaths()
): Promise<void> {
    const state = await readDeviceUpdateState(paths);
    if (!state || state.state === 'failed') return;

    // The target package itself is allowed to start and prove successful
    // installation by authenticating with targetVersion.
    if (state.targetVersion === currentVersion) return;

    if (state.state === 'installed_waiting_reconnect') {
        await markInterruptedUpdateState(
            state,
            'DEVICE_UPDATE_VERSION_MISMATCH',
            'Update state expected a different package version after restart.',
            paths
        );
        return;
    }

    // "prepared" means the helper was never successfully launched, so there is
    // no external updater to wait for after a process restart.
    if (state.state === 'prepared') {
        await markInterruptedUpdateState(
            state,
            'DEVICE_UPDATE_INTERRUPTED',
            'MCP Device restarted before the update helper was launched.',
            paths
        );
        return;
    }

    if (isHelperOwnedUpdatePhase(state) && !isStaleUpdateState(state)) {
        throw updateError(
            'DEVICE_UPDATE_RECOVERY_IN_PROGRESS',
            'An MCP Device update helper still owns the update lifecycle; retry startup after it completes.'
        );
    }

    if (isStaleUpdateState(state)) {
        await markInterruptedUpdateState(
            state,
            'DEVICE_UPDATE_INTERRUPTED',
            'Stale MCP Device update state was recovered after the helper stopped making progress.',
            paths
        );
    }
}

async function writeDeviceUpdateState(state: DeviceUpdateState, paths = deviceStatePaths()): Promise<void> {
    await atomicWriteJson(updateFiles(paths).state, state);
}

async function patchDeviceUpdateState(
    patch: Partial<DeviceUpdateState>,
    paths = deviceStatePaths()
): Promise<DeviceUpdateState> {
    const current = await readDeviceUpdateState(paths);
    if (!current) throw new Error('MCP Device update state is missing.');
    const next = { ...current, ...patch, updatedAt: Date.now() } as DeviceUpdateState;
    await writeDeviceUpdateState(next, paths);
    return next;
}

async function resolveExecutable(
    command: string,
    platform: NodeJS.Platform | string,
    execFile: ExecFileFn
): Promise<string> {
    if (path.isAbsolute(command) && await exists(command)) return path.resolve(command);
    const lookup = platform === 'win32' ? 'where.exe' : 'which';
    const result = await execFile(lookup, [command]);
    const candidates = String(result.stdout || '')
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean);
    for (const candidate of candidates) {
        if (await exists(candidate)) return path.resolve(candidate);
    }
    throw new Error('Unable to resolve executable: ' + command);
}

export async function resolveNpmCliPath(options: {
    platform?: NodeJS.Platform | string;
    execFile?: ExecFileFn;
    nodePath?: string;
    npmExecPath?: string;
} = {}): Promise<string> {
    const platform = options.platform || process.platform;
    const execFile = options.execFile || defaultExecFile;
    const nodePath = path.resolve(options.nodePath || process.execPath);
    const directCandidates = [
        options.npmExecPath,
        // npm_execpath belongs to the host process. Ignore it when callers
        // deliberately resolve for another platform (tests, cross-platform
        // packaging) so a Windows npm-cli path cannot shadow Unix discovery.
        platform === process.platform ? process.env.npm_execpath : undefined,
        path.join(path.dirname(nodePath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    ]
        .filter(Boolean)
        .map(value => path.resolve(String(value)));

    for (const candidate of directCandidates) {
        if (await exists(candidate)) return candidate;
    }

    const lookup = platform === 'win32' ? 'where.exe' : 'which';
    const npmCommand = platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = await execFile(lookup, [npmCommand]);
    const wrappers = String(result.stdout || '')
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean);

    for (const wrapper of wrappers) {
        const realWrapper = await fs.realpath(wrapper).catch(() => wrapper);
        const candidates = [
            // On many Unix distributions /usr/bin/npm is a symlink whose
            // realpath is npm-cli.js itself.
            path.basename(realWrapper).toLowerCase() === 'npm-cli.js' ? realWrapper : '',
            path.join(path.dirname(wrapper), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
            path.join(path.dirname(realWrapper), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
            path.resolve(path.dirname(realWrapper), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
        ].filter(Boolean);
        for (const candidate of candidates) {
            if (await exists(candidate)) return path.resolve(candidate);
        }
    }

    throw new Error('Unable to resolve an absolute npm-cli.js path for self-update.');
}

async function runNpm(
    nodePath: string,
    npmCliPath: string,
    args: string[],
    execFile: ExecFileFn
): Promise<{ stdout?: string; stderr?: string }> {
    return await execFile(nodePath, [npmCliPath, ...args]);
}

export async function findCurrentPackageRoot(entrypoint = process.argv[1]): Promise<string> {
    let current = path.resolve(path.dirname(entrypoint || process.execPath));
    for (let i = 0; i < 8; i++) {
        const manifest = path.join(current, 'package.json');
        if (await exists(manifest)) {
            try {
                const parsed = JSON.parse(await fs.readFile(manifest, 'utf8'));
                if (parsed?.name === MCP_DEVICE_PACKAGE) return current;
            } catch {
                // Keep walking until the package root is found.
            }
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    throw new Error('Unable to locate the installed MCP Device package root.');
}

function managerArg(argv: string[]): string {
    const value = argv.find(item => String(item).startsWith('--manager='));
    return value ? String(value).slice('--manager='.length).trim().toLowerCase() : '';
}

async function detectManager(options: {
    deviceId: string;
    argv: string[];
    platform: NodeJS.Platform | string;
    execFile: ExecFileFn;
    paths: DeviceStatePaths;
}): Promise<DeviceUpdateManagerOverride> {
    if (!options.argv.includes('--service')) {
        throw updateError(
            'DEVICE_UPDATE_REQUIRES_SERVICE',
            'Dashboard updates require an installed background MCP Device service.'
        );
    }

    const serviceExec = async (file: string, args: string[]) => {
        const result = await options.execFile(file, args);
        return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
    };

    if (options.platform === 'win32') {
        const service = new WindowsDeviceService({
            platform: options.platform,
            execFile: serviceExec
        });
        const status = await service.status(options.deviceId);
        if (!status.installed || status.registration === 'stale') {
            throw updateError(
                'DEVICE_UPDATE_REQUIRES_SERVICE',
                'Windows MCP Device background registration is missing or stale.'
            );
        }

        const managerKind: DeviceUpdateManagerKind =
            status.registration === 'task'
                ? 'windows-task'
                : status.registration === 'run'
                    ? 'windows-run'
                    : 'windows-manual';

        const systemRoot = String(process.env.SystemRoot || 'C:\\Windows');
        return {
            managerKind,
            windowsRunnerPath: path.join(options.paths.root, 'run-device.ps1'),
            windowsTaskName: buildWindowsTaskName(options.deviceId),
            powershellPath: path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
            schtasksPath: path.join(systemRoot, 'System32', 'schtasks.exe')
        };
    }

    if (options.platform === 'linux') {
        const manager = managerArg(options.argv);
        if (manager === 'systemd') {
            const service = new SystemdUserDeviceService({
                platform: options.platform,
                execFile: serviceExec
            });
            const status = await service.status();
            if (!status.installed) {
                throw updateError('DEVICE_UPDATE_REQUIRES_SERVICE', 'systemd-user MCP Device service is not installed.');
            }
            return {
                managerKind: 'systemd',
                systemctlPath: await resolveExecutable('systemctl', options.platform, options.execFile),
                systemdRunPath: await resolveExecutable('systemd-run', options.platform, options.execFile),
                systemdUnit: SYSTEMD_UNIT
            };
        }

        if (manager === 'pm2') {
            const service = new Pm2DeviceService({
                platform: options.platform,
                execFile: serviceExec
            });
            const status = await service.status();
            if (!status.installed) {
                throw updateError('DEVICE_UPDATE_REQUIRES_SERVICE', 'PM2 MCP Device service is not installed.');
            }
            return {
                managerKind: 'pm2',
                pm2Path: await resolveExecutable('pm2', options.platform, options.execFile),
                pm2Name: PM2_NAME
            };
        }

        throw updateError(
            'DEVICE_UPDATE_REQUIRES_SERVICE',
            'Linux dashboard update requires systemd or PM2 service ownership.'
        );
    }

    throw updateError(
        'DEVICE_UPDATE_UNSUPPORTED_PLATFORM',
        'Dashboard self-update is supported only on installed Windows and Linux devices.'
    );
}

function tarballFromPackOutput(stdout: string, stageDir: string): string | null {
    try {
        const parsed = JSON.parse(stdout);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        const filename = rows.map(item => String(item?.filename || '').trim()).find(Boolean);
        if (filename) return path.isAbsolute(filename) ? filename : path.join(stageDir, filename);
    } catch {
        // Some npm versions print a plain tarball filename.
    }

    const plain = stdout
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean)
        .at(-1);
    if (plain?.endsWith('.tgz')) {
        return path.isAbsolute(plain) ? plain : path.join(stageDir, plain);
    }
    return null;
}

async function directoryByteSize(root: string): Promise<number> {
    let total = 0;
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            total += await directoryByteSize(entryPath);
        } else if (entry.isFile()) {
            total += (await fs.stat(entryPath)).size;
        } else if (entry.isSymbolicLink()) {
            total += (await fs.lstat(entryPath)).size;
        }
    }
    return total;
}

async function assertDiskBudgetAt(
    location: string,
    requiredBytes: number,
    purpose: string
): Promise<void> {
    // fs.promises.statfs was added in Node 18.15. The package still supports
    // earlier Node 18 releases, so this proactive check must degrade safely;
    // staging/copy/install operations still fail closed on ENOSPC.
    if (typeof fs.statfs !== 'function') return;
    try {
        const volume = await fs.statfs(location);
        const availableBytes = Number(volume.bavail) * Number(volume.bsize);
        if (!Number.isFinite(availableBytes) || availableBytes < requiredBytes) {
            throw updateError(
                'DEVICE_UPDATE_INSUFFICIENT_DISK',
                'Insufficient free space for MCP Device update ' + purpose + '.'
            );
        }
    } catch (error: any) {
        if (error?.code === 'DEVICE_UPDATE_INSUFFICIENT_DISK') throw error;
        throw updateError(
            'DEVICE_UPDATE_DISK_CHECK_FAILED',
            'Unable to verify free disk space for MCP Device update ' + purpose + ': ' +
            String(error?.message || error).slice(0, 160)
        );
    }
}

async function verifyPackageVersion(packageRoot: string, expected: string): Promise<void> {
    let actual = '';
    try {
        const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
        actual = String(manifest?.version || '');
    } catch {
        actual = '';
    }

    if (actual !== expected) {
        throw updateError(
            'DEVICE_UPDATE_VERIFY_FAILED',
            'Package verification failed: expected ' + expected + ', got ' + (actual || 'unknown') + '.'
        );
    }
}

function helperAssetPath(): string {
    return fileURLToPath(new URL('./update-helper.cjs', import.meta.url));
}

export async function prepareDevicePackageUpdate(options: {
    targetVersion: string;
    requestId: string;
    deviceId: string;
    childPid?: number | null;
    fromVersion?: string;
    argv?: string[];
    platform?: NodeJS.Platform | string;
    execFile?: ExecFileFn;
    paths?: DeviceStatePaths;
    entrypoint?: string;
    nodePath?: string;
    packageRoot?: string;
    npmCliPath?: string;
    globalPrefix?: string;
    globalRoot?: string;
    managerOverride?: DeviceUpdateManagerOverride;
    helperSourcePath?: string;
}): Promise<PreparedDeviceUpdate> {
    const targetVersion = normalizeUpdateVersion(options.targetVersion);
    const fromVersion = normalizeUpdateVersion(options.fromVersion || VERSION);
    if (targetVersion === fromVersion) {
        throw updateError('DEVICE_UPDATE_ALREADY_CURRENT', 'MCP Device is already on ' + targetVersion + '.');
    }

    const requestId = String(options.requestId || '').trim();
    if (!requestId) {
        throw updateError('DEVICE_UPDATE_INVALID_REQUEST', 'Device update request_id is required.');
    }

    const platform = options.platform || process.platform;
    const execFile = options.execFile || defaultExecFile;
    const paths = options.paths || deviceStatePaths();
    const files = updateFiles(paths);
    const nodePath = path.resolve(options.nodePath || process.execPath);
    const packageRoot = path.resolve(options.packageRoot || await findCurrentPackageRoot(options.entrypoint || process.argv[1]));
    await verifyPackageVersion(packageRoot, fromVersion);

    const existing = await readDeviceUpdateState(paths);
    if (existing) {
        const priorTargetIsCurrent = existing.targetVersion === fromVersion;
        const interruptedBeforeHelper = existing.state === 'prepared';
        const recoverableTerminal = ['failed', 'installed_waiting_reconnect'].includes(existing.state);
        const stale = isStaleUpdateState(existing);

        if (priorTargetIsCurrent || interruptedBeforeHelper || recoverableTerminal || stale) {
            // packageRoot was verified above as the currently running package,
            // so prior external update artifacts are no longer authoritative.
            await retireDeviceUpdateState(existing, paths);
        } else {
            throw updateError('DEVICE_UPDATE_IN_PROGRESS', 'A device update is already in progress.');
        }
    }

    const npmCliPath = path.resolve(
        options.npmCliPath || await resolveNpmCliPath({ platform, execFile, nodePath })
    );

    const prefix = options.globalPrefix
        ? path.resolve(options.globalPrefix)
        : path.resolve(String((await runNpm(nodePath, npmCliPath, ['config', 'get', 'prefix'], execFile)).stdout || '').trim());

    if (!prefix || prefix === path.parse(prefix).root) {
        throw updateError('DEVICE_UPDATE_PREFIX_INVALID', 'npm global prefix could not be resolved safely.');
    }

    // npm's global node_modules layout is platform/install dependent:
    // Windows commonly uses <prefix>/node_modules, while Unix commonly uses
    // <prefix>/lib/node_modules. Ask npm for the authoritative root instead of
    // deriving it from prefix.
    const globalRoot = options.globalRoot
        ? path.resolve(options.globalRoot)
        : path.resolve(String((await runNpm(nodePath, npmCliPath, ['root', '-g'], execFile)).stdout || '').trim());
    if (!globalRoot || globalRoot === path.parse(globalRoot).root) {
        throw updateError('DEVICE_UPDATE_ROOT_INVALID', 'npm global package root could not be resolved safely.');
    }

    const expectedPackageRoot = path.join(globalRoot, '@hcu-lab.me', 'mcp-device');
    if (!await equalPath(packageRoot, expectedPackageRoot, platform)) {
        throw updateError(
            'DEVICE_UPDATE_PACKAGE_ROOT_MISMATCH',
            'Installed package root does not match npm global package root: ' + packageRoot
        );
    }

    const manager = options.managerOverride || await detectManager({
        deviceId: options.deviceId,
        argv: options.argv || process.argv,
        platform,
        execFile,
        paths
    });

    await fs.mkdir(files.root, { recursive: true, mode: 0o700 });
    for (const disposable of [files.stage, files.verify, files.cache, files.rollbackSnapshot]) {
        await fs.rm(disposable, { recursive: true, force: true });
    }
    await fs.rm(files.handoff, { force: true });
    await fs.rm(files.helper, { force: true });
    await fs.rm(files.helperRunner, { force: true });
    await fs.mkdir(files.stage, { recursive: true, mode: 0o700 });
    await fs.mkdir(files.cache, { recursive: true, mode: 0o700 });

    let targetTarball = '';
    let stagedInstallBytes = 0;
    try {
        const packed = await runNpm(nodePath, npmCliPath, [
            'pack',
            MCP_DEVICE_PACKAGE + '@' + targetVersion,
            '--pack-destination', files.stage,
            '--json',
            '--cache', files.cache
        ], execFile);
        targetTarball = tarballFromPackOutput(String(packed.stdout || ''), files.stage) || '';
        if (!targetTarball || !await exists(targetTarball)) {
            throw new Error('npm did not materialize the requested tarball.');
        }

        await runNpm(nodePath, npmCliPath, [
            'install',
            '--prefix', files.verify,
            targetTarball,
            '--cache', files.cache,
            '--no-audit',
            '--no-fund'
        ], execFile);

        await verifyPackageVersion(
            path.join(files.verify, 'node_modules', '@hcu-lab.me', 'mcp-device'),
            targetVersion
        );
        stagedInstallBytes = await directoryByteSize(files.verify);
    } catch (error: any) {
        throw updateError(
            'DEVICE_UPDATE_TARGET_UNAVAILABLE',
            'Target pre-stage failed before shutdown: ' + String(error?.message || error).slice(0, 180)
        );
    } finally {
        await fs.rm(files.verify, { recursive: true, force: true }).catch(() => {});
    }

    // Budget both volumes before copying the rollback snapshot. The staging
    // area may live on a different volume from npm's global prefix.
    const rollbackBytes = await directoryByteSize(packageRoot);
    const rollbackBudget = Math.ceil(rollbackBytes * 1.1) + (16 * 1024 * 1024);
    const installBudget = Math.ceil(stagedInstallBytes * 1.2) + (16 * 1024 * 1024);
    await assertDiskBudgetAt(files.root, rollbackBudget, 'rollback staging');
    await assertDiskBudgetAt(path.dirname(packageRoot), installBudget, 'offline installation');

    // Preserve a complete offline rollback before the live global package is
    // touched. If this cannot be materialized (including ENOSPC), update aborts
    // while the old runtime is still healthy.
    await fs.cp(packageRoot, files.rollbackSnapshot, {
        recursive: true,
        force: true,
        preserveTimestamps: true
    });
    await verifyPackageVersion(files.rollbackSnapshot, fromVersion);

    const rollbackPath = path.join(
        path.dirname(packageRoot),
        '.mcp-device-rollback-' + safeToken(requestId)
    );
    if (await exists(rollbackPath)) {
        throw updateError(
            'DEVICE_UPDATE_ROLLBACK_PRESENT',
            'A rollback package from an earlier update still exists.'
        );
    }

    const state: DeviceUpdateState = {
        schema: UPDATE_STATE_SCHEMA,
        requestId,
        fromVersion,
        targetVersion,
        state: 'prepared',
        startedAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: null,
        errorCode: null,
        message: null,
        deviceId: String(options.deviceId),
        parentPid: process.pid,
        childPid: Number.isInteger(options.childPid) ? Number(options.childPid) : null,
        packageRoot,
        globalPrefix: prefix,
        nodePath,
        npmCliPath,
        targetTarball: path.resolve(targetTarball),
        cacheDir: files.cache,
        rollbackSnapshot: files.rollbackSnapshot,
        rollbackPath,
        helperPath: files.helper,
        handoffPath: files.handoff,
        runtimeOwnerControlPath: runtimeOwnerControlFileFor(paths),
        ...manager
    };

    if (platform === 'win32') {
        state.windowsUpdateTaskName = ('MCP-Device-Update-' + safeToken(requestId)).slice(0, 220);
    } else if (state.managerKind === 'systemd') {
        state.systemdUpdateUnit = ('mcp-device-update-' + safeToken(requestId)).slice(0, 180);
    }

    const helperSource = path.resolve(options.helperSourcePath || helperAssetPath());
    if (!await exists(helperSource)) {
        throw updateError('DEVICE_UPDATE_HELPER_MISSING', 'Standalone update helper asset is missing.');
    }
    await fs.copyFile(helperSource, files.helper);
    try {
        await fs.chmod(files.helper, 0o600);
    } catch {
        // Windows ACLs inherit from the profile.
    }

    let helperRunnerPath: string | undefined;
    if (platform === 'win32') {
        const psQuote = (value: string) => "'" + String(value).replace(/'/g, "''") + "'";
        const runner = [
            "$ErrorActionPreference = 'Stop'",
            '& ' + psQuote(nodePath) + ' ' + psQuote(files.helper) + ' ' + psQuote(files.state),
            'exit $LASTEXITCODE',
            ''
        ].join('\r\n');
        await fs.writeFile(files.helperRunner, runner, { encoding: 'utf8', mode: 0o600 });
        helperRunnerPath = files.helperRunner;
    }

    await writeDeviceUpdateState(state, paths);
    return { state, statePath: files.state, helperRunnerPath };
}

export async function launchDeviceUpdateHelper(
    prepared: PreparedDeviceUpdate,
    options: {
        execFile?: ExecFileFn;
        spawn?: typeof spawnCallback;
        platform?: NodeJS.Platform | string;
        paths?: DeviceStatePaths;
    } = {}
): Promise<void> {
    const execFile = options.execFile || defaultExecFile;
    const spawn = options.spawn || spawnCallback;
    const platform = options.platform || process.platform;
    const paths = options.paths || deviceStatePaths();
    const state = prepared.state;

    try {
        if (platform === 'win32') {
            if (!prepared.helperRunnerPath || !state.powershellPath || !state.windowsUpdateTaskName) {
                throw new Error('Windows update helper task metadata is incomplete.');
            }

            const psQuote = (value: string) => "'" + String(value).replace(/'/g, "''") + "'";
            const actionArgs =
                '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' +
                prepared.helperRunnerPath + '"';
            const command = [
                '$action = New-ScheduledTaskAction -Execute ' + psQuote(state.powershellPath) + ' -Argument ' + psQuote(actionArgs),
                // Demand-start only: no future trigger can replay the helper.
                // Battery settings are explicit so laptops cannot silently queue
                // or terminate the update helper after the device has shut down.
                '$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew',
                'Register-ScheduledTask -TaskName ' + psQuote(state.windowsUpdateTaskName) + ' -Action $action -Settings $settings -Force | Out-Null',
                'Start-ScheduledTask -TaskName ' + psQuote(state.windowsUpdateTaskName)
            ].join('; ');

            await execFile(state.powershellPath, ['-NoProfile', '-NonInteractive', '-Command', command]);
        } else if (state.managerKind === 'systemd') {
            if (!state.systemdRunPath || !state.systemdUpdateUnit) {
                throw new Error('systemd update helper metadata is incomplete.');
            }
            await execFile(state.systemdRunPath, [
                '--user',
                '--collect',
                '--unit=' + state.systemdUpdateUnit,
                state.nodePath,
                state.helperPath,
                prepared.statePath
            ]);
        } else if (state.managerKind === 'pm2') {
            const child = spawn(state.nodePath, [state.helperPath, prepared.statePath], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
        } else {
            throw new Error('Unsupported update manager: ' + state.managerKind);
        }

        await patchDeviceUpdateState({ state: 'helper_started' }, paths);
    } catch (error: any) {
        await patchDeviceUpdateState({
            state: 'failed',
            completedAt: Date.now(),
            errorCode: 'DEVICE_UPDATE_HELPER_LAUNCH_FAILED',
            message: String(error?.message || error).slice(0, 240)
        }, paths).catch(() => {});

        throw updateError(
            'DEVICE_UPDATE_HELPER_LAUNCH_FAILED',
            'Unable to launch update helper safely: ' + String(error?.message || error).slice(0, 180)
        );
    }
}

export async function signalDeviceUpdateHandoff(
    handoff: { childPid?: number | null } = {},
    paths = deviceStatePaths()
): Promise<void> {
    const files = updateFiles(paths);
    const childPid = Number.isInteger(handoff.childPid) ? Number(handoff.childPid) : null;

    // Persist the last observed child PID before exposing the handoff marker.
    // The helper must wait on the child that actually existed immediately
    // before shutdown, not only the PID captured during pre-stage.
    await patchDeviceUpdateState({ state: 'handoff_ready', childPid }, paths);
    await fs.writeFile(files.handoff, JSON.stringify({
        timestamp: Date.now(),
        childPid
    }) + '\n', {
        encoding: 'utf8',
        mode: 0o600
    });
}

export async function markPreparedUpdateFailed(
    code: string,
    message: string,
    paths = deviceStatePaths()
): Promise<void> {
    const current = await readDeviceUpdateState(paths);
    if (!current) return;
    await writeDeviceUpdateState({
        ...current,
        state: 'failed',
        completedAt: Date.now(),
        errorCode: String(code || 'DEVICE_UPDATE_FAILED').slice(0, 64),
        message: String(message || 'Device update failed.').slice(0, 240)
    }, paths);
}

export type UpdateReconciliation =
    | { action: 'none' }
    | { action: 'success'; state: DeviceUpdateState }
    | { action: 'report-failed'; state: DeviceUpdateState };

export async function reconcileDeviceUpdateAfterStart(
    currentVersion = VERSION,
    paths = deviceStatePaths()
): Promise<UpdateReconciliation> {
    const state = await readDeviceUpdateState(paths);
    if (!state) return { action: 'none' };

    // A target-version reconnect is the authoritative success proof,
    // even if the helper died after installing but before persisting its final phase.
    if (state.targetVersion === currentVersion && state.state !== 'failed') {
        return { action: 'success', state };
    }

    if (state.state === 'failed') {
        return { action: 'report-failed', state };
    }

    if (
        state.state === 'prepared' ||
        state.state === 'installed_waiting_reconnect' ||
        isStaleUpdateState(state)
    ) {
        const failed = await markInterruptedUpdateState(
            state,
            state.state === 'installed_waiting_reconnect'
                ? 'DEVICE_UPDATE_VERSION_MISMATCH'
                : 'DEVICE_UPDATE_INTERRUPTED',
            state.state === 'installed_waiting_reconnect'
                ? 'Update restart did not load the expected target package version.'
                : 'MCP Device update did not complete and its persisted state was recovered.',
            paths
        );
        return { action: 'report-failed', state: failed };
    }

    return { action: 'none' };
}

export async function retireDeviceUpdateState(
    state: DeviceUpdateState,
    paths = deviceStatePaths()
): Promise<void> {
    await fs.rm(state.rollbackPath, { recursive: true, force: true }).catch(() => {});
    await fs.rm(paths.update, { recursive: true, force: true });
}
