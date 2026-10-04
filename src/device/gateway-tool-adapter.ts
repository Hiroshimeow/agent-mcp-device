import { exec, execFile } from 'child_process';
import fs from 'fs/promises';
import { promisify } from 'util';
import path from 'path';
import sharp from 'sharp';

import { commandManager } from '../command-manager.js';
import { configManager } from '../config-manager.js';
import { validatePath } from '../tools/filesystem.js';
import { inspectProjectOnDevice } from './project-inspection.js';
import { dispatchToolCall } from '../tool-dispatcher.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const MAX_REMOTE_IMAGE_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_REMOTE_IMAGE_PREVIEW_BYTES = 32 * 1024;
const IMAGE_PREVIEW_ATTEMPTS = [
    { size: 512, quality: 65 },
    { size: 384, quality: 55 },
    { size: 256, quality: 45 },
    { size: 160, quality: 35 }
] as const;

export const GATEWAY_CAPABILITIES = [
    'read_text_file',
    'write_file',
    'edit_file',
    'shell_execute',
    'start_process',
    'read_process_output',
    'interact_with_process',
    'terminate_process',
    'image_preview',
    'project_inspect'
] as const;

export interface GatewayToolAdapterOptions {
    allowedRoots?: string[];
    pathValidator?: (requestedPath: string) => Promise<string>;
}

function configuredGatewayRoots(): string[] {
    const raw = process.env.MCP_GATEWAY_ALLOWED_ROOTS || '';
    if (!raw.trim()) return [];
    return raw
        .split(path.delimiter)
        .map(entry => entry.trim())
        .filter(Boolean);
}

function isWithinRoot(candidate: string, root: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function parsePid(result: any): number | null {
    if (!result || typeof result !== 'object') return null;
    const directPid = Number((result as any).pid);
    if (Number.isInteger(directPid) && directPid > 0) return directPid;
    for (const item of (result as any).content || []) {
        if (typeof item?.text !== 'string') continue;
        const match = item.text.match(/Process started with PID (\d+)/i)
            || item.text.match(/"pid"\s*:\s*(\d+)/i)
            || item.text.match(/\bPID\s*[:=]?\s*(\d+)\b/i);
        if (match) return Number(match[1]);
    }
    return null;
}

function assertSuccess(result: any, toolName: string): any {
    if (result && result.isError) {
        const message = (result.content || [])
            .map((item: any) => item?.text)
            .filter(Boolean)
            .join('\n') || `Tool execution failed: ${toolName}`;
        const error: Error & { code?: string } = new Error(message);
        error.code = 'TOOL_EXECUTION_FAILED';
        throw error;
    }
    return result;
}

async function runShell(args: any): Promise<any> {
    const command = String(args.command || '');
    if (!command.trim()) throw new Error('command is required');
    const cwd = String(args.working_directory || process.cwd());
    const timeoutMs = Math.max(1000, Math.min(10 * 60 * 1000, Number(args.timeout_ms || 30000)));
    const shell = process.env.SHELL || (process.platform === 'win32' ? process.env.COMSPEC || 'cmd.exe' : '/bin/sh');
    const shellName = path.basename(shell).toLowerCase();

    try {
        const options = {
            cwd,
            timeout: timeoutMs,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
            encoding: 'utf8' as BufferEncoding
        };
        const result = shellName === 'powershell' || shellName === 'powershell.exe' || shellName === 'pwsh' || shellName === 'pwsh.exe'
            ? await execFileAsync(shell!, ['-NoProfile', '-NonInteractive', '-Command', command], options)
            : await execAsync(command, { ...options, shell });
        const { stdout, stderr } = result;
        return {
            workingDirectoryResolved: cwd,
            exitCode: 0,
            stdout,
            stderr,
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
            timedOut: Boolean(timedOut),
            stdoutTruncated: false,
            stderrTruncated: false,
            stdoutSpillPath: null,
            stderrSpillPath: null
        };
    }
}

export class GatewayToolAdapter {
    private allowedRoots: string[];
    private pathValidator: (requestedPath: string) => Promise<string>;
    private canonicalRoots?: Promise<string[]>;

    constructor(_unusedEngine?: any, options: GatewayToolAdapterOptions = {}) {
        this.allowedRoots = options.allowedRoots ?? configuredGatewayRoots();
        this.pathValidator = options.pathValidator ?? validatePath;
    }

    private parseSessionPid(sessionId: unknown, tool: string): number {
        let pid = NaN;
        if (typeof sessionId === 'number') pid = sessionId;
        else if (typeof sessionId === 'string') pid = Number(sessionId);
        const validFormat = typeof sessionId === 'number'
            || (typeof sessionId === 'string' && /^[1-9]\d*$/.test(sessionId) && sessionId === String(pid));
        if (!validFormat || !Number.isSafeInteger(pid) || pid <= 0) {
            throw new Error(`Invalid session_id provided for ${tool}: must be a positive integer`);
        }
        return pid;
    }

    private async guardPath(requestedPath: unknown): Promise<string> {
        const value = String(requestedPath || '').trim();
        if (!value) throw new Error('Remote device path/working_directory is required');
        const candidate = await this.pathValidator(value);
        if (!this.allowedRoots.length) return candidate;
        this.canonicalRoots ??= Promise.all(this.allowedRoots.map(root => this.pathValidator(root)));
        const roots = await this.canonicalRoots;
        if (!roots.some(root => isWithinRoot(candidate, root))) {
            throw new Error('Remote device path is outside MCP_GATEWAY_ALLOWED_ROOTS');
        }
        return candidate;
    }

    private async imagePreview(args: any): Promise<any> {
        const requestedPath = args.path || args.file || args.sourcePath;
        const filePath = await this.guardPath(requestedPath);
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) throw new Error('Remote image preview path is not a file');
        const requestedMaxBytes = Number(args.maxBytes ?? 8 * 1024 * 1024);
        const maxBytes = Number.isFinite(requestedMaxBytes)
            ? Math.max(1, Math.min(MAX_REMOTE_IMAGE_SOURCE_BYTES, Math.floor(requestedMaxBytes)))
            : 8 * 1024 * 1024;
        if (stat.size > maxBytes) throw new Error(`Remote image source exceeds maxBytes (${stat.size} > ${maxBytes})`);

        const includeImage = Boolean(args.embed ?? args.includeImage ?? args.includeData ?? true);
        const source = sharp(filePath, { animated: false, limitInputPixels: 64 * 1024 * 1024 });
        const metadata = await source.metadata();
        const text = {
            ok: true,
            tool: 'image_preview',
            summary: includeImage ? 'Loaded bounded remote image preview.' : 'Loaded remote image metadata.',
            data: {
                path: filePath,
                bytes: stat.size,
                width: metadata.width ?? null,
                height: metadata.height ?? null,
                format: metadata.format ?? null,
                space: metadata.space ?? null,
                channels: metadata.channels ?? null,
                hasAlpha: metadata.hasAlpha ?? false
            }
        };

        if (!includeImage) {
            return {
                content: [{ type: 'text', text: JSON.stringify(text) }]
            };
        }

        let bestBuffer: Buffer | null = null;
        let bestFormat = 'jpeg';
        for (const attempt of IMAGE_PREVIEW_ATTEMPTS) {
            const buffer = await sharp(filePath, { animated: false, limitInputPixels: 64 * 1024 * 1024 })
                .resize({ width: attempt.size, height: attempt.size, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: attempt.quality, mozjpeg: true })
                .toBuffer();
            if (buffer.length <= MAX_REMOTE_IMAGE_PREVIEW_BYTES) {
                bestBuffer = buffer;
                bestFormat = 'jpeg';
                break;
            }
        }

        if (!bestBuffer) {
            bestBuffer = await sharp(filePath, { animated: false, limitInputPixels: 64 * 1024 * 1024 })
                .resize({ width: 128, height: 128, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 25 })
                .toBuffer();
            bestFormat = 'webp';
        }

        return {
            content: [
                { type: 'text', text: JSON.stringify(text) },
                {
                    type: 'image',
                    data: bestBuffer.toString('base64'),
                    mimeType: `image/${bestFormat}`
                }
            ]
        };
    }

    async call(tool: string, args: any = {}): Promise<any> {
        const dispatch = async (name: string, toolArgs: any) => {
            const res = await dispatchToolCall(name, toolArgs, { isRemote: true });
            return assertSuccess(res, name);
        };

        if (tool === 'read_text_file') {
            return await dispatch('read_file', {
                path: await this.guardPath(args.path),
                offset: Number(args.offset ?? 0),
                length: Number(args.length ?? 200)
            });
        }
        if (tool === 'write_file') {
            return await dispatch('write_file', {
                path: await this.guardPath(args.path),
                content: args.content,
                mode: 'rewrite'
            });
        }
        if (tool === 'edit_file') return await this.editFile({ ...args, path: await this.guardPath(args.path) });
        if (tool === 'shell_execute') return await runShell({ ...args, working_directory: await this.guardPath(args.working_directory) });
        if (tool === 'start_process') {
            const workingDirectory = await this.guardPath(args.working_directory);
            const result = await dispatch('start_process', {
                command: args.command,
                timeout_ms: Number(args.timeout_ms || 10000),
                working_directory: workingDirectory
            });
            return { ...result, pid: parsePid(result), session_id: String(parsePid(result)) };
        }
        if (tool === 'read_process_output') {
            const parsedPid = this.parseSessionPid(args.session_id, tool);
            return await dispatch('read_process_output', {
                pid: parsedPid,
                offset: args.offset,
                length: args.length,
                timeout_ms: 5000
            });
        }
        if (tool === 'interact_with_process') {
            const parsedPid = this.parseSessionPid(args.session_id, tool);
            return await dispatch('interact_with_process', {
                pid: parsedPid,
                input: String(args.input ?? ''),
                timeout_ms: Number(args.timeout_ms || 8000)
            });
        }
        if (tool === 'terminate_process') {
            const parsedPid = this.parseSessionPid(args.session_id, tool);
            return await dispatch('force_terminate', {
                pid: parsedPid
            });
        }
        if (tool === 'image_preview') return await this.imagePreview(args);
        if (tool === 'project_inspect') {
            return await inspectProjectOnDevice(await this.guardPath(args.path), args);
        }
        throw new Error(`Unsupported gateway capability: ${tool}`);
    }

    private async editFile(args: any): Promise<any> {
        if (typeof args.old_text !== 'string' || args.old_text.length === 0) throw new Error('old_text is required');
        if (typeof args.new_text !== 'string') throw new Error('new_text is required');
        const expectedReplacements = Number(args.expected_replacements ?? 1);
        if (!Number.isInteger(expectedReplacements) || expectedReplacements < 1) {
            throw new Error('expected_replacements must be a positive integer');
        }
        if (args.dry_run === true) {
            const read = assertSuccess(await dispatchToolCall('read_file', {
                path: args.path,
                offset: 0,
                length: 1
            }, { isRemote: true }), 'read_file');
            return {
                content: [{
                    type: 'text',
                    text: `Dry run successful: verified ${args.path} is accessible for remote editing`
                }]
            };
        }
        return assertSuccess(await dispatchToolCall('edit_block', {
            file_path: args.path,
            old_string: args.old_text,
            new_string: args.new_text,
            expected_replacements: expectedReplacements
        }, { isRemote: true }), 'edit_block');
    }
}
