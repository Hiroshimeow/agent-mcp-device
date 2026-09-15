import { execFile } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DEFAULT_EXCLUDES = new Set(['.git', 'node_modules', 'logs', 'packages', '_zip_temp']);
const DEFAULT_TREE_LIMIT = 200;
const MAX_TREE_LIMIT = 500;
const DEFAULT_TREE_DEPTH = 3;
const MAX_TREE_DEPTH = 10;
const CURSOR_VERSION = 1;
const MAX_PROJECT_FILE_BYTES = 32 * 1024;
const VIEWS = new Set(['summary', 'tree', 'git_status', 'git_diff', 'readme', 'package', 'file']);

function boundedInteger(value: unknown, fallback: number, min: number, max: number, label: string): number {
    if (value === undefined || value === null || value === '') return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        throw new Error(`Invalid ${label}: ${value}. Expected an integer from ${min} to ${max}.`);
    }
    return number;
}

function cursorVersion(projectId: string, depth: number): string {
    return createHash('sha256').update(`project-tree\n${projectId}\n${depth}`).digest('base64url').slice(0, 16);
}

function encodeCursor(offset: number, version: string): string {
    return Buffer.from(JSON.stringify({ v: CURSOR_VERSION, kind: 'project-tree', offset, version }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: unknown, version: string): number {
    if (!cursor) return 0;
    let parsed: any;
    try {
        parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    } catch {
        throw new Error('Invalid cursor: expected an opaque cursor returned by the previous page.');
    }
    if (parsed?.v !== CURSOR_VERSION || parsed?.kind !== 'project-tree' || parsed?.version !== version || !Number.isInteger(parsed?.offset) || parsed.offset < 0) {
        throw new Error('Invalid or stale cursor: request parameters or catalog version changed.');
    }
    return parsed.offset;
}

async function exists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function resolveInsideRoot(root: string, relativePath: unknown): Promise<string> {
    const relative = String(relativePath || '').trim();
    if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]+/).includes('..')) {
        throw new Error('Invalid project-relative resource path.');
    }
    const canonicalRoot = await fs.realpath(root);
    const candidate = await fs.realpath(path.resolve(canonicalRoot, relative));
    const rel = path.relative(canonicalRoot, candidate);
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
        throw new Error('Resource path escapes project root.');
    }
    return candidate;
}

function looksBinary(buffer: Buffer): boolean {
    return buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
}

async function collectTreeEntries(root: string, maxDepth: number, stopAfter: number): Promise<any[]> {
    const entries: any[] = [];
    async function walk(dir: string, depth: number, relativeDir = ''): Promise<void> {
        if (entries.length >= stopAfter || depth > maxDepth) return;
        const dirEntries = (await fs.readdir(dir, { withFileTypes: true }))
            .filter(entry => !DEFAULT_EXCLUDES.has(entry.name))
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of dirEntries) {
            if (entries.length >= stopAfter) return;
            const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
            const isDirectory = entry.isDirectory();
            entries.push({ path: relativePath, name: entry.name, type: isDirectory ? 'directory' : 'file', depth });
            if (isDirectory && depth < maxDepth) await walk(path.join(dir, entry.name), depth + 1, relativePath);
        }
    }
    await walk(root, 1);
    return entries;
}

async function execGitRead(cwd: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number }> {
    try {
        const { stdout, stderr } = await execFileAsync('git', args, { cwd, timeout: 30000, windowsHide: true, maxBuffer: 1024 * 1024, encoding: 'utf8' });
        return { ok: true, stdout: String(stdout || ''), stderr: String(stderr || ''), exitCode: 0 };
    } catch (error: any) {
        return {
            ok: false,
            stdout: String(error?.stdout || ''),
            stderr: String(error?.stderr || error?.message || ''),
            exitCode: Number.isInteger(error?.code) ? error.code : 1
        };
    }
}

export async function inspectProjectOnDevice(root: string, args: any = {}): Promise<any> {
    const view = String(args.view || 'summary');
    if (!VIEWS.has(view)) throw new Error(`Invalid project inspection view: ${view}.`);
    const projectId = String(args.project_id || '').trim();

    if (view === 'summary') {
        return {
            defaultRootName: path.basename(root) || projectId,
            hasPackageJson: await exists(path.join(root, 'package.json')),
            hasReadme: await exists(path.join(root, 'README.md')) || await exists(path.join(root, 'README.vi.md'))
        };
    }

    if (view === 'tree') {
        const depth = boundedInteger(args.depth, DEFAULT_TREE_DEPTH, 1, MAX_TREE_DEPTH, 'depth');
        const limit = boundedInteger(args.limit, DEFAULT_TREE_LIMIT, 1, MAX_TREE_LIMIT, 'limit');
        const version = cursorVersion(projectId, depth);
        const offset = decodeCursor(args.cursor, version);
        const entries = await collectTreeEntries(root, depth, offset + limit + 1);
        if (offset > entries.length) throw new Error('Invalid or stale cursor: tree offset is outside the current result set.');
        const page = entries.slice(offset, offset + limit);
        const truncated = entries.length > offset + page.length;
        return {
            rootName: path.basename(root),
            maxDepth: depth,
            maxEntries: limit,
            entries: page,
            truncated,
            nextCursor: truncated ? encodeCursor(offset + page.length, version) : null
        };
    }

    if (view === 'git_status') {
        const result = await execGitRead(root, ['status', '--short', '--branch']);
        return { ok: result.ok, status: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
    }

    if (view === 'git_diff') {
        const staged = args.staged === true;
        const result = await execGitRead(root, staged ? ['diff', '--staged'] : ['diff']);
        return { ok: result.ok, staged, text: result.ok ? result.stdout : result.stderr, stderr: result.stderr, exitCode: result.exitCode };
    }

    if (view === 'readme') {
        for (const fileName of ['README.md', 'README.vi.md']) {
            try {
                const filePath = await resolveInsideRoot(root, fileName);
                return { fileName, text: await fs.readFile(filePath, 'utf8') };
            } catch (error: any) {
                if (error?.code !== 'ENOENT') throw error;
            }
        }
        throw new Error(`README not found for project_id: ${projectId}`);
    }

    if (view === 'package') {
        let packagePath: string;
        try { packagePath = await resolveInsideRoot(root, 'package.json'); }
        catch (error: any) {
            if (error?.code === 'ENOENT') throw new Error(`package.json not found for project_id: ${projectId}`);
            throw error;
        }
        return { data: JSON.parse(await fs.readFile(packagePath, 'utf8')) };
    }

    const filePath = await resolveInsideRoot(root, args.relative_path);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('Resource file path must point to a regular file.');
    if (stat.size > MAX_PROJECT_FILE_BYTES) throw new Error(`Resource file is too large for text preview: ${stat.size} bytes.`);
    const buffer = await fs.readFile(filePath);
    if (looksBinary(buffer)) throw new Error('Resource file appears to be binary; text resources only support textual files.');
    return { text: buffer.toString('utf8') };
}
