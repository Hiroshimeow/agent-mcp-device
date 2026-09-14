import { execFile as execFileCallback } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

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

export function buildWindowsTaskName(deviceId: string): string {
    return `DesktopCommander-MCP-Device-${taskSafeDeviceId(deviceId)}`;
}

export function buildWindowsRunnerScript(options: {
    gatewayUrl: string;
    allowedRoots?: string;
    nodePath: string;
    entrypoint: string;
}): string {
    const gatewayUrl = String(options.gatewayUrl || '').trim();
    if (!/^https?:\/\//i.test(gatewayUrl) && !/^wss?:\/\//i.test(gatewayUrl)) throw new Error('Gateway URL is required for Windows service.');
    const allowedRoots = String(options.allowedRoots || '').trim();
    return [
        "$ErrorActionPreference = 'Stop'",
        `$env:MCP_GATEWAY_URL = ${psQuote(gatewayUrl)}`,
        ...(allowedRoots ? [`$env:MCP_GATEWAY_ALLOWED_ROOTS = ${psQuote(allowedRoots)}`] : []),
        `& ${psQuote(options.nodePath)} ${psQuote(options.entrypoint)} remote --service`,
        'exit $LASTEXITCODE',
        ''
    ].join('\r\n');
}

export class WindowsDeviceService {
    private platform: NodeJS.Platform | string;
    private execFile: ExecFileFn;
    private runnerPath: string;
    private nodePath: string;
    private entrypoint: string;

    constructor(options: {
        platform?: NodeJS.Platform | string;
        execFile?: ExecFileFn;
        runnerPath?: string;
        nodePath?: string;
        entrypoint?: string;
    } = {}) {
        this.platform = options.platform || process.platform;
        this.execFile = options.execFile || (async (file, args) => {
            const result = await execFileAsync(file, args, { windowsHide: true, encoding: 'utf8' });
            return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
        });
        this.runnerPath = path.resolve(options.runnerPath || path.join(os.homedir(), '.desktop-commander-device', 'run-gateway-device.ps1'));
        this.nodePath = path.resolve(options.nodePath || process.execPath);
        this.entrypoint = path.resolve(options.entrypoint || process.argv[1]);
    }

    private assertWindows(): void {
        if (this.platform !== 'win32') throw new Error('Background remote service lifecycle is currently supported on Windows only.');
    }

    private async hasUserRunEntry(taskName: string): Promise<boolean> {
        try {
            await this.execFile('reg.exe', ['query', USER_RUN_KEY, '/v', taskName]);
            return true;
        } catch {
            return false;
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

    private async stopUserProcess(): Promise<void> {
        const command = `$runner = ${psQuote(this.runnerPath)}; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like ('*' + $runner + '*') } | ForEach-Object { & taskkill.exe /PID $_.ProcessId /T /F | Out-Null }`;
        await this.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
    }

    async install(options: { deviceId: string; gatewayUrl: string; allowedRoots?: string }): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(options.deviceId);
        const runner = buildWindowsRunnerScript({
            gatewayUrl: options.gatewayUrl,
            allowedRoots: options.allowedRoots,
            nodePath: this.nodePath,
            entrypoint: this.entrypoint
        });
        await fs.mkdir(path.dirname(this.runnerPath), { recursive: true });
        await fs.writeFile(this.runnerPath, runner, { mode: 0o600 });
        const taskAction = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${this.runnerPath}"`;
        try {
            await this.execFile('schtasks.exe', ['/Create', '/F', '/SC', 'ONLOGON', '/TN', taskName, '/TR', taskAction]);
            try { await this.execFile('reg.exe', ['delete', USER_RUN_KEY, '/v', taskName, '/f']); } catch { /* no stale fallback */ }
        } catch (error: any) {
            const message = String(error?.stderr || error?.message || error);
            if (!/access is denied/i.test(message)) throw error;
            const runCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${this.runnerPath}"`;
            await this.execFile('reg.exe', ['add', USER_RUN_KEY, '/v', taskName, '/t', 'REG_SZ', '/d', runCommand, '/f']);
        }
    }

    async start(deviceId: string): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        try {
            await this.execFile('schtasks.exe', ['/Run', '/TN', taskName]);
            return;
        } catch (error: any) {
            if (!await this.hasUserRunEntry(taskName)) throw error;
        }
        if (!await this.userProcessRunning()) await this.startUserProcess();
    }

    async stop(deviceId: string): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        let scheduledError: any = null;
        try { await this.execFile('schtasks.exe', ['/End', '/TN', taskName]); }
        catch (error: any) {
            const message = String(error?.stderr || error?.message || error);
            if (!/not running|cannot find|does not exist|cannot find the file/i.test(message)) scheduledError = error;
        }
        const hasFallback = await this.hasUserRunEntry(taskName);
        if (hasFallback) await this.stopUserProcess();
        else if (scheduledError) throw scheduledError;
    }

    async status(deviceId: string): Promise<{ installed: boolean; running: boolean; taskName: string }> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        try {
            const command = `(Get-ScheduledTask -TaskName ${psQuote(taskName)} -ErrorAction Stop).State.ToString()`;
            const result = await this.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
            return { installed: true, running: String(result.stdout || '').trim().toLowerCase() === 'running', taskName };
        } catch {
            if (!await this.hasUserRunEntry(taskName)) return { installed: false, running: false, taskName };
            return { installed: true, running: await this.userProcessRunning(), taskName };
        }
    }

    async uninstall(deviceId: string): Promise<void> {
        this.assertWindows();
        const taskName = buildWindowsTaskName(deviceId);
        try { await this.stop(deviceId); } catch { /* deletion remains authoritative */ }
        try { await this.execFile('schtasks.exe', ['/Delete', '/F', '/TN', taskName]); }
        catch (error: any) {
            const message = String(error?.stderr || error?.message || error);
            if (!/cannot find|does not exist|not exist|cannot find the file/i.test(message)) throw error;
        }
        try { await this.execFile('reg.exe', ['delete', USER_RUN_KEY, '/v', taskName, '/f']); } catch { /* fallback may not exist */ }
        await fs.rm(this.runnerPath, { force: true });
    }
}
