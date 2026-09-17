import { execFile as execFileCallback } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

import { deviceStatePaths } from './device-state.js';

const execFileAsync = promisify(execFileCallback);
const USER_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

type ExecFileResult = { stdout: string; stderr: string };
type ExecFileFn = (file: string, args: string[]) => Promise<ExecFileResult>;

function psQuote(value: string): string {
    return `'${String(value).split("'").join("''")}'`;
}

function taskSafeDeviceId(deviceId: string): string {
    const value = String(deviceId || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)) throw new Error('Invalid device ID for Windows service.');
    return value;
}

function isMissingRegistrationError(error: any): boolean {
    const message = String(error?.stderr || error?.message || error);
    return /not running|cannot find|does not exist|not exist|cannot find the file/i.test(message);
}

export function buildWindowsTaskName(deviceId: string): string {
    return `MCP-Device-${taskSafeDeviceId(deviceId)}`;
}

function legacyWindowsTaskName(deviceId: string): string {
    return `HCU-Device-${taskSafeDeviceId(deviceId)}`;
}

export function buildWindowsRunnerScript(options: {
    gatewayUrl?: string;
    allowedRoots?: string;
    nodePath: string;
    entrypoint: string;
}): string {
    return [
        "$ErrorActionPreference = 'Stop'",
        `& ${psQuote(options.nodePath)} ${psQuote(options.entrypoint)} --service`,
        'exit $LASTEXITCODE',
        ''
    ].join('\r\n');
}

export type WindowsDeviceServiceStatus = {
    installed: boolean;
    running: boolean;
    autostart: boolean;
    registration: 'task' | 'run' | 'manual' | 'stale';
    taskName: string;
};

export class WindowsDeviceService {
    private platform: NodeJS.Platform | string;
    private execFile: ExecFileFn;
    private runnerPath: string;
    private legacyRunnerPath: string;
    private nodePath: string;
    private entrypoint: string;

    constructor(options: {
        platform?: NodeJS.Platform | string;
        execFile?: ExecFileFn;
        runnerPath?: string;
        legacyRunnerPath?: string;
        nodePath?: string;
        entrypoint?: string;
    } = {}) {
        this.platform = options.platform || process.platform;
        this.execFile = options.execFile || (async (file, args) => {
            const result = await execFileAsync(file, args, { windowsHide: true, encoding: 'utf8' });
            return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
        });
        this.runnerPath = path.resolve(options.runnerPath || path.join(deviceStatePaths().root, 'run-device.ps1'));
        this.legacyRunnerPath = path.resolve(options.legacyRunnerPath || path.join(deviceStatePaths().legacyRoot, 'run-device.ps1'));
        this.nodePath = path.resolve(options.nodePath || process.execPath);
        this.entrypoint = path.resolve(options.entrypoint || process.argv[1]);
    }

    private assertWindows(): void {
        if (this.platform !== 'win32') throw new Error('Background MCP Device lifecycle is currently supported on Windows only.');
    }

    private async runnerExists(): Promise<boolean> {
        try {
            const stat = await fs.stat(this.runnerPath);
            return stat.isFile();
        } catch (error: any) {
            if (error?.code === 'ENOENT') return false;
            throw error;
        }
    }

    private async hasUserRunEntry(taskName: string): Promise<boolean> {
        try {
            await this.execFile('reg.exe', ['query', USER_RUN_KEY, '/v', taskName]);
            return true;
        } catch {
            return false;
        }
    }

    private async scheduledTaskState(taskName: string): Promise<string | null> {
        try {
            const command = `(Get-ScheduledTask -TaskName ${psQuote(taskName)} -ErrorAction Stop).State.ToString()`;
            const result = await this.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
            return String(result.stdout || '').trim();
        } catch {
            return null;
        }
    }

    private async deleteRegistrations(taskName: string): Promise<void> {
        try { await this.execFile('schtasks.exe', ['/Delete', '/F', '/TN', taskName]); }
        catch (error: any) { if (!isMissingRegistrationError(error)) throw error; }
        try { await this.execFile('reg.exe', ['delete', USER_RUN_KEY, '/v', taskName, '/f']); } catch { /* absent is fine */ }
    }

    private commandReferencesLegacyRunner(value: string): boolean {
        const normalize = (text: string) => String(text || '').replace(/\//g, '\\').toLowerCase();
        return normalize(value).includes(normalize(this.legacyRunnerPath));
    }

    private async deleteVerifiedLegacyRegistrations(taskName: string): Promise<void> {
        let scheduledAction: string | null = null;
        try {
            const command = `(Get-ScheduledTask -TaskName ${psQuote(taskName)} -ErrorAction Stop).Actions | ForEach-Object { ($_.Execute + ' ' + $_.Arguments) }`;
            scheduledAction = String((await this.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command])).stdout || '');
        } catch { /* absent scheduled task is fine */ }
        if (scheduledAction !== null && this.commandReferencesLegacyRunner(scheduledAction)) {
            try { await this.execFile('schtasks.exe', ['/Delete', '/F', '/TN', taskName]); }
            catch (error: any) { if (!isMissingRegistrationError(error)) throw error; }
        }

        let runValue: string | null = null;
        try { runValue = String((await this.execFile('reg.exe', ['query', USER_RUN_KEY, '/v', taskName])).stdout || ''); }
        catch { /* absent Run value is fine */ }
        if (runValue !== null && this.commandReferencesLegacyRunner(runValue)) {
            try { await this.execFile('reg.exe', ['delete', USER_RUN_KEY, '/v', taskName, '/f']); }
            catch (error: any) { if (!isMissingRegistrationError(error)) throw error; }
        }
    }

    private async createAutostartRegistration(taskName: string): Promise<'task' | 'run'> {
        const taskAction = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${this.runnerPath}"`;
        try {
            await this.execFile('schtasks.exe', ['/Create', '/F', '/SC', 'ONLOGON', '/TN', taskName, '/TR', taskAction]);
            try { await this.execFile('reg.exe', ['delete', USER_RUN_KEY, '/v', taskName, '/f']); } catch { /* no stale fallback */ }
            return 'task';
        } catch (error: any) {
            const message = String(error?.stderr || error?.message || error);
            if (!/access is denied/i.test(message)) throw error;
            const runCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${this.runnerPath}"`;
            await this.execFile('reg.exe', ['add', USER_RUN_KEY, '/v', taskName, '/t', 'REG_SZ', '/d', runCommand, '/f']);
            return 'run';
        }
    }

    private async startUserProcess(): Promise<void> {
        const command = `Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',${psQuote(this.runnerPath)}) -WindowStyle Hidden`;
        await this.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
    }

    private async userProcessRunning(): Promise<boolean> {
        const command = `$runner = ${psQuote(this.runnerPath)}; if (Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like ('*' + $runner + '*') }) { 'Running' } else { 'Stopped' }`;
        const result = await this.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
        return String(result.stdout || '').trim().toLowerCase() === 'running';
    }

    async install(options: { deviceId: string; gatewayUrl?: string; allowedRoots?: string }): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(options.deviceId);
        const legacyTaskName = legacyWindowsTaskName(options.deviceId);
        const existing = await this.status(options.deviceId).catch(() => null);
        const preserveManual = existing?.installed === true && existing.autostart === false;
        const runner = buildWindowsRunnerScript({ nodePath: this.nodePath, entrypoint: this.entrypoint });
        await fs.mkdir(path.dirname(this.runnerPath), { recursive: true });
        await fs.writeFile(this.runnerPath, runner, { mode: 0o600 });
        await this.deleteVerifiedLegacyRegistrations(legacyTaskName);
        if (preserveManual) {
            await this.deleteRegistrations(taskName);
            return;
        }
        await this.deleteRegistrations(taskName);
        await this.createAutostartRegistration(taskName);
    }

    async setAutostart(deviceId: string, enabled: boolean): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        if (!await this.runnerExists()) throw new Error('Background device is not installed.');
        await this.deleteRegistrations(taskName);
        if (enabled) await this.createAutostartRegistration(taskName);
    }

    async start(deviceId: string): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        if (!await this.runnerExists()) throw new Error('Background device is not installed.');
        const taskState = await this.scheduledTaskState(taskName);
        if (taskState !== null) {
            await this.execFile('schtasks.exe', ['/Run', '/TN', taskName]);
            return;
        }
        if (!await this.userProcessRunning()) await this.startUserProcess();
    }

    async stop(deviceId: string): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        try { await this.execFile('schtasks.exe', ['/End', '/TN', taskName]); }
        catch (error: any) { if (!isMissingRegistrationError(error)) throw error; }
        if (await this.runnerExists() && await this.userProcessRunning()) {
            throw new Error('MCP Device runtime did not accept authenticated stop; refusing PID-only termination.');
        }
    }

    async status(deviceId: string): Promise<WindowsDeviceServiceStatus> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        const installed = await this.runnerExists();
        const taskState = await this.scheduledTaskState(taskName);
        const runEntry = await this.hasUserRunEntry(taskName);
        const running = installed ? await this.userProcessRunning() : false;
        if (!installed && (taskState !== null || runEntry)) {
            return { installed: false, running: false, autostart: true, registration: 'stale', taskName };
        }
        if (taskState !== null) return { installed, running, autostart: true, registration: 'task', taskName };
        if (runEntry) return { installed, running, autostart: true, registration: 'run', taskName };
        return { installed, running, autostart: false, registration: 'manual', taskName };
    }

    async uninstall(deviceId: string): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        const legacyTaskName = legacyWindowsTaskName(deviceId);
        try { await this.stop(deviceId); } catch { /* registration cleanup remains authoritative; runtime is never PID-killed. */ }
        await this.deleteRegistrations(taskName);
        await this.deleteVerifiedLegacyRegistrations(legacyTaskName);
        await fs.rm(this.runnerPath, { force: true });
    }
}
