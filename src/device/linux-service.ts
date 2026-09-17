import { execFile as execFileCallback } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import readline from 'readline/promises';
import { promisify } from 'util';

const execFileAsync = promisify(execFileCallback);
const SYSTEMD_UNIT = 'mcp-device.service';
const SYSTEMD_OWNER_MARKER = '# Managed by MCP Device';
const PM2_NAME = 'mcp-device';

type ExecFileResult = { stdout: string; stderr: string };
type ExecFileFn = (file: string, args: string[]) => Promise<ExecFileResult>;
export type LinuxManager = 'systemd' | 'pm2';
export type LinuxServiceStatus = { installed: boolean; running: boolean; autostart: boolean; manager: LinuxManager };

async function defaultExecFile(file: string, args: string[]): Promise<ExecFileResult> {
    const result = await execFileAsync(file, args, { windowsHide: true, encoding: 'utf8' });
    return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
}

function quoteSystemdArg(value: string): string {
    if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
    return `"${value.replace(/([\\"])/g, '\\$1')}"`;
}

function defaultUnitPath(): string {
    const configHome = String(process.env.XDG_CONFIG_HOME || '').trim() || path.join(os.homedir(), '.config');
    return path.join(configHome, 'systemd', 'user', SYSTEMD_UNIT);
}

function guidance(): string {
    return 'Run `pm2 startup` for this user and complete the printed setup, then retry; or choose the systemd-user alternative.';
}

export async function chooseLinuxManager({ ask }: { ask?: () => Promise<string> } = {}): Promise<LinuxManager> {
    let answer: string;
    if (ask) answer = await ask();
    else {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            throw new Error('Linux install requires an interactive manager choice: systemd-user or PM2.');
        }
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        try { answer = await rl.question('Background manager [systemd/pm2] (systemd): '); }
        finally { rl.close(); }
    }
    const value = String(answer || '').trim().toLowerCase();
    if (!value || ['systemd', 'systemd-user', 'systemd_user', '1'].includes(value)) return 'systemd';
    if (['pm2', '2'].includes(value)) return 'pm2';
    throw new Error('Choose `systemd` or `pm2`.');
}

export class SystemdUserDeviceService {
    private platform: NodeJS.Platform | string;
    private execFile: ExecFileFn;
    readonly unitPath: string;
    private nodePath: string;
    private entrypoint: string;
    private pathValue: string;

    constructor(options: {
        platform?: NodeJS.Platform | string;
        execFile?: ExecFileFn;
        unitPath?: string;
        nodePath?: string;
        entrypoint?: string;
        pathValue?: string;
    } = {}) {
        this.platform = options.platform || process.platform;
        this.execFile = options.execFile || defaultExecFile;
        this.unitPath = path.resolve(options.unitPath || defaultUnitPath());
        this.nodePath = options.platform === 'linux' && options.nodePath ? String(options.nodePath) : path.resolve(options.nodePath || process.execPath);
        this.entrypoint = options.platform === 'linux' && options.entrypoint ? String(options.entrypoint) : path.resolve(options.entrypoint || process.argv[1]);
        this.pathValue = String(options.pathValue ?? process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin');
    }

    private assertLinux(): void {
        if (this.platform !== 'linux') throw new Error('systemd-user lifecycle is supported on Linux only.');
    }

    private async unitExists(): Promise<boolean> {
        try { return (await fs.stat(this.unitPath)).isFile(); }
        catch (error: any) { if (error?.code === 'ENOENT') return false; throw error; }
    }

    private async assertOwnedUnitIfPresent(): Promise<boolean> {
        if (!await this.unitExists()) return false;
        const text = await fs.readFile(this.unitPath, 'utf8');
        if (!text.includes(SYSTEMD_OWNER_MARKER)) {
            throw new Error(`systemd ownership conflict: ${this.unitPath} is not owned by MCP Device.`);
        }
        return true;
    }

    private unitText(): string {
        return [
            SYSTEMD_OWNER_MARKER,
            '[Unit]',
            'Description=MCP Device',
            'After=network-online.target',
            '',
            '[Service]',
            'Type=simple',
            `Environment="PATH=${this.pathValue.replace(/["\\]/g, match => `\\${match}`)}"`,
            `ExecStart=${quoteSystemdArg(this.nodePath)} ${quoteSystemdArg(this.entrypoint)} --service --manager=systemd`,
            'Restart=on-failure',
            'RestartSec=3',
            '',
            '[Install]',
            'WantedBy=default.target',
            ''
        ].join('\n');
    }

    async install(): Promise<void> {
        this.assertLinux();
        await this.assertOwnedUnitIfPresent();
        await this.execFile('systemctl', ['--user', 'show-environment']);
        await fs.mkdir(path.dirname(this.unitPath), { recursive: true });
        await fs.writeFile(this.unitPath, this.unitText(), { mode: 0o600 });
        await this.execFile('systemctl', ['--user', 'daemon-reload']);
        await this.execFile('systemctl', ['--user', 'enable', '--now', SYSTEMD_UNIT]);
        const status = await this.status();
        if (!status.autostart || !status.running) throw new Error('systemd-user did not become enabled and active.');
    }

    async stop(): Promise<void> {
        this.assertLinux();
        if (await this.assertOwnedUnitIfPresent()) await this.execFile('systemctl', ['--user', 'stop', SYSTEMD_UNIT]);
    }

    async status(): Promise<LinuxServiceStatus> {
        this.assertLinux();
        if (!await this.assertOwnedUnitIfPresent()) return { installed: false, running: false, autostart: false, manager: 'systemd' };
        let autostart = false;
        let running = false;
        try { autostart = /enabled|static/i.test(String((await this.execFile('systemctl', ['--user', 'is-enabled', SYSTEMD_UNIT])).stdout)); } catch {}
        try { running = /^active$/i.test(String((await this.execFile('systemctl', ['--user', 'is-active', SYSTEMD_UNIT])).stdout).trim()); } catch {}
        return { installed: true, running, autostart, manager: 'systemd' };
    }

    async uninstall(): Promise<void> {
        this.assertLinux();
        if (await this.assertOwnedUnitIfPresent()) {
            try { await this.execFile('systemctl', ['--user', 'disable', '--now', SYSTEMD_UNIT]); } catch {}
            await fs.rm(this.unitPath, { force: true });
            await this.execFile('systemctl', ['--user', 'daemon-reload']);
        }
    }
}

export class Pm2DeviceService {
    private platform: NodeJS.Platform | string;
    private execFile: ExecFileFn;
    private pm2Path: string;
    private nodePath: string;
    private entrypoint: string;
    private user: string;
    private pm2Home: string;

    constructor(options: {
        platform?: NodeJS.Platform | string;
        execFile?: ExecFileFn;
        pm2Path?: string;
        nodePath?: string;
        entrypoint?: string;
        user?: string;
        pm2Home?: string;
    } = {}) {
        this.platform = options.platform || process.platform;
        this.execFile = options.execFile || defaultExecFile;
        this.pm2Path = options.pm2Path || 'pm2';
        this.nodePath = options.platform === 'linux' && options.nodePath ? String(options.nodePath) : path.resolve(options.nodePath || process.execPath);
        this.entrypoint = options.platform === 'linux' && options.entrypoint ? String(options.entrypoint) : path.resolve(options.entrypoint || process.argv[1]);
        this.user = String(options.user || process.env.USER || process.env.LOGNAME || os.userInfo().username);
        this.pm2Home = options.platform === 'linux' && options.pm2Home ? String(options.pm2Home) : path.resolve(options.pm2Home || process.env.PM2_HOME || path.join(os.homedir(), '.pm2'));
    }

    private assertLinux(): void {
        if (this.platform !== 'linux') throw new Error('PM2 lifecycle is supported on Linux only.');
    }

    private async processRow(): Promise<any | null> {
        let rows: any[];
        try { rows = JSON.parse(String((await this.execFile(this.pm2Path, ['jlist'])).stdout || '[]')); }
        catch { return null; }
        return Array.isArray(rows) ? rows.find(item => item?.name === PM2_NAME) || null : null;
    }

    private assertOwnedProcess(row: any): void {
        if (!row) return;
        const env = row?.pm2_env || {};
        const execPath = String(env.pm_exec_path || '').replace(/\\/g, '/');
        const interpreter = String(env.exec_interpreter || '').replace(/\\/g, '/');
        const args = Array.isArray(env.args) ? env.args.map((value: unknown) => String(value)) : [];
        if (execPath !== this.entrypoint.replace(/\\/g, '/') ||
            interpreter !== this.nodePath.replace(/\\/g, '/') ||
            !args.includes('--service') || !args.includes('--manager=pm2')) {
            throw new Error('PM2 ownership conflict: process named mcp-device is not owned by this MCP Device installation.');
        }
    }

    private async proveStartup(): Promise<void> {
        this.assertLinux();
        try { await this.execFile(this.pm2Path, ['--version']); }
        catch { throw new Error(`PM2 is not available for the current user. ${guidance()}`); }
        const unit = `pm2-${this.user}.service`;
        let evidence = '';
        try {
            evidence = String((await this.execFile('systemctl', ['show', unit, '--property=FragmentPath,ExecStart,Environment', '--no-pager'])).stdout || '');
        } catch {
            try { evidence = String((await this.execFile('systemctl', ['--user', 'show', unit, '--property=FragmentPath,ExecStart,Environment', '--no-pager'])).stdout || ''); }
            catch { throw new Error(`PM2 startup integration is not proven. ${guidance()}`); }
        }
        const normalized = evidence.replace(/\\/g, '/');
        const home = this.pm2Home.replace(/\\/g, '/');
        if (!/pm2/i.test(normalized) || !/resurrect/i.test(normalized) || !normalized.includes(home)) {
            throw new Error(`PM2 startup integration does not match this user/PM2_HOME. ${guidance()}`);
        }
    }

    async install(): Promise<void> {
        await this.proveStartup();
        const existing = await this.processRow();
        this.assertOwnedProcess(existing);
        if (!existing) {
            await this.execFile(this.pm2Path, ['start', this.entrypoint, '--name', PM2_NAME, '--interpreter', this.nodePath, '--', '--service', '--manager=pm2']);
        } else if (String(existing?.pm2_env?.status || '').toLowerCase() !== 'online') {
            await this.execFile(this.pm2Path, ['restart', PM2_NAME]);
        }
        await this.execFile(this.pm2Path, ['save']);
        const status = await this.status();
        if (!status.running) throw new Error('PM2 process did not become online.');
    }

    async stop(): Promise<void> {
        this.assertLinux();
        const row = await this.processRow();
        this.assertOwnedProcess(row);
        if (row) await this.execFile(this.pm2Path, ['stop', PM2_NAME]);
    }

    async status(): Promise<LinuxServiceStatus> {
        this.assertLinux();
        const row = await this.processRow();
        if (!row) return { installed: false, running: false, autostart: true, manager: 'pm2' };
        this.assertOwnedProcess(row);
        return {
            installed: true,
            running: String(row?.pm2_env?.status || '').toLowerCase() === 'online',
            autostart: true,
            manager: 'pm2'
        };
    }

    async uninstall(): Promise<void> {
        this.assertLinux();
        const row = await this.processRow();
        this.assertOwnedProcess(row);
        if (!row) return;
        await this.execFile(this.pm2Path, ['delete', PM2_NAME]);
        await this.execFile(this.pm2Path, ['save']);
    }
}

export async function discoverLinuxManagers(options: {
    systemd?: SystemdUserDeviceService;
    pm2?: Pm2DeviceService;
} = {}): Promise<LinuxServiceStatus[]> {
    if (process.platform !== 'linux') return [];
    const systemd = options.systemd || new SystemdUserDeviceService();
    const pm2 = options.pm2 || new Pm2DeviceService();
    const results: LinuxServiceStatus[] = [];
    const systemdStatus = await systemd.status().catch(() => ({ installed: false, running: false, autostart: false, manager: 'systemd' as const }));
    const pm2Status = await pm2.status().catch(() => ({ installed: false, running: false, autostart: false, manager: 'pm2' as const }));
    if (systemdStatus.installed) results.push(systemdStatus);
    if (pm2Status.installed) results.push(pm2Status);
    return results;
}
