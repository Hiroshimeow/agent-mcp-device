import { createInterface } from 'node:readline/promises';
import type { GraphOptions } from './graph.js';
import { resolve, join } from 'node:path';
import { openSync, readFileSync, fstatSync, closeSync, unlinkSync, appendFileSync, fsyncSync, constants } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { CONFIG_DIR } from '../config.js';
import { ContextStore } from './store.js';
import { ContextService } from './service.js';
import { resolveRepository, type PathGuard } from './repositories.js';

export const CONTEXT_CLI_CONTRACT = {
  globalFlags: ['--cwd', '--json'],
  commands: [
    { name: 'status', flags: [] },
    { name: 'search', flags: ['--query', '--limit', '--max-bytes', '--cursor', '--source-type', '--since', '--until'] },
    { name: 'read', flags: ['--ref', '--max-bytes', '--cursor'] },
    { name: 'graph', flags: ['--ref', '--action', '--target', '--direction', '--max-hops', '--max-nodes', '--max-edges', '--max-visited', '--max-bytes', '--wall-ms', '--generation'] },
    { name: 'sync', flags: [] },
    { name: 'checkpoint', flags: ['--summary', '--evidence-ref'] },
    { name: 'rebuild', flags: [] },
    { name: 'cancel', flags: ['--job-ref'] },
  ],
} as const;

export interface ContextCliResult { exitCode: number; stdout: string; stderr: string }
export interface ContextCliDependencies {
  stateRoot?: string;
  pathGuard?: PathGuard;
  workingDirectory?: string;
}

type Parsed = { command: string; values: Map<string, string[]> };

function parse(argv: string[]): Parsed {
  const command = argv[0];
  const spec = CONTEXT_CLI_CONTRACT.commands.find(spec => spec.name === command);
  if (!spec) throw new Error('ACTION_UNSUPPORTED');
  const allowed = new Set<string>([...CONTEXT_CLI_CONTRACT.globalFlags, ...spec.flags]);
  const values = new Map<string, string[]>();
  for (let i = 1; i < argv.length; i++) {
    const flag = argv[i];
    if (!allowed.has(flag)) throw new Error('ACTION_UNSUPPORTED');
    if (flag === '--json') {
      values.set(flag, ['true']);
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error('ACTION_UNSUPPORTED');
    const list = values.get(flag) ?? [];
    list.push(value);
    values.set(flag, list);
  }
  return { command, values };
}

function one(parsed: Parsed, flag: string): string | undefined {
  const values = parsed.values.get(flag);
  if (!values?.length) return undefined;
  if (values.length !== 1) throw new Error('ACTION_UNSUPPORTED');
  return values[0];
}

function integer(parsed: Parsed, flag: string): number | undefined {
  const raw = one(parsed, flag);
  if (raw === undefined) return undefined;
  if (!/^-?\d+$/.test(raw)) throw new Error('BUDGET_EXCEEDED');
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error('BUDGET_EXCEEDED');
  return value;
}

const knownErrors = new Set([
  'ACCESS_DENIED', 'LOCAL_STATE_UNAVAILABLE', 'ACTION_UNSUPPORTED', 'BUDGET_EXCEEDED',
  'SCOPE_REQUIRED', 'SCOPE_AMBIGUOUS', 'REPOSITORY_NOT_FOUND', 'INDEX_MISSING',
  'INDEX_INCOMPATIBLE', 'REF_NOT_FOUND', 'EVIDENCE_EXPIRED', 'CURSOR_INVALID',
  'CURSOR_STALE', 'BUSY', 'STORAGE_DEGRADED', 'QUOTA_EXCEEDED',
  'TOKEN_ALREADY_USED', 'TOKEN_EXPIRED', 'PURGE_CHECKPOINT_BUSY', 'RESERVATION_FENCED_OFF',
]);

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (knownErrors.has(message)) return message;
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code && ['EACCES', 'EPERM', 'EROFS', 'ENOTDIR', 'ENOENT'].includes(code)) return 'LOCAL_STATE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}

function exitCode(code: string): number {
  if (['ACCESS_DENIED', 'LOCAL_STATE_UNAVAILABLE', 'TOKEN_ALREADY_USED', 'TOKEN_EXPIRED'].includes(code)) return 3;
  if (['INDEX_MISSING', 'INDEX_INCOMPATIBLE', 'REF_NOT_FOUND', 'EVIDENCE_EXPIRED', 'CURSOR_INVALID', 'CURSOR_STALE'].includes(code)) return 4;
  if (['BUSY', 'STORAGE_DEGRADED', 'QUOTA_EXCEEDED', 'PURGE_CHECKPOINT_BUSY', 'RESERVATION_FENCED_OFF'].includes(code)) return 5;
  if (['ACTION_UNSUPPORTED', 'BUDGET_EXCEEDED', 'SCOPE_REQUIRED', 'SCOPE_AMBIGUOUS', 'REPOSITORY_NOT_FOUND'].includes(code)) return 2;
  return 1;
}

export function contextCliHelp(): string {
  return CONTEXT_CLI_CONTRACT.commands
    .map(command => `context ${command.name} [--cwd <path>] [--json]${command.flags.length ? ` ${command.flags.join(' ')}` : ''}`)
    .join('\n');
}

function human(output: unknown): string {
  const value = output as { scope?: { repository_ref: string }; index?: { generation: number | null; freshness: string; pending_events: number }; };
  return [`Repository: ${value.scope?.repository_ref ?? 'unknown'}`,
    `Generation: ${value.index?.generation ?? 'missing'} (${value.index?.freshness ?? 'unknown'}); pending: ${value.index?.pending_events ?? 0}`,
    JSON.stringify(output, null, 2)].join('\n') + '\n';
}

/** Operator-only gate. Exclusive claim serializes validation and consumption.
 * Token files contain {token: 64 lowercase hex, expires_at: epoch milliseconds}.
 * The protected state root is an OS permission boundary, not an agent sandbox.
 */
export function consumeAdminToken(root: string, token: string, now = Date.now()): void {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error('ACCESS_DENIED');
  const path = join(root, 'admin-clean-token'), lock = path + '.lock';
  let claim: number | undefined, fd: number | undefined;
  const digest = createHash('sha256').update(token).digest('hex');
  try {
    claim = openSync(lock, 'wx', 0o600);
    try {
      const used = readFileSync(path + '.used', 'utf8');
      if (used.split('\n').includes(digest)) throw new Error('TOKEN_ALREADY_USED');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > 256 || (process.platform !== 'win32' && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))) throw new Error('ACCESS_DENIED');
    const record = JSON.parse(readFileSync(fd, 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(record.token) || !/^[a-f0-9]{64}$/.test(token)) throw new Error('ACCESS_DENIED');
    const expected = Buffer.from(record.token, 'hex'), supplied = Buffer.from(token, 'hex');
    if (!timingSafeEqual(expected, supplied)) throw new Error('ACCESS_DENIED');
    if (!Number.isSafeInteger(record.expires_at) || record.expires_at <= now || record.expires_at > now + 300000) throw new Error('TOKEN_EXPIRED');
    // Persist consumed state before unlink: interrupted consumption cannot replay.
    const consumed = openSync(path + '.used', constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0), 0o600);
    try { appendFileSync(consumed, digest + '\n'); fsyncSync(consumed); }
    finally { closeSync(consumed); }
    closeSync(fd); fd = undefined;
    unlinkSync(path);
  } catch (error) {
    if (error instanceof Error && ['TOKEN_ALREADY_USED', 'TOKEN_EXPIRED'].includes(error.message)) throw error;
    throw new Error('ACCESS_DENIED');
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (claim !== undefined) { closeSync(claim); unlinkSync(lock); }
  }
}

/** Isolated local adapter. It opens device-local state and calls ContextService only. */
export async function runContextCli(argv: string[], deps: ContextCliDependencies = {}): Promise<ContextCliResult> {
  let store: ContextStore | undefined;
  try {
    if (argv.length === 1 && ['--help', 'help'].includes(argv[0])) return { exitCode: 0, stdout: contextCliHelp() + '\n', stderr: '' };
    // Separate owner-admin path: no MCP action, no --yes, no dependency-injected consent.
    if (argv[0] === 'clean') {
      const agentMarkers = ['MCP_DEVICE_SESSION', 'MCP_RUNNER', 'MCP_DEVICE_REMOTE', 'PI_SESSION_ID', 'PI_AGENT', 'CODEX_THREAD_ID'];
      if (agentMarkers.some(marker => process.env[marker] !== undefined) || !process.stdin.isTTY || !process.stdout.isTTY) throw new Error('ACCESS_DENIED');
      // The nonce is provisioned out-of-band by the owner, never generated or
      // exposed by an agent-facing command/status. Consume before prompting.
      if (argv.some(arg => arg === '--admin-token' || arg.startsWith('--admin-token=')) ||
          ['ADMIN_TOKEN', 'ADMIN_TOKEN_FILE', 'MCP_DEVICE_ADMIN_TOKEN', 'MCP_DEVICE_ADMIN_TOKEN_FILE'].some(key => process.env[key] !== undefined)) throw new Error('ACCESS_DENIED');
      if (argv.length !== 7 || argv[1] !== '--owner' || argv[3] !== '--repo' || argv[5] !== '--before' || !/^\d+$/.test(argv[6])) throw new Error('ACTION_UNSUPPORTED');
      const before = Number(argv[6]);
      if (!Number.isSafeInteger(before)) throw new Error('BUDGET_EXCEEDED');
      // Marker checks are defense-in-depth, not proof of human origin. Bind the
      // exact interactive challenge to the selected repository to prevent accidents.
      const confirmation = `PURGE ${argv[4]}`;
      const terminal = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
      let answer: string;
      try {
        const token = await terminal.question('Admin token:');
        consumeAdminToken(deps.stateRoot ?? CONFIG_DIR, token);
        answer = await terminal.question(`Permanently purge retained payloads for owner ${argv[2]}, repo ${argv[4]}, before ${before}. Type ${confirmation}: `);
      }
      finally { terminal.close(); }
      if (answer !== confirmation) throw new Error('ACCESS_DENIED');
      store = new ContextStore(deps.stateRoot ?? CONFIG_DIR);
      const output = new ContextService(store).cleanup(argv[2], argv[4], { before, localAdmin: true });
      return { exitCode: 0, stdout: `${JSON.stringify(output)}\n`, stderr: '' };
    }
    const parsed = parse(argv);
    for (const flag of parsed.values.keys()) {
      if (!['--ref', '--source-type', '--evidence-ref'].includes(flag)) one(parsed, flag);
    }
    const base = deps.workingDirectory ?? process.cwd();
    const cwd = resolve(base, one(parsed, '--cwd') ?? '.');
    const write = ['sync', 'checkpoint', 'rebuild'].includes(parsed.command);
    store = new ContextStore(deps.stateRoot ?? CONFIG_DIR, { readOnly: !write });
    const owner = store.activeOwner();
    if (!owner) throw new Error('ACCESS_DENIED');
    const resolved = await resolveRepository(cwd, deps.pathGuard ?? (async path => path));
    if (!resolved) throw new Error('REPOSITORY_NOT_FOUND');
    const repo = write ? store.repository(owner, resolved.identity) : store.findRepository(owner, resolved.identity);
    if (!repo) throw new Error('INDEX_MISSING');
    const service = new ContextService(store);

    let output: unknown;
    switch (parsed.command) {
      case 'status':
        output = service.status(owner, repo);
        break;
      case 'search':
        output = service.search(owner, repo, {
          query: one(parsed, '--query') ?? '',
          limit: integer(parsed, '--limit'),
          max_bytes: integer(parsed, '--max-bytes'),
          cursor: one(parsed, '--cursor'),
          source_types: parsed.values.get('--source-type'),
          since: integer(parsed, '--since'),
          until: integer(parsed, '--until'),
        });
        break;
      case 'read':
        output = service.read(owner, repo, {
          refs: parsed.values.get('--ref') ?? [],
          max_bytes: integer(parsed, '--max-bytes'),
          cursor: one(parsed, '--cursor'),
        });
        break;
      case 'graph':
        output = service.graph(owner, repo, {
          refs: parsed.values.get('--ref') ?? [],
          action: one(parsed, '--action') as GraphOptions['action'],
          target: one(parsed, '--target'), direction: one(parsed, '--direction') as GraphOptions['direction'],
          max_hops: integer(parsed, '--max-hops'), max_nodes: integer(parsed, '--max-nodes'),
          max_edges: integer(parsed, '--max-edges'), max_visited: integer(parsed, '--max-visited'),
          max_bytes: integer(parsed, '--max-bytes'), wall_ms: integer(parsed, '--wall-ms'), generation: integer(parsed, '--generation'),
        });
        break;
      case 'cancel':
        output = service.cancel(owner, repo, one(parsed, '--job-ref') ?? '');
        break;
      case 'sync':
        output = service.sync(owner, repo);
        break;
      case 'checkpoint':
        output = service.checkpoint(owner, repo, {
          repository_root: resolved.root,
          worktree_ref: resolved.worktree,
          summary: one(parsed, '--summary'),
          evidence_refs: parsed.values.get('--evidence-ref'),
        });
        break;
      case 'rebuild':
        output = service.rebuild(owner, repo);
        break;
      default:
        throw new Error('ACTION_UNSUPPORTED');
    }
    return { exitCode: 0, stdout: parsed.values.has('--json') ? `${JSON.stringify(output)}\n` : human(output), stderr: '' };
  } catch (error) {
    const code = errorCode(error);
    return { exitCode: exitCode(code), stdout: '', stderr: `${JSON.stringify({ ok: false, error: { code } })}\n` };
  } finally {
    try { store?.close(); } catch { /* Error response is already determined; never leak local paths on close. */ }
  }
}
