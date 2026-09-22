import { exec, execFile } from 'child_process';
import fs from 'fs/promises';
import { promisify } from 'util';
import path from 'path';
import sharp from 'sharp';

import { commandManager } from '../command-manager.js';
import { configManager } from '../config-manager.js';
import { validatePath } from '../tools/filesystem.js';
import { LocalExecutionEngine } from './execution-engine.js';
import { inspectProjectOnDevice } from './project-inspection.js';

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
    const raw = String(process.env.MCP_GATEWAY_ALLOWED_ROOTS || '').trim();
    if (!raw) return [];
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error('MCP_GATEWAY_ALLOWED_ROOTS must be a JSON array of absolute paths'); }
    if (!Array.isArray(parsed)) throw new Error('MCP_GATEWAY_ALLOWED_ROOTS must be a JSON array of absolute paths');
    return [...new Set(parsed.map(value => String(value).trim()).filter(Boolean))];
}

function isWithinRoot(candidate: string, root: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

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
    if (!Number.isInteger(pid)) throw new Error('Local execution engine did not return a process PID');
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
    try {
        const shell = config.defaultShell || undefined;
        const shellName = shell ? path.basename(shell).toLowerCase() : '';
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

    constructor(private engine: LocalExecutionEngine, options: GatewayToolAdapterOptions = {}) {
        this.allowedRoots = options.allowedRoots ?? configuredGatewayRoots();
        this.pathValidator = options.pathValidator ?? validatePath;
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
                sourceFormat: metadata.format ?? null,
                mimeType: 'image/webp',
                embedded: includeImage
            }
        };
        if (!includeImage) return { content: [{ type: 'text', text: JSON.stringify(text) }] };

        for (const attempt of IMAGE_PREVIEW_ATTEMPTS) {
            const preview = await sharp(filePath, { animated: false, limitInputPixels: 64 * 1024 * 1024 })
                .rotate()
                .resize({ width: attempt.size, height: attempt.size, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: attempt.quality })
                .toBuffer();
            if (preview.length <= MAX_REMOTE_IMAGE_PREVIEW_BYTES) {
                return {
                    content: [
                        { type: 'text', text: JSON.stringify({ ...text, data: { ...text.data, previewBytes: preview.length } }) },
                        { type: 'image', data: preview.toString('base64'), mimeType: 'image/webp' }
                    ]
                };
            }
        }
        throw new Error(`REMOTE_IMAGE_TOO_LARGE: unable to fit preview within ${MAX_REMOTE_IMAGE_PREVIEW_BYTES} bytes`);
    }

    async call(tool: string, args: any = {}): Promise<any> {
        if (tool === 'read_text_file') {
            if (args.head !== undefined && args.tail !== undefined) throw new Error('Use either head or tail, not both');
            const mapped: any = { path: await this.guardPath(args.path) };
            if (args.head !== undefined) {
                mapped.offset = 0;
                mapped.length = Number(args.head);
            } else if (args.tail !== undefined) {
                mapped.offset = -Number(args.tail);
            }
            return assertSuccess(await this.engine.callClientTool('read_file', mapped), 'read_file');
        }
        if (tool === 'write_file') {
            return assertSuccess(await this.engine.callClientTool('write_file', {
                path: await this.guardPath(args.path),
                content: args.content,
                mode: 'rewrite'
            }), 'write_file');
        }
        if (tool === 'edit_file') return await this.editFile({ ...args, path: await this.guardPath(args.path) });
        if (tool === 'shell_execute') return await runShell({ ...args, working_directory: await this.guardPath(args.working_directory) });
        if (tool === 'start_process') {
            const workingDirectory = await this.guardPath(args.working_directory);
            const result = assertSuccess(await this.engine.callClientTool('start_process', {
                command: args.command,
                timeout_ms: Number(args.timeout_ms || 10000),
                working_directory: workingDirectory
            }), 'start_process');
            return { ...result, pid: parsePid(result), session_id: String(parsePid(result)) };
        }
        if (tool === 'read_process_output') {
            return assertSuccess(await this.engine.callClientTool('read_process_output', {
                pid: Number(args.session_id),
                offset: args.offset,
                length: args.length,
                timeout_ms: 5000
            }), 'read_process_output');
        }
        if (tool === 'interact_with_process') {
            return assertSuccess(await this.engine.callClientTool('interact_with_process', {
                pid: Number(args.session_id),
                input: String(args.input ?? ''),
                timeout_ms: Number(args.timeout_ms || 8000)
            }), 'interact_with_process');
        }
        if (tool === 'terminate_process') {
            return assertSuccess(await this.engine.callClientTool('force_terminate', {
                pid: Number(args.session_id)
            }), 'force_terminate');
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
            const read = assertSuccess(await this.engine.callClientTool('read_file', {
                path: args.path,
                offset: 0,
                length: 100000
            }), 'read_file');
            const source = textFromResult(read);
            const count = source.split(args.old_text).length - 1;
            return {
                content: [{ type: 'text', text: JSON.stringify({
                    ok: count === expectedReplacements,
                    dry_run: true,
                    expected_replacements: expectedReplacements,
                    actual_count: count
                }) }]
            };
        }
        return assertSuccess(await this.engine.callClientTool('edit_block', {
            file_path: args.path,
            old_string: args.old_text,
            new_string: args.new_text,
            expected_replacements: expectedReplacements
        }), 'edit_block');
    }
}
