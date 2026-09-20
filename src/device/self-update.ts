import { execFile as execFileCallback, spawn as spawnCallback } from 'child_process';
import path from 'path';
import { promisify } from 'util';

import { deviceStatePaths } from './device-state.js';
import { buildWindowsTaskName } from './windows-service.js';

const execFileAsync = promisify(execFileCallback);
export const MCP_DEVICE_PACKAGE = '@hcu-lab.me/mcp-device';

export function normalizeUpdateVersion(value: string): string {
    const version = String(value || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Update target must be an exact stable semantic version.');
    return version;
}

export async function installDevicePackageUpdate(targetVersion: string, options: {
    platform?: NodeJS.Platform | string;
    execFile?: (file: string, args: string[]) => Promise<{ stdout?: string; stderr?: string }>;
    npmPath?: string;
} = {}): Promise<string> {
    const version = normalizeUpdateVersion(targetVersion);
    const platform = options.platform || process.platform;
    const execFile = options.execFile || (async (file: string, args: string[]) => {
        const result = await execFileAsync(file, args, { windowsHide: true, encoding: 'utf8' });
        return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
    });
    const npmPath = options.npmPath || (platform === 'win32' ? 'npm.cmd' : 'npm');
    await execFile(npmPath, ['install', '-g', `${MCP_DEVICE_PACKAGE}@${version}`, '--no-audit', '--no-fund']);
    const listed = await execFile(npmPath, ['list', '-g', MCP_DEVICE_PACKAGE, '--depth=0', '--json']);
    let actual = '';
    try { actual = String(JSON.parse(String(listed.stdout || '{}'))?.dependencies?.[MCP_DEVICE_PACKAGE]?.version || ''); }
    catch { throw new Error('Updated package version could not be verified.'); }
    if (actual !== version) throw new Error(`Updated package verification failed: expected ${version}, got ${actual || 'unknown'}.`);
    return actual;
}

function serviceManager(argv: string[]): string {
    const value = argv.find(item => String(item).startsWith('--manager='));
    return value ? String(value).slice('--manager='.length).trim().toLowerCase() : '';
}

export function buildWindowsRestartHelper(deviceId: string, currentPid = process.pid): string {
    const runnerPath = path.join(deviceStatePaths().root, 'run-device.ps1');
    const taskName = buildWindowsTaskName(deviceId);
    const psQuote = (value: string) => `'${String(value).replace(/'/g, "''")}'`;
    return [
        `$oldPid = ${Number(currentPid)}`,
        'for ($i = 0; $i -lt 80; $i++) {',
        "  if (-not (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) { break }",
        '  Start-Sleep -Milliseconds 250',
        '}',
        `$taskName = ${psQuote(taskName)}`,
        `$runner = ${psQuote(runnerPath)}`,
        'if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {',
        '  Start-ScheduledTask -TaskName $taskName',
        '} else {',
        "  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',$runner) -WindowStyle Hidden",
        '}'
    ].join('; ');
}

export function scheduleDeviceRuntimeRestart(options: {
    deviceId: string;
    platform?: NodeJS.Platform | string;
    argv?: string[];
    delayMs?: number;
    spawn?: typeof spawnCallback;
    exit?: (code?: number) => never | void;
}): void {
    const platform = options.platform || process.platform;
    const argv = options.argv || process.argv;
    const delayMs = Math.max(100, Number(options.delayMs ?? 700));
    const exit = options.exit || process.exit;
    if (!argv.includes('--service')) throw new Error('Dashboard updates require an installed background MCP Device service.');

    if (platform === 'linux') {
        const manager = serviceManager(argv);
        if (!['systemd', 'pm2'].includes(manager)) throw new Error('Linux dashboard update requires systemd or PM2 service ownership.');
        const timer = setTimeout(() => exit(75), delayMs);
        timer.unref?.();
        return;
    }

    if (platform === 'win32') {
        const spawn = options.spawn || spawnCallback;
        const helper = buildWindowsRestartHelper(options.deviceId);
        const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', helper], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();
        const timer = setTimeout(() => exit(0), delayMs);
        timer.unref?.();
        return;
    }

    throw new Error('Dashboard self-update is supported only on installed Windows and Linux devices.');
}
