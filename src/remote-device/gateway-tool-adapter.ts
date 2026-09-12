import { exec } from 'child_process';
import { promisify } from 'util';

import { commandManager } from '../command-manager.js';
import { configManager } from '../config-manager.js';
import { validatePath } from '../tools/filesystem.js';
import { DesktopCommanderIntegration } from './desktop-commander-integration.js';

const execAsync = promisify(exec);

export const GATEWAY_CAPABILITIES = [
    'read_text_file',
    'write_file',
    'edit_file',
    'shell_execute',
    'start_process',
    'read_process_output',
    'interact_with_process',
    'terminate_process'
] as const;

function textFromResult(result: any): string {
    return (result?.content || [])
        .filter((item: any) => item?.type === 'text')
        .map((item: any) => String(item.text || ''))
        .join('\n');
}

function assertSuccess(result: any, tool: string): any {
    if (result?.isError) throw new Error(textFromResult(result) || `${tool} failed`);
    return result;
}

function parsePid(result: any): number {
    const match = textFromResult(result).match(/PID\s+(-?\d+)/i);
    const pid = Number(match?.[1]);
    if (!Number.isInteger(pid)) throw new Error('Desktop Commander did not return a process PID');
    return pid;
}
async function runShell(args: any) {
    const command = String(args.command || '');
    if (!await commandManager.validateCommand(command)) throw new Error(`Command not allowed: ${command}`);
    const cwd = args.working_directory
        ? await validatePath(String(args.working_directory))
        : process.cwd();
    const config = await configManager.getConfig();
    const timeoutMs = Number(args.timeout_ms || 28000);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 28000) {
        throw new Error('Remote shell_execute timeout_ms must be between 1 and 28000');
    }
    const started = Date.now();
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd,
            shell: config.defaultShell || undefined,
            timeout: timeoutMs,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
            encoding: 'utf8'
        });
        return {
            workingDirectoryResolved: cwd,
            exitCode: 0,
            stdout,
            stderr,
            stderrClassification: stderr ? 'warning' : 'none',
            durationMs: Date.now() - started,
            timedOut: false,
            stdoutTruncated: false,
            stderrTruncated: false,
            stdoutSpillPath: null,
            stderrSpillPath: null
        };
    } catch (error: any) {
        const timedOut = error?.killed === true && error?.signal;
        return {
            workingDirectoryResolved: cwd,
            exitCode: timedOut ? 124 : Number.isInteger(error?.code) ? error.code : 1,
            stdout: String(error?.stdout || ''),
            stderr: String(error?.stderr || error?.message || ''),
            stderrClassification: 'error',
            durationMs: Date.now() - started,
            timedOut: Boolean(timedOut),
            stdoutTruncated: false,
            stderrTruncated: false,
            stdoutSpillPath: null,
            stderrSpillPath: null
        };
    }
}
export class GatewayToolAdapter {
    constructor(private desktop: DesktopCommanderIntegration) {}

    async call(tool: string, args: any = {}): Promise<any> {
        if (tool === 'read_text_file') {
            if (args.head !== undefined && args.tail !== undefined) throw new Error('Use either head or tail, not both');
            const mapped: any = { path: args.path };
            if (args.head !== undefined) {
                mapped.offset = 0;
                mapped.length = Number(args.head);
            } else if (args.tail !== undefined) {
                mapped.offset = -Number(args.tail);
            }
            return assertSuccess(await this.desktop.callClientTool('read_file', mapped), 'read_file');
        }
        if (tool === 'write_file') {
            return assertSuccess(await this.desktop.callClientTool('write_file', {
                path: args.path,
                content: args.content,
                mode: 'rewrite'
            }), 'write_file');
        }
        if (tool === 'edit_file') return await this.editFile(args);
        if (tool === 'shell_execute') return await runShell(args);
        if (tool === 'start_process') {
            const result = assertSuccess(await this.desktop.callClientTool('start_process', {
                command: args.command,
                timeout_ms: Number(args.timeout_ms || 10000),
                ...(args.working_directory ? { working_directory: String(args.working_directory) } : {})
            }), 'start_process');
            return { ...result, pid: parsePid(result), session_id: String(parsePid(result)) };
        }
        if (tool === 'read_process_output') {
            return assertSuccess(await this.desktop.callClientTool('read_process_output', {
                pid: Number(args.session_id),
                offset: args.offset,
                length: args.length,
                timeout_ms: 5000
            }), 'read_process_output');
        }
        if (tool === 'interact_with_process') {
            return assertSuccess(await this.desktop.callClientTool('interact_with_process', {
                pid: Number(args.session_id),
                input: String(args.input ?? ''),
                timeout_ms: Number(args.timeout_ms || 8000)
            }), 'interact_with_process');
        }
        if (tool === 'terminate_process') {
            return assertSuccess(await this.desktop.callClientTool('force_terminate', {
                pid: Number(args.session_id)
            }), 'force_terminate');
        }
        throw new Error(`Unsupported gateway capability: ${tool}`);
    }

    private async editFile(args: any): Promise<any> {
        if (Array.isArray(args.edits)) {
            let result: any = null;
            for (const edit of args.edits) {
                result = assertSuccess(await this.desktop.callClientTool('edit_block', {
                    file_path: args.path,
                    old_string: edit.oldText,
                    new_string: edit.newText,
                    expected_replacements: edit.expected_replacements || 1
                }), 'edit_block');
            }
            return result;
        }
        if (args.dry_run === true) {
            const read = assertSuccess(await this.desktop.callClientTool('read_file', {
                path: args.path,
                offset: 0,
                length: 100000
            }), 'read_file');
            const source = textFromResult(read);
            const needle = String(args.old_text || '');
            const count = needle ? source.split(needle).length - 1 : 0;
            return {
                content: [{ type: 'text', text: JSON.stringify({
                    ok: count === Number(args.expected_replacements || 1),
                    dryRun: true,
                    expectedReplacements: Number(args.expected_replacements || 1),
                    actualCount: count
                }) }]
            };
        }
        return assertSuccess(await this.desktop.callClientTool('edit_block', {
            file_path: args.path,
            old_string: args.old_text,
            new_string: args.new_text,
            expected_replacements: Number(args.expected_replacements || 1)
        }), 'edit_block');
    }
}
