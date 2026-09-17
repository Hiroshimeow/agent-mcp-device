import { spawn } from 'child_process';

type DpapiLabel = 'identity' | 'proxy';
type PowerShellRunner = (script: string, input: string) => Promise<string>;

const ENTROPY: Record<DpapiLabel, string> = {
    identity: 'hcu-device-identity-private-key-v1',
    proxy: 'hcu-device-proxy-url-v1'
};

function assertLabel(label: string): asserts label is DpapiLabel {
    if (!(label in ENTROPY)) throw new Error('Unsupported DPAPI secret label.');
}

async function runPowerShell(script: string, input: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
        child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)));
        child.once('error', reject);
        child.once('close', code => {
            if (code !== 0) {
                reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `DPAPI PowerShell failed with exit code ${code}`));
                return;
            }
            resolve(Buffer.concat(stdout).toString('utf8').trim());
        });
        child.stdin.end(input, 'utf8');
    });
}

function dpapiScript(action: 'Protect' | 'Unprotect', label: DpapiLabel): string {
    const entropy = Buffer.from(ENTROPY[label], 'utf8').toString('base64');
    return [
        "$ErrorActionPreference = 'Stop'",
        'Add-Type -AssemblyName System.Security',
        '$inputB64 = [Console]::In.ReadToEnd().Trim()',
        '$data = [Convert]::FromBase64String($inputB64)',
        `$entropy = [Convert]::FromBase64String('${entropy}')`,
        '$scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser',
        `$output = [System.Security.Cryptography.ProtectedData]::${action}($data, $entropy, $scope)`,
        '[Console]::Out.Write([Convert]::ToBase64String($output))'
    ].join('; ');
}

export async function protectWindowsSecret(
    secret: Buffer | Uint8Array | string,
    label: DpapiLabel,
    options: { platform?: NodeJS.Platform | string; runner?: PowerShellRunner } = {}
): Promise<string> {
    const platform = options.platform || process.platform;
    if (platform !== 'win32') throw new Error('Windows DPAPI is only available on Windows.');
    assertLabel(label);
    const bytes = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : Buffer.from(secret);
    const output = await (options.runner || runPowerShell)(dpapiScript('Protect', label), bytes.toString('base64'));
    if (!output) throw new Error('Windows DPAPI returned an empty protected value.');
    return output;
}

export async function unprotectWindowsSecret(
    blob: string,
    label: DpapiLabel,
    options: { platform?: NodeJS.Platform | string; runner?: PowerShellRunner } = {}
): Promise<Buffer> {
    const platform = options.platform || process.platform;
    if (platform !== 'win32') throw new Error('Windows DPAPI is only available on Windows.');
    assertLabel(label);
    const input = String(blob || '').trim();
    if (!input) throw new Error('Windows DPAPI protected value is empty.');
    const output = await (options.runner || runPowerShell)(dpapiScript('Unprotect', label), input);
    if (!output) throw new Error('Windows DPAPI returned an empty unprotected value.');
    return Buffer.from(output, 'base64');
}
