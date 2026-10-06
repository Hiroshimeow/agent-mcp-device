# Checkpoint 1 — Opus B1/B2/B3 and H3 remediation evidence

Self-contained current source and complete regression test bodies for feature 002-device-local-context. Every file below is reproduced in full with its SHA-256; the migration worker fixture is included, not omitted. This packet supersedes the prior 39-test packet.

## Verification

- `npm run build`: exit 0. Complete output: `evidence/context/blockers-build.log`.
- `node --test test/context/*.test.js`: exit 0; **45 tests, 45 passed, 0 failed, 0 cancelled, 0 skipped**. Complete TAP output is reproduced below and saved at `evidence/context/blockers-context-tests.log`.
- `git diff --check`: exit 0.
- Runtime: Node 22.22.2; SQLite 3.51.2; win32/x64. SQLite emits the expected ExperimentalWarning. No Linux or Node-floor verification is claimed.
- Red/green evidence: the two new worker-thread contention tests failed before the production change because B returned while A still held its write lock (the worker deliberately starts with busy_timeout=1). Both passed after migrate itself configured busy_timeout=5000. Other new cases cover existing domain behavior; no new cursor or rank implementation is claimed.

## B1 — real concurrent migration and rollback

- Handle A reconstructs v2, executes BEGIN IMMEDIATE, installs the deleted_generation column, rebuilds FTS and sets user_version=3, holding all changes uncommitted.
- Handle B is an independent DatabaseSync connection in a worker thread. Its instrumentation delegates all SQL to real SQLite; it records version reads and SQL only, never simulates a lock or migration. Shared atomics announce B reaching BEGIN IMMEDIATE. A observes B cannot finish for 150 ms while A holds the lock, then commits. B observes versions [2,3], commits no-op and does not throw.
- The second executing test follows the same interleaving with A committing user_version=4. B observes [2,4], throws INDEX_INCOMPATIBLE and records ROLLBACK, never COMMIT.
- Both tests assert the configured timeout is 5000, B total_changes()=0, unchanged schema_version, integrity_check=ok, one deleted_generation column and preserved FTS sentinel. A fresh BEGIN IMMEDIATE/ROLLBACK on B proves no dangling transaction; A also reacquires the released lock.
- Exact migrate() appears in full below, including PRAGMA busy_timeout=5000 before locking and catch(error) { db.exec('ROLLBACK'); throw error; }. Existing exception-at-commit and actual process-crash recovery tests remain executing.

## B2 — cursor expiry, generation, authentication and kind isolation

- ContextStore.parseReadCursor authenticates bounded metadata and scope; it deliberately does not enforce expiry. This boundary is documented on the method. The search/read domain continuation() enforces expiry only after authentication: typeof state.expires_at !== 'number' || state.expires_at <= Date.now() || !validGeneration throws CURSOR_STALE.
- A new test signs expires_at=Date.now()-1000, proves the store can authenticate the expired metadata, then proves both search and read reject it with CURSOR_STALE.
- A read cursor issued at G is rejected with CURSOR_STALE after sync publishes G+1; non-pinned read enforces state.generation === generation. Search deliberately pins G and can continue after G+1.
- A tampering test changes exactly one decoded payload byte (position 0 to 1), verifies the JSON remains valid, re-encodes base64url and keeps the original MAC. Both parseReadCursor and search reject it with CURSOR_INVALID.
- A same-scope search cursor issued for foo rejects bar with CURSOR_INVALID using the same limit. Positive same-query/read-ref resumptions prevent vacuous invalidity checks.
- Search cursor -> read, read cursor -> search, and durable cursor -> parseReadCursor each reject with CURSOR_INVALID. Search/read service identity is bound by the authenticated operation-specific query key; the store MAC kind distinguishes durable from read-envelope cursors.

## B3 — fixed keyset buckets, not live BM25

**To Opus: m.score is a discrete constant, NOT bm25(evidence_fts).** The CTE emits 0 for an exact substring match and 1 for an FTS token match; min(m.score) prefers exact matches. Neither document length nor corpus term frequency changes these bucket values for unchanged retained text.

The executing SQL in search.ts is reproduced in full below and uses:

~~~~sql
WITH matches AS (
  SELECT ref,0 AS score FROM evidence WHERE instr(lower(text),lower(?))>0
  UNION ALL SELECT ref,1 AS score FROM evidence_fts WHERE evidence_fts MATCH ?
)
-- after generation, retention, source and time filtering and GROUP BY d.ref:
HAVING (? IS NULL OR min(m.score)>? OR (min(m.score)=? AND (d.timestamp<? OR (d.timestamp=? AND d.ref>?))))
ORDER BY score ASC,d.timestamp DESC,d.ref ASC LIMIT ?
~~~~

- The expanded regression indexes **10** G documents with different lengths and alpha/beta frequencies, including tied timestamps. It independently computes expected from timestamp DESC/ref ASC for the FTS-only bucket and checks the first page.
- G+1 adds 30 uneven documents with different lengths and term frequencies. Direct diagnostic BM25 queries prove different initial scores and changed corpus-dependent scores for original G rows. BM25 exists only in the test diagnostic, never the production ordering SQL.
- Complete pinned-G traversal equals expected in order, with all 10 refs, zero duplicates and zero gaps, despite G+1 changing BM25. Existing exact-before-FTS and clock-skewed G+1 exclusion tests remain.
- **Current retention_state='available' takes priority over pinned generation.** Pinning preserves membership/order, not permission to return purged data. A new test purges an unvisited G row, publishes G+1 and proves pinned traversal returns exactly expected minus the purged ref; direct read reports EVIDENCE_EXPIRED. Search documents this priority next to its SQL.

## H3 — positive canary controls

The enhanced redaction test retains 'safe payload' alongside four canary secrets. After sync, evidence_fts MATCH 'payload' has exactly one hit and temp.vocab contains exactly one payload term. Stored text contains [REDACTED:api_key: and 'safe payload' but none of the canaries. stored.hash equals the evidence row.hash column and SHA-256 of retained redacted text. Existing zero-canary MATCH/vocab checks, main DB/WAL/SHM scans and all five FTS shadow-table scans remain.

## Diff summary

- src/context/migrations/index.ts: migrate now sets busy_timeout=5000 itself. Lock recheck and catch/ROLLBACK remain unchanged.
- src/context/store.ts: document authentication-only parseReadCursor and domain lifetime/generation enforcement.
- src/context/search.ts: document fixed 0/1 buckets, independence from BM25 and retention precedence; no rank or cursor behavior change.
- test/context/retrieval.test.js: replace simulated interleaving with real worker contention and future-version rollback tests; add expiry, read generation, one-byte tamper, query/kind and purge regressions; expand BM25 diagnostic fixture to 10 originals and uneven G+1 inserts.
- test/context/fixtures/migration-worker.js: new independent SQLite worker with pass-through SQL recording and fresh-transaction check.
- test/context/redaction.test.js: positive MATCH/vocabulary/stored-text/hash controls.
- This packet and verification logs: refreshed evidence. Prior decisions below are preserved as historical design decisions; this packet is authoritative for the current executing test coverage.

Live capture, quota/cleanup, version bump, merge and release remain outside this task. Reviewer approval is not asserted.

## Exact file contents

### src/context/search.ts

SHA-256 (UTF-8): `6eff88d33b8fc791f5c784f5a0d44c8504d9c3675649464c900e3ab06c6a0a43`

~~~~typescript
import { createHash } from 'node:crypto';
import { ContextStore } from './store.js';
import { fold, utf8Prefix } from './text.js';

export interface SearchOptions { query: string; limit?: number; max_bytes?: number; cursor?: string; source_types?: string[]; since?: number; until?: number }
export interface ReadOptions { refs: string[]; max_bytes?: number; cursor?: string }
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function budget(value: number | undefined, fallback: number, ceiling: number) {
  const cap = value ?? fallback;
  if (!Number.isInteger(cap) || cap < 1 || cap > ceiling) throw new Error('BUDGET_EXCEEDED');
  return cap;
}
function envelope(store: ContextStore, owner: string, repo: string) {
  const manifest = store.inspectManifest(owner, repo);
  const reasons = manifest.unknown_events ? ['unknown_after_restart'] : [];
  return { schema_version: 1, ok: true, scope: { repository_ref: repo },
    index: { generation: manifest.generation, indexed_through_event: manifest.indexed_through_event,
      pending_events: manifest.pending_events, freshness: manifest.generation === null ? 'missing' : manifest.pending_events ? 'stale' : 'current' },
    coverage: { complete: !reasons.length, reasons }, items: [] as Record<string, unknown>[],
    partial: false, next_cursor: null as string | null, warnings: [] as string[] };
}
function continuation(store: ContextStore, owner: string, repo: string, key: string, generation: number | null, cursor?: string, pinned = false) {
  if (!cursor) return { generation, position: 0, offset: 0, last_match: null as number | null, last_timestamp: null as number | null, last_ref: null as string | null, expires_at: Date.now() + 600000 };
  const state = store.parseReadCursor(owner, repo, cursor);
  if (state.key !== key || !Number.isSafeInteger(state.position) || Number(state.position) < 0 ||
      !Number.isSafeInteger(state.offset) || Number(state.offset) < 0) throw new Error('CURSOR_INVALID');
  const validGeneration = pinned
    ? Number.isSafeInteger(state.generation) && Number(state.generation) >= 1 && generation !== null && Number(state.generation) <= generation
    : state.generation === generation;
  if (typeof state.expires_at !== 'number' || state.expires_at <= Date.now() || !validGeneration) throw new Error('CURSOR_STALE');
  if (pinned && !(state.last_match === null && state.last_timestamp === null && state.last_ref === null) &&
      (![0, 1].includes(Number(state.last_match)) || typeof state.last_match !== 'number' || !Number.isSafeInteger(state.last_timestamp) || typeof state.last_ref !== 'string' || !/^[a-f0-9]{48}$/.test(state.last_ref))) throw new Error('CURSOR_INVALID');
  return { generation: state.generation as number | null, position: Number(state.position), offset: Number(state.offset),
    last_match: state.last_match as number | null, last_timestamp: state.last_timestamp as number | null,
    last_ref: state.last_ref as string | null, expires_at: state.expires_at };
}

export function search(store: ContextStore, owner: string, repo: string, input: SearchOptions) {
  store.authorize(owner, repo);
  const query = input.query?.trim().normalize('NFC');
  if (!query || Buffer.byteLength(query) > 4096) throw new Error('BUDGET_EXCEEDED');
  const limit = budget(input.limit, 8, 50), cap = budget(input.max_bytes, 65536, 131072);
  const sources = input.source_types ?? ['history', 'checkpoint', 'activity'];
  if (!Array.isArray(sources) || !sources.length || sources.some(s => !['history', 'checkpoint', 'activity'].includes(s))) throw new Error('ACTION_UNSUPPORTED');
  for (const time of [input.since, input.until]) if (time !== undefined && !Number.isSafeInteger(time)) throw new Error('BUDGET_EXCEEDED');
  const result = envelope(store, owner, repo);
  let generation = result.index.generation;
  if (generation === null) throw new Error('INDEX_MISSING');
  const key = digest(['search', query, limit, sources, input.since, input.until]);
  const state = continuation(store, owner, repo, key, generation, input.cursor, true);
  generation = state.generation!;
  result.index.generation = generation;
  const token = (row?: Record<string, unknown>) => store.signReadCursor(owner, repo,
    { key, generation, position: 0, offset: 0, last_match: row?.score ?? state.last_match,
      last_timestamp: row?.timestamp ?? state.last_timestamp,
      last_ref: row?.ref ?? state.last_ref, expires_at: state.expires_at });
  // Quote individual Unicode tokens; no user FTS operators or SQL are accepted.
  const terms = fold(query).match(/[\p{L}\p{N}_]+/gu)?.slice(0, 64) ?? [];
  const fts = terms.map(term => `"${term.replace(/"/g, '""')}"`).join(' OR ');
  return store.withReadDatabase(owner, repo, db => {
    // score is a fixed bucket: 0 = exact substring, 1 = FTS token match, NOT BM25.
    // Corpus statistics cannot change keyset rank. Current retention availability
    // overrides pinned generation membership: purged evidence is never returned.
    const rows = db.prepare(`WITH matches AS (
      SELECT ref,0 AS score FROM evidence WHERE instr(lower(text),lower(?))>0
      UNION ALL SELECT ref,1 AS score FROM evidence_fts WHERE evidence_fts MATCH ?
    ) SELECT d.ref,d.source_kind,d.timestamp,p.text,p.partial,p.redaction_state,min(m.score) AS score
      FROM matches m JOIN search_documents d ON d.ref=m.ref JOIN evidence p ON p.ref=d.ref
      WHERE d.first_indexed_generation<=? AND (d.deleted_generation IS NULL OR d.deleted_generation>?) AND p.retention_state='available'
      AND d.source_kind IN (${sources.map(() => '?').join(',')}) AND d.timestamp>=? AND d.timestamp<=?
      GROUP BY d.ref
      HAVING (? IS NULL OR min(m.score)>? OR (min(m.score)=? AND (d.timestamp<? OR (d.timestamp=? AND d.ref>?))))
      ORDER BY score ASC,d.timestamp DESC,d.ref ASC LIMIT ?`)
      .all(query, fts || '""', generation, generation, ...sources, input.since ?? 0, input.until ?? Number.MAX_SAFE_INTEGER,
        state.last_match, state.last_match, state.last_match, state.last_timestamp, state.last_timestamp, state.last_ref, limit + 1);
    let count = 0;
    for (const row of rows.slice(0, limit)) {
      const item = { ref: row.ref, source_kind: row.source_kind, evidence_class: 'observed', timestamp: row.timestamp,
        label: 'Retained evidence', snippet: utf8Prefix(String(row.text), 512), match_reason: Number(row.score) === 0 ? 'exact' : 'fts',
        redaction_state: row.redaction_state, truncated: Boolean(row.partial) || Buffer.byteLength(String(row.text)) > 512 };
      result.items.push(item); count++;
      result.partial = rows.length > count; result.next_cursor = result.partial ? token(rows[count - 1]) : null;
      if (bytes(result) > cap) {
        result.items.pop(); count--; result.partial = true; result.next_cursor = token(rows[count - 1]); break;
      }
    }
    if (bytes(result) > cap || (rows.length && count === 0)) throw new Error('BUDGET_EXCEEDED');
    if (result.partial) result.warnings = ['response_budget_or_limit'];
    if (bytes(result) > cap) throw new Error('BUDGET_EXCEEDED');
    return result;
  });
}

export function readEvidence(store: ContextStore, owner: string, repo: string, input: ReadOptions) {
  store.authorize(owner, repo);
  if (!Array.isArray(input.refs) || input.refs.length < 1 || input.refs.length > 20 || input.refs.some(ref => typeof ref !== 'string' || ref.length > 128)) throw new Error('BUDGET_EXCEEDED');
  const cap = budget(input.max_bytes, 262144, 1048576), result = envelope(store, owner, repo);
  const key = digest(['read', input.refs]);
  const state = continuation(store, owner, repo, key, result.index.generation, input.cursor);
  const token = (position: number, offset: number) => store.signReadCursor(owner, repo,
    { key, generation: result.index.generation, position, offset, expires_at: state.expires_at });
  return store.withReadDatabase(owner, repo, db => {
    for (let i = state.position; i < input.refs.length; i++) {
      const ref = input.refs[i], row = db.prepare('SELECT * FROM evidence WHERE ref=?').get(ref);
      const start = i === state.position ? state.offset : 0;
      const error = !row ? 'REF_NOT_FOUND' : ['expired', 'purged'].includes(String(row.retention_state)) ? 'EVIDENCE_EXPIRED' : null;
      if (error) {
        result.items.push({ ref, error }); result.partial = i + 1 < input.refs.length; result.next_cursor = result.partial ? token(i + 1, 0) : null;
        if (bytes(result) > cap) { result.items.pop(); result.partial = true; result.next_cursor = token(i, 0); break; }
        continue;
      }
      const text = String(row!.text), total = Buffer.byteLength(text);
      if (start > total) throw new Error('CURSOR_INVALID');
      const remaining = Buffer.from(text).subarray(start).toString('utf8');
      const item: Record<string, unknown> = { ref, source_kind: 'history', evidence_class: 'observed', content: '', hash: row!.hash,
        captured_range: { start, end: start }, total_bytes: total, redaction_state: row!.redaction_state,
        retention_state: row!.partial ? 'partial' : row!.retention_state, truncated: Boolean(row!.partial) };
      result.items.push(item);
      const fit = (length: number) => {
        const content = utf8Prefix(remaining, length), end = start + Buffer.byteLength(content);
        item.content = content; item.captured_range = { start, end }; item.truncated = Boolean(row!.partial) || end < total;
        result.partial = end < total || i + 1 < input.refs.length;
        result.next_cursor = null;
        if (end < total) result.next_cursor = token(i, end);
        else if (i + 1 < input.refs.length) result.next_cursor = token(i + 1, 0);
        return bytes(result) <= cap;
      };
      let low = 0, high = Buffer.byteLength(remaining);
      while (low < high) { const mid = Math.ceil((low + high) / 2); if (fit(mid)) low = mid; else high = mid - 1; }
      const fits = fit(low);
      if (!fits || (total > start && !String(item.content).length)) {
        result.items.pop(); result.partial = true; result.next_cursor = token(i, start); break;
      }
      if (start + Buffer.byteLength(String(item.content)) < total) break;
    }
    if (bytes(result) > cap || !result.items.length) throw new Error('BUDGET_EXCEEDED');
    return result;
  });
}
~~~~

### src/context/store.ts

SHA-256 (UTF-8): `395210c452dec209cff7aafcf99712c9e92ffbb43d8b8a6d43abffb2afe1f2a4`

~~~~typescript
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { migrate } from './migrations/index.js';
import { redact } from './redact.js';

const opaque = () => randomBytes(24).toString('hex');
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const MAX_STORES = 256;
const MAX_OPEN_STORES = 16;
interface CursorState { generation: number | null; position: number; expires_at: number; query_hash: string }

/** Device-local storage. State root is supplied by trusted runtime configuration, never tool input. */
export class ContextStore {
  readonly registry: DatabaseSync;
  private readonly root: string;
  private readonly key: Buffer;
  private readonly cursorKey: Buffer;
  private readonly databases = new Map<string, DatabaseSync>();

  constructor(private readonly stateRoot: string) {
    this.root = join(stateRoot, 'context');
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    const keyPath = join(stateRoot, 'context-hmac.key');
    try { writeFileSync(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('LOCAL_STATE_UNAVAILABLE'); }
    if (process.platform === 'win32') {
      // Inheritance removal plus explicit current-user grant, rather than ineffective chmod on Windows.
      const user = execFileSync('whoami', [], { encoding: 'utf8' }).trim();
      execFileSync('icacls', [keyPath, '/inheritance:r', '/grant:r', `${user}:F`], { stdio: 'ignore' });
    } else chmodSync(keyPath, 0o600);
    this.key = readFileSync(keyPath);
    if (this.key.length !== 32) throw new Error('LOCAL_STATE_UNAVAILABLE');
    this.cursorKey = createHmac('sha256', this.key).update('cursor_signing_v1').digest();
    this.registry = this.open(join(this.root, 'registry.sqlite'), 'registry');
  }

  private open(path: string, kind: 'registry' | 'repo' | 'unscoped'): DatabaseSync {
    mkdirSync(join(path, '..'), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(path);
    try {
      db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL');
      migrate(db, kind); return db;
    } catch (error) { db.close(); throw error; }
  }

  activeOwner(): string | null {
    return this.registry.prepare("SELECT owner_key FROM owners WHERE status='active'").get()?.owner_key as string ?? null;
  }

  activateOwner(trustedPairingIdentity: string): string {
    if (!trustedPairingIdentity) throw new Error('ACCESS_DENIED');
    const pairing = hash(trustedPairingIdentity);
    const active = this.registry.prepare("SELECT owner_key,pairing_hash FROM owners WHERE status='active'").get();
    if (active?.pairing_hash === pairing) return active.owner_key as string;
    const owner = opaque();
    this.registry.exec('BEGIN IMMEDIATE');
    try {
      this.registry.prepare("UPDATE owners SET status='sealed' WHERE status='active'").run();
      this.registry.prepare("INSERT INTO owners(owner_key,pairing_hash,status,created_at) VALUES(?,?,'active',?)").run(owner, pairing, Date.now());
      this.registry.exec('COMMIT');
    } catch (error) { this.registry.exec('ROLLBACK'); throw error; }
    // Sealed namespace handles must not remain live through default service access.
    for (const db of this.databases.values()) db.close();
    this.databases.clear();
    return owner;
  }

  authorize(owner: string, repo?: string): void {
    if (!owner || this.activeOwner() !== owner) throw new Error('ACCESS_DENIED');
    if (repo && !this.registry.prepare('SELECT 1 FROM repositories WHERE repo_uuid=? AND owner_key=?').get(repo, owner)) throw new Error('ACCESS_DENIED');
  }

  repository(owner: string, identity: string): string {
    this.authorize(owner);
    const existing = this.registry.prepare('SELECT repo_uuid FROM repositories WHERE owner_key=? AND identity=?').get(owner, identity);
    if (existing) return existing.repo_uuid as string;
    this.registry.exec('BEGIN IMMEDIATE');
    try {
      const count = Number(this.registry.prepare('SELECT count(*) AS n FROM repositories WHERE owner_key=?').get(owner)?.n);
      if (count >= MAX_STORES) throw new Error('BUDGET_EXCEEDED');
      const repo = opaque();
      this.registry.prepare('INSERT INTO repositories(repo_uuid,owner_key,identity,created_at) VALUES(?,?,?,?)').run(repo, owner, identity, Date.now());
      this.registry.exec('COMMIT'); return repo;
    } catch (error) { this.registry.exec('ROLLBACK'); throw error; }
  }

  private database(owner: string, repo?: string): DatabaseSync {
    this.authorize(owner, repo);
    const path = repo ? join(this.root, 'owners', owner, 'repos', repo, 'context.sqlite') : join(this.root, 'owners', owner, 'unscoped.sqlite');
    const existing = this.databases.get(path);
    if (existing) { this.databases.delete(path); this.databases.set(path, existing); return existing; }
    if (this.databases.size >= MAX_OPEN_STORES) {
      const oldest = this.databases.keys().next().value!;
      this.databases.get(oldest)!.close(); this.databases.delete(oldest);
    }
    const db = this.open(path, repo ? 'repo' : 'unscoped');
    this.databases.set(path, db); return db;
  }

  /** Internal modules only; adapters must use authorized domain methods. */
  repoDatabase(owner: string, repo: string): DatabaseSync { return this.database(owner, repo); }
  unscopedDatabase(owner: string): DatabaseSync { return this.database(owner); }

  recordUnscoped(owner: string, reason: 'outside_repo' | 'ambiguous_multi_repo' | 'repo_resolution_failed' | 'quota'): void {
    this.unscopedDatabase(owner).prepare('INSERT INTO gaps VALUES(?,?,?)').run(opaque(), Date.now(), reason);
  }

  append(owner: string, repo: string, input: string | Buffer, options: { path?: string; maxBytes?: number } = {}): string {
    this.authorize(owner, repo);
    const safe = this.redactPayload(input, options); // No raw text, path, or raw hash enters SQLite.
    const db = this.repoDatabase(owner, repo), ref = opaque();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES(?,?,?,?,?,?,?)').run(ref, safe.text, safe.hash, safe.originalBytes, safe.retainedBytes, safe.state, Number(safe.partial));
      db.prepare('INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES(?,?,?)').run(opaque(), Date.now(), ref);
      db.exec('COMMIT'); return ref;
    } catch { db.exec('ROLLBACK'); throw new Error('STORAGE_DEGRADED'); }
  }

  /** All persistence callers share the protected installation key; raw secrets are never hashed unkeyed. */
  redactPayload(input: string | Buffer, options: { path?: string; maxBytes?: number } = {}) {
    return redact(input, { ...options, key: this.key });
  }

  read(owner: string, repo: string, ref: string) {
    const row = this.repoDatabase(owner, repo).prepare('SELECT * FROM evidence WHERE ref=?').get(ref);
    if (!row) throw new Error('REF_NOT_FOUND');
    return row;
  }

  inspectManifest(owner: string, repo: string) {
    this.authorize(owner, repo);
    const path = join(this.root, 'owners', owner, 'repos', repo, 'context.sqlite');
    const empty = { generation: null, indexed_through_event: 0, manifest_hash: null, pending_events: 0, unknown_events: 0 };
    if (!existsSync(path)) return empty;
    const existing = this.databases.get(path);
    const db = existing ?? new DatabaseSync(path, { readOnly: true });
    try {
      const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
      if (version !== 3) throw new Error('INDEX_INCOMPATIBLE');
      return this.readManifest(db);
    } finally { if (!existing) db.close(); }
  }

  /** Query-only access never creates, migrates or opens a writable handle. */
  withReadDatabase<T>(owner: string, repo: string, action: (db: DatabaseSync) => T): T {
    this.authorize(owner, repo);
    const path = join(this.root, 'owners', owner, 'repos', repo, 'context.sqlite');
    if (!existsSync(path)) throw new Error('INDEX_MISSING');
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      if (Number(db.prepare('PRAGMA user_version').get()?.user_version) !== 3) throw new Error('INDEX_INCOMPATIBLE');
      return action(db);
    } finally { db.close(); }
  }

  signReadCursor(owner: string, repo: string, state: { generation?: unknown; key?: unknown; expires_at?: unknown; [field: string]: unknown }): string {
    this.authorize(owner, repo);
    const body = Buffer.from(JSON.stringify({ ...state, sealed: false })).toString('base64url');
    return `${body}.${createHmac('sha256', this.cursorKey).update(JSON.stringify(['v1', 'read', owner, repo, state.generation, state.key, state.expires_at, false, body])).digest('hex')}`;
  }

  /** Authenticate bounded metadata only. search/read continuation() enforces expiry,
   * operation/query identity and generation policy after successful authentication.
   */
  parseReadCursor(owner: string, repo: string, token: string): Record<string, unknown> {
    this.authorize(owner, repo);
    if (token.length > 4096 || !/^[A-Za-z0-9_-]+\.(?:[a-f0-9]{2})+$/.test(token)) throw new Error('CURSOR_INVALID');
    const [body, signature] = token.split('.');
    const supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== 32) throw new Error('CURSOR_INVALID');
    try {
      // Decode only bounded metadata for the MAC input; do not use state until authenticated.
      const state = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (state?.sealed !== false) throw new Error('CURSOR_INVALID');
      const expected = createHmac('sha256', this.cursorKey).update(JSON.stringify(['v1', 'read', owner, repo,
        state.generation, state.key, state.expires_at, false, body])).digest();
      if (!timingSafeEqual(supplied, expected)) throw new Error('CURSOR_INVALID');
      return state;
    } catch { throw new Error('CURSOR_INVALID'); }
  }

  manifest(owner: string, repo: string) {
    return this.readManifest(this.repoDatabase(owner, repo));
  }

  private readManifest(db: DatabaseSync) {
    const row = db.prepare('SELECT g.generation_id,g.indexed_through_event,g.manifest_hash FROM manifest m LEFT JOIN generations g ON g.generation_id=m.generation').get()!;
    const indexed = Number(row.indexed_through_event ?? 0);
    const pending = Number(db.prepare('SELECT count(*) AS n FROM events WHERE event_id>?').get(indexed)?.n);
    const unknown = Number(db.prepare("SELECT count(*) AS n FROM events WHERE execution_status='unknown_after_restart'").get()?.n);
    return { generation: row.generation_id == null ? null : Number(row.generation_id), indexed_through_event: indexed, manifest_hash: row.manifest_hash ?? null, pending_events: pending, unknown_events: unknown };
  }

  beginGeneration(owner: string, repo: string): number {
    return Number(this.repoDatabase(owner, repo).prepare("INSERT INTO generations(status,created_at) VALUES('shadow',?)").run(Date.now()).lastInsertRowid);
  }

  publishGeneration(owner: string, repo: string, generation: number, through: number, manifestHash: string): void {
    const db = this.repoDatabase(owner, repo);
    const current = this.manifest(owner, repo);
    const maxEvent = Number(db.prepare('SELECT max(event_id) AS n FROM events').get()?.n ?? 0);
    if (!Number.isInteger(through) || through < current.indexed_through_event || through > maxEvent || (current.generation !== null && generation <= current.generation)) throw new Error('INDEX_INCOMPATIBLE');
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db.prepare("UPDATE generations SET status='published',indexed_through_event=?,manifest_hash=? WHERE generation_id=? AND status='shadow'").run(through, manifestHash, generation);
      if (!result.changes) throw new Error('INDEX_INCOMPATIBLE');
      db.prepare('UPDATE manifest SET generation=? WHERE singleton=1').run(generation);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  cursor(owner: string, repo: string, query: string, position: number, ttl = 600000): string {
    this.authorize(owner, repo);
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 1800000 || !Number.isSafeInteger(position) || position < 0) throw new Error('BUDGET_EXCEEDED');
    const id = opaque(), generation = this.manifest(owner, repo).generation;
    const queryHash = hash(query), expiry = Date.now() + ttl;
    this.repoDatabase(owner, repo).prepare('INSERT INTO cursors VALUES(?,?,?,?,?)').run(id, generation, queryHash, position, expiry);
    const signature = createHmac('sha256', this.cursorKey).update(JSON.stringify(['v1', 'durable', owner, repo, generation, queryHash, expiry, false, id, position])).digest('hex');
    return `${id}.${signature}`;
  }

  validateCursor(owner: string, repo: string, token: string, query: string, now = Date.now()): CursorState {
    this.authorize(owner, repo);
    if (!/^[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token)) throw new Error('CURSOR_INVALID');
    const [id, signature] = token.split('.');
    const row = this.repoDatabase(owner, repo).prepare('SELECT * FROM cursors WHERE token_id=?').get(id);
    if (!row || row.query_hash !== hash(query)) throw new Error('CURSOR_INVALID');
    const expected = createHmac('sha256', this.cursorKey).update(JSON.stringify(['v1', 'durable', owner, repo, row.generation, row.query_hash, row.expires_at, false, id, row.position])).digest();
    const supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('CURSOR_INVALID');
    if (Number(row.expires_at) <= now || row.generation !== this.manifest(owner, repo).generation) throw new Error('CURSOR_STALE');
    return { generation: row.generation == null ? null : Number(row.generation), position: Number(row.position), expires_at: Number(row.expires_at), query_hash: row.query_hash as string };
  }

  /** Explicit maintenance accounting includes DB/WAL/blob files in active and sealed namespaces.
   * This is not invoked by status and is not quota enforcement (Phase 5).
   */
  refreshAccounting(): number {
    const size = (path: string): number => {
      if (!existsSync(path)) return 0;
      const info = statSync(path);
      if (!info.isDirectory()) return info.size;
      return readdirSync(path).reduce((sum, entry) => sum + size(join(path, entry)), 0);
    };
    for (const row of this.registry.prepare('SELECT owner_key FROM owners').all()) {
      const owner = row.owner_key as string;
      this.registry.prepare('UPDATE owners SET accounted_bytes=? WHERE owner_key=?').run(size(join(this.root, 'owners', owner)), owner);
    }
    const ownerBytes = Number(this.registry.prepare('SELECT coalesce(sum(accounted_bytes),0) AS n FROM owners').get()?.n);
    const overhead = size(this.root) - ownerBytes + size(join(this.stateRoot, 'context-hmac.key'));
    this.registry.prepare('UPDATE device_accounting SET overhead_bytes=? WHERE singleton=1').run(overhead);
    return this.accountedBytes();
  }

  /** Accounted allocation includes sealed namespaces; actual-file scan is explicit, never status IO. */
  accountedBytes(): number {
    return Number(this.registry.prepare('SELECT coalesce(sum(accounted_bytes),0) + (SELECT overhead_bytes FROM device_accounting WHERE singleton=1) AS n FROM owners').get()?.n);
  }

  databaseFiles(): string[] {
    const result: string[] = [];
    const walk = (path: string) => { for (const entry of readdirSync(path)) {
      const child = join(path, entry);
      if (statSync(child).isDirectory()) walk(child);
      else if (/\.sqlite(?:-wal|-shm)?$/.test(entry)) result.push(child);
    } };
    walk(this.root); return result;
  }

  close(): void {
    for (const db of this.databases.values()) db.close();
    this.databases.clear(); this.registry.close();
  }
}
~~~~

### src/context/redact.ts

SHA-256 (UTF-8): `6076dc754cf284622fd521ae44ee4e5cffee232a8b47b29af59b4e5a28d33692`

~~~~typescript
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { utf8Prefix } from './text.js';

// Non-persistence callers may redact without a store; persistence always supplies the installation key.
const ephemeralKey = randomBytes(32);

export const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
export interface RedactedPayload {
  text: string;
  hash: string;
  originalBytes: number;
  retainedBytes: number;
  partial: boolean;
  state: 'retained' | 'redacted' | 'excluded' | 'binary';
}

/** This is the sole payload persistence boundary. Hashes cover retained bytes only. */
export function redact(input: string | Buffer, options: { path?: string; maxBytes?: number; key?: Buffer } = {}): RedactedPayload {
  const cap = options.maxBytes ?? MAX_PAYLOAD_BYTES;
  if (!Number.isInteger(cap) || cap < 0 || cap > MAX_PAYLOAD_BYTES) throw new Error('BUDGET_EXCEEDED');
  const tagKey = createHmac('sha256', options.key ?? ephemeralKey).update('redaction_tagging_v1').digest();
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let text = bytes.toString('utf8');
  let state: RedactedPayload['state'] = 'retained';
  const path = options.path?.replace(/\\/g, '/');
  if (path && /(?:^|\/)(?:\.env(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|credentials(?:\.[^/]*)?)(?:$|\/)/i.test(path)) {
    text = ''; state = 'excluded';
  } else if (bytes.includes(0) || text.includes('\uFFFD') || /[\x01-\x08\x0e-\x1f]/.test(text) || /(?:^|\s)[A-Za-z0-9+/]{256,}={0,2}(?:$|\s)/.test(text)) {
    text = ''; state = 'binary';
  } else {
    const patterns: [RegExp, string][] = [
      [/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z ]+ )?PRIVATE KEY-----|$)/g, 'private_key'],
      [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'bearer'],
      [/\b(?:api[_-]?key|access[_-]?token|secret[_-]?key)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, 'api_key'],
      [/\b(?:password|passwd|pwd)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, 'password'],
      [/\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, 'api_key'],
    ];
    for (const [pattern, cls] of patterns) text = text.replace(pattern, secret => {
      state = 'redacted';
      const tag = createHmac('sha256', tagKey).update(secret).digest('hex').slice(0, 16);
      return `[REDACTED:${cls}:${tag}]`;
    });
  }
  const partial = Buffer.byteLength(text) > cap;
  text = utf8Prefix(text, cap);
  return { text, hash: createHash('sha256').update(text).digest('hex'), originalBytes: bytes.length,
    retainedBytes: Buffer.byteLength(text), partial, state };
}
~~~~

### src/context/importer.ts

SHA-256 (UTF-8): `9925c443689cc619c1a747957a614a091d85bf251ef6509527e47e427b60d9fd`

~~~~typescript
import { readFileSync, statSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { ContextStore } from './store.js';

/** Explicit trusted-local import. Missing scope is never inferred from the active pairing. */
export function importLegacy(store: ContextStore, sourceFile: string) {
  if (statSync(sourceFile).size > 64 * 1024 * 1024) throw new Error('BUDGET_EXCEEDED');
  const result = { imported: 0, duplicates: 0, malformed: 0, quarantined: 0 };
  const quarantine = (line: string, reason: string) => {
    const fingerprint = createHash('sha256').update(reason).update(store.redactPayload(line).text).digest('hex');
    store.registry.prepare('INSERT OR IGNORE INTO import_quarantine VALUES(?,?,?)').run(fingerprint, reason, Date.now());
  };
  for (const line of readFileSync(sourceFile, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { result.malformed++; quarantine(line, 'malformed'); continue; }
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
        (typeof event.text !== 'string' && !(typeof event.toolName === 'string' && typeof event.timestamp === 'string' && event.output !== undefined))) {
      result.malformed++; quarantine(line, 'malformed'); continue;
    }
    const owner = event.owner_key, repo = event.repo_uuid;
    if (typeof owner !== 'string' || typeof repo !== 'string' || owner !== store.activeOwner() ||
        !store.registry.prepare('SELECT 1 FROM repositories WHERE owner_key=? AND repo_uuid=?').get(owner, repo)) {
      result.quarantined++; quarantine(line, 'unknown_scope'); continue;
    }
    const payload = typeof event.text === 'string' ? event.text : JSON.stringify({ toolName: event.toolName, arguments: event.arguments, output: event.output });
    const path = typeof event.path === 'string' ? event.path : event.arguments?.path;
    const safe = store.redactPayload(payload, { path: typeof path === 'string' ? path : undefined });
    // Deduplication hashes retained redacted text only, never the raw secret-bearing payload.
    const id = typeof event.id === 'string' || typeof event.id === 'number' ? store.redactPayload(String(event.id)).hash : safe.hash;
    const db = store.repoDatabase(owner, repo);
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = db.prepare('SELECT evidence_ref FROM legacy_imports WHERE legacy_id=? OR content_hash=? LIMIT 1').get(id, safe.hash);
      if (existing) {
        db.prepare('INSERT OR IGNORE INTO legacy_imports VALUES(?,?,?)').run(id, safe.hash, existing.evidence_ref);
        result.duplicates++;
      } else {
        const ref = randomBytes(24).toString('hex');
        db.prepare('INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES(?,?,?,?,?,?,?)')
          .run(ref, safe.text, safe.hash, safe.originalBytes, safe.retainedBytes, safe.state, Number(safe.partial));
        db.prepare('INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES(?,?,?)')
          .run(`legacy:${id}`, Number.isSafeInteger(event.accepted_at) ? event.accepted_at : Date.now(), ref);
        db.prepare('INSERT INTO legacy_imports VALUES(?,?,?)').run(id, safe.hash, ref);
        result.imported++;
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return result;
}
~~~~

### src/context/text.ts

SHA-256 (UTF-8): `bde14b42433d1a8de159e88a0bbcd94859d9e542890fd962ff66238a4c4dc7c6`

~~~~typescript
/** Match Vietnamese stroked d as well as combining accents on both sides of FTS. */
export function fold(text: string): string {
  return text.replace(/[đĐ]/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Return a byte-bounded prefix without splitting UTF-8 code points or surrogate pairs. */
export function utf8Prefix(text: string, cap: number): string {
  if (Buffer.byteLength(text) <= cap) return text;
  const buffer = Buffer.from(text);
  let end = Math.min(cap, buffer.length);
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end--;
  return buffer.subarray(0, end).toString('utf8');
}
~~~~

### src/context/migrations/index.ts

SHA-256 (UTF-8): `af357dd84323701448e2943bfb3b4216626ad5f9a01b013e6d032d68e627cdfa`

~~~~typescript
import type { DatabaseSync } from 'node:sqlite';
import { fold } from '../text.js';

const registry = `
CREATE TABLE device_accounting(singleton INTEGER PRIMARY KEY CHECK(singleton=1), overhead_bytes INTEGER NOT NULL DEFAULT 0);
INSERT INTO device_accounting VALUES(1,0);
CREATE TABLE owners(owner_key TEXT PRIMARY KEY, pairing_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','sealed')), created_at INTEGER NOT NULL, accounted_bytes INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX one_active_owner ON owners(status) WHERE status='active';
CREATE TABLE repositories(repo_uuid TEXT PRIMARY KEY, owner_key TEXT NOT NULL REFERENCES owners(owner_key), identity TEXT NOT NULL, created_at INTEGER NOT NULL, accounted_bytes INTEGER NOT NULL DEFAULT 0, UNIQUE(owner_key,identity));
CREATE TABLE worktrees(worktree_uuid TEXT PRIMARY KEY, repo_uuid TEXT NOT NULL REFERENCES repositories(repo_uuid), canonical_root TEXT NOT NULL, UNIQUE(repo_uuid,canonical_root));
`;
const repo = `
CREATE TABLE evidence(ref TEXT PRIMARY KEY, text TEXT NOT NULL, hash TEXT NOT NULL, original_bytes INTEGER NOT NULL, retained_bytes INTEGER NOT NULL, redaction_state TEXT NOT NULL, partial INTEGER NOT NULL);
CREATE TABLE events(event_id INTEGER PRIMARY KEY, invocation_id TEXT UNIQUE NOT NULL, accepted_at INTEGER NOT NULL, execution_status TEXT NOT NULL DEFAULT 'succeeded', recording_status TEXT NOT NULL DEFAULT 'committed', payload_ref TEXT REFERENCES evidence(ref));
CREATE VIRTUAL TABLE evidence_fts USING fts5(ref UNINDEXED,text,tokenize='unicode61 remove_diacritics 2');
CREATE TABLE activity_nodes(node_id TEXT PRIMARY KEY, kind TEXT NOT NULL, evidence_ref TEXT REFERENCES evidence(ref));
CREATE TABLE activity_edges(edge_id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES activity_nodes(node_id), target TEXT NOT NULL REFERENCES activity_nodes(node_id), relation TEXT NOT NULL, evidence_ref TEXT NOT NULL REFERENCES evidence(ref));
CREATE TABLE generations(generation_id INTEGER PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('shadow','published')), indexed_through_event INTEGER NOT NULL DEFAULT 0, manifest_hash TEXT, created_at INTEGER NOT NULL);
CREATE TABLE manifest(singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation INTEGER REFERENCES generations(generation_id));
INSERT INTO manifest VALUES(1,NULL);
CREATE TABLE cursors(token_id TEXT PRIMARY KEY, generation INTEGER, query_hash TEXT NOT NULL, position INTEGER NOT NULL, expires_at INTEGER NOT NULL);
`;
const unscoped = `CREATE TABLE gaps(gap_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, reason TEXT NOT NULL CHECK(reason IN ('outside_repo','ambiguous_multi_repo','repo_resolution_failed','quota')));`;

/** Versioned transactional migration; future schema is never replaced by an empty DB. */
export function migrate(db: DatabaseSync, kind: 'registry' | 'repo' | 'unscoped'): void {
  db.exec('PRAGMA busy_timeout=5000');
  let version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
  if (version > 3) throw new Error('INDEX_INCOMPATIBLE');
  if (version === 3) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    // Another opener may have migrated while we waited for the write lock.
    version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
    if (version > 3) throw new Error('INDEX_INCOMPATIBLE');
    if (version === 3) { db.exec('COMMIT'); return; }
    if (version === 0) db.exec({ registry, repo, unscoped }[kind]);
    if (kind === 'registry' && version < 2) db.exec(`CREATE TABLE import_quarantine(fingerprint TEXT PRIMARY KEY, reason TEXT NOT NULL, first_seen INTEGER NOT NULL);`);
    if (kind === 'repo' && version === 1) {
      const fts = db.prepare("SELECT 1 FROM sqlite_master WHERE name='evidence_fts'").get();
      if (fts) db.exec(`
        CREATE VIRTUAL TABLE evidence_fts_v2 USING fts5(ref UNINDEXED,text,tokenize='unicode61 remove_diacritics 2');
        INSERT INTO evidence_fts_v2(ref,text) SELECT ref,text FROM evidence_fts;
        DROP TABLE evidence_fts;
        ALTER TABLE evidence_fts_v2 RENAME TO evidence_fts;
      `);
    }
    if (kind === 'repo' && version < 2) db.exec(`
      CREATE TABLE legacy_imports(legacy_id TEXT PRIMARY KEY, content_hash TEXT NOT NULL, evidence_ref TEXT NOT NULL REFERENCES evidence(ref));
      CREATE INDEX legacy_content ON legacy_imports(content_hash);
      CREATE TABLE search_documents(ref TEXT PRIMARY KEY REFERENCES evidence(ref), source_kind TEXT NOT NULL, timestamp INTEGER NOT NULL,
        first_indexed_generation INTEGER NOT NULL, last_indexed_generation INTEGER NOT NULL);
      ALTER TABLE evidence ADD COLUMN retention_state TEXT NOT NULL DEFAULT 'available';
    `);
    if (kind === 'repo') {
      db.exec('ALTER TABLE search_documents ADD COLUMN deleted_generation INTEGER;');
      // Rebuild only already indexed redacted content with the new folding rule.
      const rows = db.prepare('SELECT ref,text FROM evidence_fts').all();
      db.exec('DELETE FROM evidence_fts');
      const insert = db.prepare('INSERT INTO evidence_fts(ref,text) VALUES(?,?)');
      for (const row of rows) insert.run(row.ref, fold(String(row.text)));
    }
    db.exec('PRAGMA user_version=3; COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
~~~~

### src/context/indexer.ts

SHA-256 (UTF-8): `fe72b36ca3da8e3462df7ab4d789b2888b3a282cefe117a6626df47f4048f525`

~~~~typescript
import { createHash } from 'node:crypto';
import { ContextStore } from './store.js';
import { fold } from './text.js';

/** Incremental materialization of committed evidence, never filesystem discovery. */
export function sync(store: ContextStore, owner: string, repo: string, options: { max_events?: number } = {}) {
  const cap = options.max_events ?? 1000;
  if (!Number.isInteger(cap) || cap < 1 || cap > 10000) throw new Error('BUDGET_EXCEEDED');
  const db = store.repoDatabase(owner, repo);
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = store.manifest(owner, repo);
    const events = db.prepare(`SELECT e.event_id,e.accepted_at,e.payload_ref,p.text,p.retention_state FROM events e
      LEFT JOIN evidence p ON p.ref=e.payload_ref WHERE e.event_id>? ORDER BY e.event_id LIMIT ?`).all(current.indexed_through_event, cap);
    if (!events.length && current.generation !== null) { db.exec('COMMIT'); return { ...current, indexed: 0 }; }
    const generation = Number(db.prepare("INSERT INTO generations(status,created_at) VALUES('shadow',?)").run(Date.now()).lastInsertRowid);
    for (const event of events) {
      if (event.payload_ref === null || event.text === null || event.retention_state !== 'available') continue;
      // A replay refreshes derived data but preserves original membership and tombstones.
      db.prepare(`INSERT INTO search_documents(ref,source_kind,timestamp,first_indexed_generation,last_indexed_generation)
        VALUES(?,'history',?,?,?) ON CONFLICT(ref) DO UPDATE SET last_indexed_generation=excluded.last_indexed_generation`)
        .run(event.payload_ref, event.accepted_at, generation, generation);
      db.prepare('DELETE FROM evidence_fts WHERE ref=?').run(event.payload_ref);
      // FTS receives folded redacted content only; evidence retains display text.
      db.prepare('INSERT INTO evidence_fts(ref,text) VALUES(?,?)').run(event.payload_ref, fold(String(event.text)));
    }
    const through = events.length ? Number(events[events.length - 1].event_id) : current.indexed_through_event;
    const digest = createHash('sha256').update(`${current.manifest_hash ?? ''}:${generation}:${through}`).digest('hex');
    db.prepare("UPDATE generations SET status='published',indexed_through_event=?,manifest_hash=? WHERE generation_id=?").run(through, digest, generation);
    db.prepare('UPDATE manifest SET generation=? WHERE singleton=1').run(generation);
    db.exec('COMMIT'); return { ...store.manifest(owner, repo), indexed: events.length };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
~~~~

### test/context/retrieval.test.js

SHA-256 (UTF-8): `ae0593ecef228078282d3df6eb6c602d106d65e5bea474555c9dde747954a3c0`

~~~~javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { ContextStore } from '../../dist/context/store.js';
import { migrate } from '../../dist/context/migrations/index.js';
import { ContextService } from '../../dist/context/service.js';
import { sync } from '../../dist/context/indexer.js';
import { temporary } from './helpers.js';

test('pinned pagination retains page-two reindexed rows and excludes new generations', t => {
  const { store, owner, repo, service } = setup(t);
  for (let i = 0; i < 5; i++) store.append(owner, repo, `snapshot evidence ${i}`);
  sync(store, owner, repo);
  const expected = service.search(owner, repo, { query: 'snapshot', limit: 50 }).items.map(item => item.ref);
  const first = service.search(owner, repo, { query: 'snapshot', limit: 2 });
  const generation = first.index.generation;
  const db = store.repoDatabase(owner, repo);
  // Replay retained evidence through the real event materialization/upsert path.
  db.prepare('INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES(?,?,?)').run('reindex-page-two', Date.now(), expected[2]);
  store.append(owner, repo, 'snapshot new generation');
  sync(store, owner, repo);
  assert.equal(store.manifest(owner, repo).generation, generation + 1);
  const reindexed = db.prepare('SELECT * FROM search_documents WHERE ref=?').get(expected[2]);
  assert.equal(reindexed.first_indexed_generation, generation);
  assert.equal(reindexed.last_indexed_generation, generation + 1);
  assert.equal(reindexed.deleted_generation, null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence_fts WHERE ref=?').get(expected[2]).n, 1);
  let cursor = first.next_cursor, refs = first.items.map(item => item.ref);
  while (cursor) {
    const page = service.search(owner, repo, { query: 'snapshot', limit: 2, cursor });
    assert.equal(page.index.generation, generation);
    refs.push(...page.items.map(item => item.ref)); cursor = page.next_cursor;
  }
  assert.deepEqual(refs, expected);
});

test('pinned generation excludes a clock-skewed G+1 event older than the cursor', t => {
  const { store, owner, repo, service } = setup(t);
  const db = store.repoDatabase(owner, repo);
  for (let i = 0; i < 5; i++) {
    const ref = store.append(owner, repo, `clock snapshot ${i}`);
    db.prepare('UPDATE events SET accepted_at=? WHERE payload_ref=?').run(1000 + i, ref);
  }
  sync(store, owner, repo);
  const expected = service.search(owner, repo, { query: 'clock', limit: 50 }).items.map(item => item.ref);
  const first = service.search(owner, repo, { query: 'clock', limit: 2 });
  const state = store.parseReadCursor(owner, repo, first.next_cursor);
  const skewed = store.append(owner, repo, 'clock snapshot skewed');
  db.prepare('UPDATE events SET accepted_at=? WHERE payload_ref=?').run(state.last_timestamp - 1, skewed);
  sync(store, owner, repo);
  assert.equal(store.manifest(owner, repo).generation, first.index.generation + 1);
  assert.ok(service.search(owner, repo, { query: 'clock', limit: 50 }).items.some(item => item.ref === skewed));
  const actual = first.items.map(item => item.ref);
  let cursor = first.next_cursor;
  while (cursor) {
    const page = service.search(owner, repo, { query: 'clock', limit: 2, cursor });
    assert.equal(page.index.generation, first.index.generation);
    assert.ok(!page.items.some(item => item.ref === skewed));
    actual.push(...page.items.map(item => item.ref));
    cursor = page.next_cursor;
  }
  assert.deepEqual(actual, expected);
});

test('read continuation cannot be replayed against different refs in the same repo', t => {
  const { store, owner, repo, service } = setup(t);
  const ref = store.append(owner, repo, 'retained text '.repeat(1000));
  const other = store.append(owner, repo, 'other retained text');
  sync(store, owner, repo);
  const page = service.read(owner, repo, { refs: [ref], max_bytes: 2000 });
  assert.ok(page.next_cursor);
  assert.throws(() => service.read(owner, repo, { refs: [other], cursor: page.next_cursor }), /CURSOR_INVALID/);
  assert.doesNotThrow(() => service.read(owner, repo, { refs: [ref], cursor: page.next_cursor }));
});

test('pinned keyset pagination ignores BM25 shifts after new-generation inserts', t => {
  const { store, owner, repo, service } = setup(t);
  const db = store.repoDatabase(owner, repo);
  const texts = Array.from({ length: 10 }, (_, i) =>
    i % 2 ? 'beta '.repeat(i + 1) + 'filler '.repeat(i * 7) : 'alpha '.repeat(i + 1) + 'filler '.repeat(i * 3));
  const refs = texts.map((text, i) => {
    const ref = store.append(owner, repo, text);
    // Include equal timestamps to exercise the ref tie-break, not just time ordering.
    db.prepare('UPDATE events SET accepted_at=? WHERE payload_ref=?').run(1000 + Math.floor(i / 2), ref);
    return ref;
  });
  sync(store, owner, repo);
  const scores = () => db.prepare("SELECT ref,bm25(evidence_fts) AS score FROM evidence_fts WHERE evidence_fts MATCH 'alpha OR beta' ORDER BY ref").all();
  const before = scores();
  assert.ok(new Set(before.map(row => row.score)).size > 1);
  const expected = db.prepare('SELECT ref FROM search_documents ORDER BY timestamp DESC,ref ASC').all().map(row => row.ref);
  const first = service.search(owner, repo, { query: 'alpha beta', limit: 2 });
  assert.deepEqual(first.items.map(item => item.ref), expected.slice(0, 2));
  const generation = first.index.generation;
  for (let i = 0; i < 30; i++) store.append(owner, repo,
    i % 3 ? 'alpha '.repeat(20 + i) : 'beta '.repeat(i + 1) + 'filler '.repeat(100 + i));
  sync(store, owner, repo);
  const after = scores();
  assert.ok(before.some(row => row.score !== after.find(next => next.ref === row.ref).score), 'global BM25 statistics actually changed');
  let cursor = first.next_cursor;
  const actual = first.items.map(item => item.ref);
  while (cursor) {
    const page = service.search(owner, repo, { query: 'alpha beta', limit: 2, cursor });
    assert.equal(page.index.generation, generation);
    actual.push(...page.items.map(item => item.ref));
    cursor = page.next_cursor;
  }
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, refs.length);
  assert.deepEqual(new Set(actual), new Set(refs));
});

test('stable exact-match bucket precedes newer FTS-only matches across keyset pages', t => {
  const { store, owner, repo, service } = setup(t);
  const db = store.repoDatabase(owner, repo);
  const exact = store.append(owner, repo, 'src/context/store.ts ContextStore');
  db.prepare('UPDATE events SET accepted_at=1 WHERE payload_ref=?').run(exact);
  const ftsOnly = store.append(owner, repo, 'src/context/indexer.ts');
  sync(store, owner, repo);
  const first = service.search(owner, repo, { query: 'src/context/store.ts', limit: 1 });
  assert.equal(first.items[0].ref, exact);
  assert.equal(first.items[0].match_reason, 'exact');
  const second = service.search(owner, repo, { query: 'src/context/store.ts', limit: 1, cursor: first.next_cursor });
  assert.equal(second.items[0].ref, ftsOnly);
  assert.equal(second.items[0].match_reason, 'fts');
  assert.equal(second.next_cursor, null);
});

test('expired authenticated search and read cursors are stale at the domain boundary', t => {
  const { store, owner, repo, service } = setup(t);
  const refs = [store.append(owner, repo, 'foo safe payload '.repeat(500)), store.append(owner, repo, 'foo second')];
  sync(store, owner, repo);
  const searchPage = service.search(owner, repo, { query: 'foo', limit: 1 });
  const readPage = service.read(owner, repo, { refs: [refs[0]], max_bytes: 2000 });
  for (const [cursor, resume] of [
    [searchPage.next_cursor, token => service.search(owner, repo, { query: 'foo', limit: 1, cursor: token })],
    [readPage.next_cursor, token => service.read(owner, repo, { refs: [refs[0]], cursor: token })],
  ]) {
    assert.ok(cursor);
    const expired = store.signReadCursor(owner, repo, {
      ...store.parseReadCursor(owner, repo, cursor), expires_at: Date.now() - 1000,
    });
    // The store authenticates metadata; continuation enforces its lifetime.
    assert.ok(store.parseReadCursor(owner, repo, expired).expires_at < Date.now());
    assert.throws(() => resume(expired), { message: 'CURSOR_STALE' });
  }
});

test('read cursor issued at G is stale after publication of G+1', t => {
  const { store, owner, repo, service } = setup(t);
  const ref = store.append(owner, repo, 'retained text '.repeat(1000));
  sync(store, owner, repo);
  const page = service.read(owner, repo, { refs: [ref], max_bytes: 2000 });
  assert.ok(page.next_cursor);
  assert.equal(store.parseReadCursor(owner, repo, page.next_cursor).generation, page.index.generation);
  store.append(owner, repo, 'new generation');
  sync(store, owner, repo);
  assert.equal(store.manifest(owner, repo).generation, page.index.generation + 1);
  assert.throws(() => service.read(owner, repo, { refs: [ref], cursor: page.next_cursor }), { message: 'CURSOR_STALE' });
});

test('one-byte payload tampering with the original MAC is invalid', t => {
  const { store, owner, repo, service } = setup(t);
  for (let i = 0; i < 3; i++) store.append(owner, repo, `foo payload ${i}`);
  sync(store, owner, repo);
  const page = service.search(owner, repo, { query: 'foo', limit: 1 });
  assert.ok(page.next_cursor);
  const [body, mac] = page.next_cursor.split('.');
  const original = Buffer.from(body, 'base64url'), changed = Buffer.from(original);
  const index = original.indexOf(Buffer.from('"position":0')) + '"position":'.length;
  assert.equal(original[index], '0'.charCodeAt(0));
  changed[index] = '1'.charCodeAt(0); // Valid JSON, precisely one payload byte differs.
  assert.equal(changed.filter((byte, i) => byte !== original[i]).length, 1);
  assert.doesNotThrow(() => JSON.parse(changed.toString('utf8')));
  const tampered = `${changed.toString('base64url')}.${mac}`;
  assert.throws(() => store.parseReadCursor(owner, repo, tampered), { message: 'CURSOR_INVALID' });
  assert.throws(() => service.search(owner, repo, { query: 'foo', limit: 1, cursor: tampered }), { message: 'CURSOR_INVALID' });
});

test('query mismatch and search/read/durable kind confusion are invalid', t => {
  const { store, owner, repo, service } = setup(t);
  const ref = store.append(owner, repo, 'foo safe payload '.repeat(1000));
  store.append(owner, repo, 'foo another payload');
  sync(store, owner, repo);
  const searchPage = service.search(owner, repo, { query: 'foo', limit: 1 });
  const readPage = service.read(owner, repo, { refs: [ref], max_bytes: 2000 });
  assert.ok(searchPage.next_cursor); assert.ok(readPage.next_cursor);
  assert.doesNotThrow(() => service.search(owner, repo, { query: 'foo', limit: 1, cursor: searchPage.next_cursor }));
  assert.doesNotThrow(() => service.read(owner, repo, { refs: [ref], cursor: readPage.next_cursor }));
  assert.throws(() => service.search(owner, repo, { query: 'bar', limit: 1, cursor: searchPage.next_cursor }), { message: 'CURSOR_INVALID' });
  assert.throws(() => service.read(owner, repo, { refs: [ref], cursor: searchPage.next_cursor }), { message: 'CURSOR_INVALID' });
  assert.throws(() => service.search(owner, repo, { query: 'foo', limit: 1, cursor: readPage.next_cursor }), { message: 'CURSOR_INVALID' });
  const durable = store.cursor(owner, repo, 'foo', 0);
  assert.throws(() => store.parseReadCursor(owner, repo, durable), { message: 'CURSOR_INVALID' });
});

test('current retention availability overrides pinned generation for purged evidence', t => {
  const { store, owner, repo, service } = setup(t);
  for (let i = 0; i < 5; i++) store.append(owner, repo, `retention payload ${i}`);
  sync(store, owner, repo);
  const expected = service.search(owner, repo, { query: 'retention', limit: 50 }).items.map(item => item.ref);
  const first = service.search(owner, repo, { query: 'retention', limit: 1 });
  assert.ok(first.next_cursor);
  const purged = expected[2];
  store.repoDatabase(owner, repo).prepare("UPDATE evidence SET retention_state='purged' WHERE ref=?").run(purged);
  store.append(owner, repo, 'retention new generation');
  sync(store, owner, repo);
  assert.equal(store.manifest(owner, repo).generation, first.index.generation + 1);
  const actual = first.items.map(item => item.ref);
  let cursor = first.next_cursor;
  while (cursor) {
    const page = service.search(owner, repo, { query: 'retention', limit: 1, cursor });
    assert.equal(page.index.generation, first.index.generation);
    actual.push(...page.items.map(item => item.ref)); cursor = page.next_cursor;
  }
  assert.deepEqual(actual, expected.filter(ref => ref !== purged));
  assert.equal(service.read(owner, repo, { refs: [purged] }).items[0].error, 'EVIDENCE_EXPIRED');
});

test('Vietnamese stroked d folds on index and query sides', t => {
  const { store, owner, repo, service } = setup(t);
  const accented = store.append(owner, repo, 'ĐƯỜNG DẪN'), plain = store.append(owner, repo, 'duong dan');
  sync(store, owner, repo);
  for (const query of ['đường dẫn', 'duong dan', 'ĐƯỜNG DẪN', 'đường', 'duong']) {
    assert.deepEqual(new Set(service.search(owner, repo, { query }).items.map(item => item.ref)), new Set([accented, plain]));
  }
});

test('v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL', t => {
  const { store, owner, repo, service } = setup(t);
  const ref = store.append(owner, repo, 'ĐƯỜNG DẪN');
  sync(store, owner, repo);
  const db = store.repoDatabase(owner, repo);
  // Reconstruct the actual v2 column layout and pre-v3 (unfolded) FTS data.
  db.exec('ALTER TABLE search_documents DROP COLUMN deleted_generation; PRAGMA user_version=2; DELETE FROM evidence_fts;');
  db.prepare('INSERT INTO evidence_fts(ref,text) SELECT ref,text FROM evidence').run();
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence_fts WHERE evidence_fts MATCH 'duong'").get().n, 0);
  migrate(db, 'repo');
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
  assert.equal(db.prepare('SELECT deleted_generation FROM search_documents WHERE ref=?').get(ref).deleted_generation, null);
  assert.equal(db.prepare('SELECT text FROM evidence_fts WHERE ref=?').get(ref).text, 'duong dan');
  const items = service.search(owner, repo, { query: 'duong' }).items;
  assert.deepEqual(items.map(item => item.ref), [ref]);
  assert.equal(items[0].snippet, 'ĐƯỜNG DẪN');
  assert.equal(store.read(owner, repo, ref).text, 'ĐƯỜNG DẪN');
});

async function migrationRace(t, committedVersion) {
  const { store, owner, repo } = setup(t);
  const db = store.repoDatabase(owner, repo);
  const ref = store.append(owner, repo, 'migration sentinel');
  sync(store, owner, repo);
  db.exec('ALTER TABLE search_documents DROP COLUMN deleted_generation; PRAGMA user_version=2;');
  // Handle A applies v3 changes but holds its write lock without committing.
  db.exec('BEGIN IMMEDIATE; ALTER TABLE search_documents ADD COLUMN deleted_generation INTEGER;');
  db.exec('DELETE FROM evidence_fts; INSERT INTO evidence_fts(ref,text) SELECT ref,lower(text) FROM evidence;');
  db.exec(`PRAGMA user_version=${committedVersion}`);
  const schemaVersion = db.prepare('PRAGMA schema_version').get().schema_version;
  const signal = new Int32Array(new SharedArrayBuffer(8));
  const worker = new Worker(new URL('./fixtures/migration-worker.js', import.meta.url), { workerData: {
    path: store.databaseFiles().find(file => file.endsWith('context.sqlite')), signal: signal.buffer,
  } });
  const finished = new Promise((resolve, reject) => {
    worker.once('message', resolve); worker.once('error', reject);
    worker.once('exit', code => { if (code !== 0) reject(new Error(`migration worker exited ${code}`)); });
  });
  finished.catch(() => {}); // Cleanup must not cause an unhandled rejection.
  try {
    assert.notEqual(Atomics.wait(signal, 0, 0, 5000), 'timed-out', 'B reached BEGIN IMMEDIATE');
    assert.equal(Atomics.wait(signal, 1, 0, 150), 'timed-out', 'B waits on the held write lock');
    assert.equal(Atomics.load(signal, 1), 0);
    db.exec('COMMIT');
    const result = await finished;
    assert.deepEqual(result.versions, [2, committedVersion], 'version rechecked after waiting');
    assert.equal(result.busyTimeout, 5000);
    assert.equal(result.changes, 0, 'B performs no DML');
    assert.equal(result.schemaVersion, schemaVersion, 'B performs no DDL');
    assert.equal(result.transactionReleased, true, result.transactionError);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, committedVersion);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(db.prepare('PRAGMA table_info(search_documents)').all().filter(row => row.name === 'deleted_generation').length, 1);
    assert.equal(db.prepare('SELECT text FROM evidence_fts WHERE ref=?').get(ref).text, 'migration sentinel');
    db.exec('BEGIN IMMEDIATE; ROLLBACK'); // A can also reacquire the released lock.
    return result;
  } finally {
    await worker.terminate();
    try { db.exec('ROLLBACK'); } catch { /* A already committed. */ }
  }
}

test('concurrent migration opener waits and rechecks v3, then commits without DDL', { timeout: 15000 }, async t => {
  const result = await migrationRace(t, 3);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.sql, ['PRAGMA busy_timeout=5000', 'BEGIN IMMEDIATE', 'COMMIT']);
});

test('concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction', { timeout: 15000 }, async t => {
  const result = await migrationRace(t, 4);
  assert.equal(result.error, 'INDEX_INCOMPATIBLE');
  assert.deepEqual(result.sql, ['PRAGMA busy_timeout=5000', 'BEGIN IMMEDIATE', 'ROLLBACK']);
});

test('v3 migration rolls back pre-commit failure and process crash, then reruns cleanly', t => {
  const { store, owner, repo, service } = setup(t);
  const ref = store.append(owner, repo, 'ĐƯỜNG DẪN');
  sync(store, owner, repo);
  const db = store.repoDatabase(owner, repo);
  db.exec('ALTER TABLE search_documents DROP COLUMN deleted_generation; PRAGMA user_version=2; DELETE FROM evidence_fts;');
  db.prepare('INSERT INTO evidence_fts(ref,text) SELECT ref,text FROM evidence').run();
  const originalRows = db.prepare('SELECT ref,text FROM evidence_fts').all();
  const assertV2 = () => {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
    assert.ok(!db.prepare('PRAGMA table_info(search_documents)').all().some(row => row.name === 'deleted_generation'));
    assert.deepEqual(db.prepare('SELECT ref,text FROM evidence_fts').all(), originalRows);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  };
  // Inject only a failure at the final commit boundary, using real SQLite for every operation.
  const failing = {
    prepare: sql => db.prepare(sql),
    exec: sql => {
      if (sql === 'PRAGMA user_version=3; COMMIT') throw new Error('simulated pre-commit failure');
      return db.exec(sql);
    },
  };
  assert.throws(() => migrate(failing, 'repo'), /simulated pre-commit failure/);
  assertV2();
  const path = store.databaseFiles().find(file => file.endsWith('context.sqlite'));
  const migrationUrl = new URL('../../dist/context/migrations/index.js', import.meta.url).href;
  // Exit a separate process with its write transaction still open: no JS rollback/close runs.
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { DatabaseSync } from 'node:sqlite';
    import { migrate } from ${JSON.stringify(migrationUrl)};
    const db = new DatabaseSync(${JSON.stringify(path)});
    const exec = db.exec.bind(db);
    db.exec = sql => {
      if (sql === 'PRAGMA user_version=3; COMMIT') process.exit(73);
      return exec(sql);
    };
    migrate(db, 'repo');
    process.exit(74);
  `], { encoding: 'utf8', timeout: 10000 });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 73, child.stderr);
  assertV2();
  migrate(db, 'repo');
  migrate(db, 'repo'); // Idempotent rerun must not duplicate columns or rebuild to empty.
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare('PRAGMA table_info(search_documents)').all().filter(row => row.name === 'deleted_generation').length, 1);
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='evidence_fts'").get().sql;
  assert.ok(!/content\s*=/i.test(schema), 'standard stored-content FTS5, not external/contentless');
  assert.equal(db.prepare('SELECT text FROM evidence_fts WHERE ref=?').get(ref).text, 'duong dan');
  assert.equal(service.search(owner, repo, { query: 'duong' }).items[0].snippet, 'ĐƯỜNG DẪN');
});

export function setup(t) {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('a'), repo = store.repository(owner, 'r');
  return { store, owner, repo, service: new ContextService(store) };
}
test('search/status are read-only, Unicode-aware, bounded and never sync implicitly', t => {
  const { store, owner, repo, service } = setup(t);
  assert.equal(service.status(owner, repo).index.freshness, 'missing');
  assert.throws(() => service.search(owner, repo, { query: 'query' }), /INDEX_MISSING/);
  assert.equal(store.databaseFiles().length, 3); // registry, WAL, SHM only
  const refs = Array.from({ length: 5 }, (_, i) => store.append(owner, repo, `kiểm tra bộ nhớ src/context/store.ts ContextStore ${i}`));
  sync(store, owner, repo);
  const before = store.databaseFiles().filter(path => !path.endsWith('-shm')).map(path => [path, readFileSync(path)]);
  const page = service.search(owner, repo, { query: 'kiểm tra', limit: 2, max_bytes: 2000 });
  assert.equal(page.items.length, 2); assert.ok(page.next_cursor); assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 2000);
  const next = service.search(owner, repo, { query: 'kiểm tra', limit: 2, max_bytes: 2000, cursor: page.next_cursor });
  assert.equal(next.items.length, 2); assert.notEqual(next.items[0].ref, page.items[0].ref);
  for (const [path, bytes] of before) assert.deepEqual(readFileSync(path), bytes);
  assert.throws(() => service.search(owner, repo, { query: 'other', cursor: page.next_cursor }), /CURSOR_INVALID/);
  assert.throws(() => service.search(owner, repo, { query: 'kiểm tra', cursor: page.next_cursor + 'x' }), /CURSOR_INVALID/);
  const state = store.parseReadCursor(owner, repo, page.next_cursor);
  const expired = store.signReadCursor(owner, repo, { ...state, expires_at: 0 });
  assert.throws(() => service.search(owner, repo, { query: 'kiểm tra', limit: 2, cursor: expired }), /CURSOR_STALE/);
  // Re-indexing does not change the first-generation visibility of retained evidence.
  store.repoDatabase(owner, repo).prepare('UPDATE search_documents SET last_indexed_generation=? WHERE ref=?').run(state.generation + 1, refs[0]);
  assert.ok(service.search(owner, repo, { query: 'ContextStore' }).items.some(item => item.ref === refs[0]));
  store.append(owner, repo, 'pending evidence');
  assert.equal(service.search(owner, repo, { query: 'pending evidence' }).index.freshness, 'stale');
  assert.equal(service.search(owner, repo, { query: 'pending evidence' }).items.length, 0);
  sync(store, owner, repo);
  assert.equal(service.search(owner, repo, { query: 'kiểm tra', limit: 2, cursor: page.next_cursor }).items.length, 2);
  assert.throws(() => service.search(owner, repo, { query: 'x', max_bytes: 0 }), /BUDGET_EXCEEDED/);
  assert.throws(() => service.read(owner, repo, { refs: [refs[0]], max_bytes: 0 }), /BUDGET_EXCEEDED/);
  assert.throws(() => service.search(owner, repo, { query: 'x', max_bytes: 1 }), /BUDGET_EXCEEDED/);
  assert.doesNotThrow(() => service.search(owner, repo, { query: '" OR * NEAR( SQL --' }));
});
~~~~

### test/context/fixtures/migration-worker.js

SHA-256 (UTF-8): `f43901f2b9d4cbb8681f03b0d48e28dbe3d1c9eeb11869a59eded2cd63e80bc0`

~~~~javascript
import { parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../../../dist/context/migrations/index.js';

const db = new DatabaseSync(workerData.path);
// migrate must configure its own timeout, not rely on the caller/default.
db.exec('PRAGMA busy_timeout=1');
const signal = new Int32Array(workerData.signal), sql = [], versions = [];
const exec = db.exec.bind(db), prepare = db.prepare.bind(db);
// Instrument real SQLite operations, never simulate lock acquisition or migration.
db.prepare = text => {
  const statement = prepare(text);
  if (text !== 'PRAGMA user_version') return statement;
  return { get: () => { const row = statement.get(); versions.push(row.user_version); return row; } };
};
db.exec = text => {
  sql.push(text);
  if (text === 'BEGIN IMMEDIATE') { Atomics.store(signal, 0, 1); Atomics.notify(signal, 0); }
  return exec(text);
};
let error;
try { migrate(db, 'repo'); } catch (caught) { error = caught.message; }
const result = { error, sql, versions,
  busyTimeout: prepare('PRAGMA busy_timeout').get().timeout,
  changes: prepare('SELECT total_changes() AS n').get().n,
  schemaVersion: prepare('PRAGMA schema_version').get().schema_version };
// BEGIN would fail if migrate left a transaction dangling.
try { exec('BEGIN IMMEDIATE; ROLLBACK'); result.transactionReleased = true; }
catch (caught) { result.transactionError = caught.message; }
db.close();
Atomics.store(signal, 1, 1); Atomics.notify(signal, 1);
parentPort.postMessage(result);
~~~~

### test/context/store.test.js

SHA-256 (UTF-8): `630727f54ff9d87eea1ec02e88d0c5fa0614873fb2c7441cfea841f47bfc9cc4`

~~~~javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextStore } from '../../dist/context/store.js';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContextService } from '../../dist/context/service.js';
import { temporary } from './helpers.js';
test('WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors', t => {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('pair'), repo = store.repository(owner, 'common-dir');
  for (const db of [store.registry, store.repoDatabase(owner, repo), store.unscopedDatabase(owner)]) {
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    assert.equal(db.prepare('PRAGMA busy_timeout').get().timeout, 5000);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
  }
  const first = store.append(owner, repo, 'same'), second = store.append(owner, repo, 'same');
  assert.notEqual(first, second); assert.match(first, /^[a-f0-9]{48}$/);
  const g = store.beginGeneration(owner, repo); store.publishGeneration(owner, repo, g, 2, 'manifest-hash');
  const cursor = store.cursor(owner, repo, 'query', 1);
  assert.equal(store.validateCursor(owner, repo, cursor, 'query').position, 1);
  assert.throws(() => store.validateCursor(owner, repo, cursor.slice(0, -1) + (cursor.endsWith('a') ? 'b' : 'a'), 'query'), /CURSOR_INVALID/);
  assert.throws(() => store.validateCursor(owner, repo, cursor, 'different'), /CURSOR_INVALID/);
  const shadow = store.beginGeneration(owner, repo);
  assert.equal(store.manifest(owner, repo).generation, g);
  store.close(); store = new ContextStore(root);
  assert.equal(store.validateCursor(owner, repo, cursor, 'query').generation, g);
  store.publishGeneration(owner, repo, shadow, 2, 'new-manifest');
  assert.equal(store.manifest(owner, repo).generation, shadow);
  assert.throws(() => store.validateCursor(owner, repo, cursor, 'query'), /CURSOR_STALE/);
  assert.throws(() => store.cursor(owner, repo, 'q', 0, 1800001), /BUDGET_EXCEEDED/);
  const expired = store.cursor(owner, repo, 'q', 0, 1);
  assert.throws(() => store.validateCursor(owner, repo, expired, 'q', Date.now() + 10), /CURSOR_STALE/);
});
test('cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing', t => {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('pair'), repo = store.repository(owner, 'r'), otherRepo = store.repository(owner, 'other');
  const state = { position: 0, generation: 3, key: 'query-hash', expires_at: Date.now() + 600000 };
  const read = store.signReadCursor(owner, repo, state);
  const durable = store.cursor(owner, repo, 'q', 0);
  const key = createHmac('sha256', readFileSync(join(root, 'context-hmac.key'))).update('cursor_signing_v1').digest();
  const [body, mac] = read.split('.');
  assert.equal(mac, createHmac('sha256', key).update(JSON.stringify(['v1', 'read', owner, repo, state.generation, state.key, state.expires_at, false, body])).digest('hex'));
  for (const signature of ['', '00', 'a'.repeat(63), 'a'.repeat(66), 'z'.repeat(64)]) {
    assert.throws(() => store.parseReadCursor(owner, repo, `${body}.${signature}`), /^Error: CURSOR_INVALID$/);
    assert.throws(() => store.validateCursor(owner, repo, `${durable.split('.')[0]}.${signature}`, 'q'), /^Error: CURSOR_INVALID$/);
  }
  assert.throws(() => store.parseReadCursor(owner, repo, durable), /CURSOR_INVALID/);
  assert.throws(() => store.validateCursor(owner, repo, read, 'q'), /CURSOR_INVALID/);
  for (const field of ['generation', 'key', 'expires_at']) {
    const changed = { ...state, sealed: false, [field]: field === 'key' ? 'other-query' : state[field] + 1 };
    const changedBody = Buffer.from(JSON.stringify(changed)).toString('base64url');
    assert.throws(() => store.parseReadCursor(owner, repo, `${changedBody}.${mac}`), /CURSOR_INVALID/);
  }
  const wrongKind = createHmac('sha256', key).update(JSON.stringify(['v1', 'durable', owner, repo, false, body])).digest('hex');
  assert.throws(() => store.parseReadCursor(owner, repo, `${body}.${wrongKind}`), /CURSOR_INVALID/);
  assert.throws(() => store.parseReadCursor(owner, otherRepo, read), /CURSOR_INVALID/);
  assert.throws(() => store.validateCursor(owner, otherRepo, durable, 'q'), /CURSOR_INVALID/);
  assert.throws(() => store.validateCursor(owner, repo, durable, 'other-query'), /CURSOR_INVALID/);
  const invalidJson = Buffer.from('not JSON').toString('base64url');
  assert.throws(() => store.parseReadCursor(owner, repo, `${invalidJson}.${mac}`), /CURSOR_INVALID/);
  const modifiedBody = Buffer.from(JSON.stringify({ position: 99, sealed: false })).toString('base64url');
  assert.throws(() => store.parseReadCursor(owner, repo, `${modifiedBody}.${mac}`), /CURSOR_INVALID/);
  const originalParse = JSON.parse;
  let parses = 0;
  JSON.parse = (...args) => { parses++; return originalParse(...args); };
  try {
    // Valid JSON body, but only two decoded signature bytes: must never parse it.
    assert.throws(() => store.parseReadCursor(owner, repo, `${body}.abcd`), /CURSOR_INVALID/);
    assert.equal(parses, 0);
    assert.throws(() => store.parseReadCursor(owner, repo, `${modifiedBody}.${mac}`), /CURSOR_INVALID/);
    assert.equal(parses, 1); // Bound metadata is decoded, but never returned before MAC verification.
  } finally { JSON.parse = originalParse; }
  const nextOwner = store.activateOwner('next-pair');
  const nextRepo = store.repository(nextOwner, 'next');
  assert.throws(() => store.parseReadCursor(nextOwner, nextRepo, read), /CURSOR_INVALID/);
  assert.throws(() => store.parseReadCursor(owner, repo, read), /ACCESS_DENIED/);
});

test('JSON MAC encoding rejects colon-delimiter scope collisions across owners', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const registry = store.registry;
  registry.prepare("INSERT INTO owners(owner_key,pairing_hash,status,created_at) VALUES(?,?,'active',0)").run('owner:part', 'pair1');
  registry.prepare('INSERT INTO repositories(repo_uuid,owner_key,identity,created_at) VALUES(?,?,?,0)').run('repo', 'owner:part', 'r1');
  const token = store.signReadCursor('owner:part', 'repo', { position: 0 });
  assert.equal(store.parseReadCursor('owner:part', 'repo', token).position, 0);
  registry.exec("UPDATE owners SET status='sealed'");
  registry.prepare("INSERT INTO owners(owner_key,pairing_hash,status,created_at) VALUES(?,?,'active',0)").run('owner', 'pair2');
  registry.prepare('INSERT INTO repositories(repo_uuid,owner_key,identity,created_at) VALUES(?,?,?,0)').run('part:repo', 'owner', 'r2');
  // The old colon-concatenated MAC input is identical for these distinct authorized scopes.
  assert.equal('owner:part' + ':' + 'repo', 'owner' + ':' + 'part:repo');
  assert.throws(() => store.parseReadCursor('owner', 'part:repo', token), /CURSOR_INVALID/);
});

test('status is read-only, capture gaps are visible and jobs/stores have ownership bounds', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const owner = store.activateOwner('pair'), repo = store.repository(owner, 'repo');
  const service = new ContextService(store);
  const before = store.repoDatabase(owner, repo).prepare('SELECT total_changes() AS n').get().n;
  assert.equal(service.status(owner, repo).index.freshness, 'missing');
  assert.equal(store.repoDatabase(owner, repo).prepare('SELECT total_changes() AS n').get().n, before);
  store.append(owner, repo, 'pending'); service.captureGap(owner, repo, 'storage_unavailable');
  const status = service.status(owner, repo);
  assert.equal(status.index.pending_events, 1); assert.equal(status.capture_health.in_memory_gaps, 1); assert.equal(status.coverage.complete, false);
  const job = service.startJob(owner, repo, 'sync');
  assert.throws(() => service.startJob(owner, repo, 'rebuild'), /BUSY/);
  assert.equal(service.status(owner, repo).active_jobs.length, 1);
  service.finishJob(owner, repo, job);
  assert.equal(service.status(owner, repo).active_jobs.length, 0);
  for (let i = 1; i < 4; i++) service.startJob(owner, store.repository(owner, `job-${i}`), 'sync');
  service.startJob(owner, repo, 'sync');
  assert.throws(() => service.startJob(owner, store.repository(owner, 'fifth'), 'sync'), /BUSY/);
  store.recordUnscoped(owner, 'ambiguous_multi_repo');
  assert.equal(store.unscopedDatabase(owner).prepare('SELECT count(*) AS n FROM gaps').get().n, 1);
  const accounted = store.refreshAccounting();
  assert.ok(accounted > 0);
  store.activateOwner('new-pair'); assert.equal(store.accountedBytes(), accounted);
});
~~~~

### test/context/redaction.test.js

SHA-256 (UTF-8): `2865e99678f2cb080a2be220ccf6542e1ee74192bb1093c646786f23c80dcd67`

~~~~javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importLegacy } from '../../dist/context/importer.js';
import { sync } from '../../dist/context/indexer.js';
import { redact } from '../../dist/context/redact.js';
import { ContextStore } from '../../dist/context/store.js';
import { utf8Prefix } from '../../dist/context/text.js';
import { temporary } from './helpers.js';
const canaries = ['sk-canarysecret1234567890abcdef', 'bearer-canary-987654321', 'password-canary-1234', 'PRIVATECANARY'];
const input = `api_key=${canaries[0]}\nAuthorization: Bearer ${canaries[1]}\npassword="${canaries[2]}"\n-----BEGIN RSA PRIVATE KEY-----\n${canaries[3]}\n-----END RSA PRIVATE KEY-----\nretained sentence; safe payload`;
test('secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const safe = store.redactPayload(input);
  for (const secret of canaries) assert.ok(!safe.text.includes(secret));
  for (const cls of ['api_key', 'bearer', 'password', 'private_key']) assert.match(safe.text, new RegExp(`\\[REDACTED:${cls}:[a-f0-9]{16}\\]`));
  assert.equal(safe.hash, createHash('sha256').update(safe.text).digest('hex'));
  const owner = store.activateOwner('trusted-pairing'), repo = store.repository(owner, 'identity');
  const ref = store.append(owner, repo, input);
  const stored = store.read(owner, repo, ref);
  assert.equal(stored.text, safe.text);
  assert.ok(stored.text.includes('[REDACTED:api_key:'));
  assert.ok(stored.text.includes('safe payload'));
  for (const secret of canaries) assert.ok(!stored.text.includes(secret));
  const db = store.repoDatabase(owner, repo);
  const row = db.prepare('SELECT hash FROM evidence WHERE ref=?').get(ref);
  assert.equal(stored.hash, row.hash);
  assert.equal(row.hash, createHash('sha256').update(stored.text).digest('hex'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence_fts').get().n, 0); // capture never silently syncs
  sync(store, owner, repo);
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence_fts WHERE evidence_fts MATCH 'retained'").get().n, 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence_fts WHERE evidence_fts MATCH 'payload'").get().n, 1);
  const tokenBody = 'canarysecret1234567890abcdef';
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence_fts WHERE evidence_fts MATCH ?').get(tokenBody).n, 0);
  db.exec("CREATE VIRTUAL TABLE temp.vocab USING fts5vocab(main, evidence_fts, 'row')");
  assert.equal(db.prepare("SELECT count(*) AS n FROM temp.vocab WHERE term='payload'").get().n, 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM temp.vocab WHERE term LIKE '%canarysecret%'").get().n, 0);
  const shadows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'evidence_fts_*'").all();
  assert.deepEqual(shadows.map(row => row.name).sort(), [
    'evidence_fts_data', 'evidence_fts_idx', 'evidence_fts_content', 'evidence_fts_docsize', 'evidence_fts_config',
  ].sort());
  const files = store.databaseFiles();
  assert.ok(files.some(file => file.endsWith('context.sqlite')), 'main DB is scanned');
  assert.ok(files.some(file => file.endsWith('context.sqlite-wal')), 'live WAL is scanned');
  assert.ok(files.some(file => file.endsWith('context.sqlite-shm')), 'live SHM is scanned');
  for (const { name } of shadows) {
    for (const row of db.prepare(`SELECT * FROM "${name}"`).all()) {
      for (const value of Object.values(row)) {
        const bytes = ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(String(value));
        for (const secret of canaries) assert.ok(!bytes.includes(Buffer.from(secret)), `${name} contains raw canary`);
      }
    }
  }
  for (const file of store.databaseFiles()) {
    const bytes = readFileSync(file);
    assert.equal(bytes.toString('latin1').toLowerCase().split(tokenBody).length - 1, 0, `${file} contains token body`);
    for (const secret of canaries) assert.ok(!bytes.includes(Buffer.from(secret)), file);
  }
});
test('import deduplicates redacted content and indexes only redacted text', t => {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('a'), repo = store.repository(owner, 'r');
  const text = 'imported password=IMPORT_SECRET_CANARY', safe = store.redactPayload(text), file = join(root, 'import.jsonl');
  writeFileSync(file, [1, 2].map(id => JSON.stringify({ id, owner_key: owner, repo_uuid: repo, text })).join('\n'));
  assert.equal(importLegacy(store, file).duplicates, 1);
  const db = store.repoDatabase(owner, repo);
  assert.equal(db.prepare('SELECT content_hash FROM legacy_imports').get().content_hash, safe.hash);
  assert.notEqual(safe.hash, createHash('sha256').update(text).digest('hex'));
  sync(store, owner, repo);
  assert.ok(!db.prepare('SELECT text FROM evidence_fts').get().text.includes('IMPORT_SECRET_CANARY'));
  for (const path of store.databaseFiles()) assert.ok(!readFileSync(path).includes(Buffer.from('IMPORT_SECRET_CANARY')));
});

test('secret markers use keyed tags, never offline-guessable plain hashes', () => {
  const secret = 'password=guessable', key = Buffer.alloc(32, 1), otherKey = Buffer.alloc(32, 2);
  const safe = redact(secret, { key });
  const redactionKey = createHmac('sha256', key).update('redaction_tagging_v1').digest();
  const cursorKey = createHmac('sha256', key).update('cursor_signing_v1').digest();
  assert.notDeepEqual(redactionKey, cursorKey);
  const tag = createHmac('sha256', redactionKey).update(secret).digest('hex').slice(0, 16);
  assert.equal(safe.text, `[REDACTED:password:${tag}]`);
  assert.notEqual(safe.text, redact(secret, { key: otherKey }).text);
  assert.equal(safe.hash, createHash('sha256').update(safe.text).digest('hex'));
  assert.ok(!safe.text.includes(createHash('sha256').update(secret).digest('hex').slice(0, 16)));
});

test('UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs', () => {
  assert.equal(utf8Prefix('😀x', 0), '');
  assert.equal(redact('😀x', { maxBytes: 0 }).text, '');
  for (const cap of [1, 2, 3]) assert.equal(utf8Prefix('😀x', cap), '');
  assert.equal(utf8Prefix('😀x', 4), '😀');
  for (const cap of [2, 3, 4]) assert.equal(utf8Prefix('a\uD83D\uDE00b', cap), 'a');
  assert.equal(utf8Prefix('a\uD83D\uDE00b', 5), 'a😀');
  assert.equal(redact('a😀b', { maxBytes: 4 }).text, 'a');
  assert.equal(redact('a😀b', { maxBytes: 5 }).text, 'a😀');
});

test('excluded paths, binary/base64, UTF-8 byte caps and boundary secrets', () => {
  for (const path of ['.env', '.env.production', '/home/me/.ssh/id_rsa', 'credentials.json', 'C:\\project\\.env']) assert.equal(redact(input, { path }).text, '');
  assert.equal(redact(Buffer.from([0, 1, 2, 255])).state, 'binary');
  assert.equal(redact(Buffer.from('canary').toString('base64').repeat(200)).state, 'binary');
  const limited = redact('語'.repeat(200), { maxBytes: 100 });
  assert.ok(Buffer.byteLength(limited.text) <= 100); assert.ok(!limited.text.includes('�')); assert.equal(limited.partial, true);
  assert.ok(!redact('x'.repeat(90) + ' password=boundary-canary', { maxBytes: 100 }).text.includes('boundary'));
  assert.throws(() => redact('a', { maxBytes: 4194305 }), /BUDGET_EXCEEDED/);
  const json = redact(JSON.stringify({ api_key: 'json-key-canary', password: 'json-password-canary', nested: { access_token: 'json-token-canary' } }));
  assert.ok(!json.text.includes('json-key-canary')); assert.ok(!json.text.includes('json-password-canary')); assert.ok(!json.text.includes('json-token-canary'));
  assert.equal(redact('word '.repeat(838880)).retainedBytes, 4194304);
});
~~~~

### test/context/helpers.js

SHA-256 (UTF-8): `c768995998d7402f6bf9808fb7404eaf9c9c14a0613bae5dca6e955b6b2b7c5f`

~~~~javascript
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
export function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'context-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
export function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
export function initGit(root) {
  git(root, 'init');
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'initial');
}
~~~~

### evidence/context/decisions.md

SHA-256 (UTF-8): `3fe12b491e663d48c990502d96d4e9bf8bc754a12419e2641a7b3e7e48e5486d`

~~~~markdown
# Feature 002 / v1.0.11 implementation input freeze

## Authorization and precedence (T001)

The owner's instruction in this implementation session explicitly authorizes **Phase 1, T001–T006** in `E:/git-project/wt-mcp-device-111-context`: freeze accepted revision-2 inputs, create fixtures/probes, and verify them. This is not authorization to merge, publish, release, register public tools, enable live capture, or execute later phases. Revision-2 spec, API and policy are accepted as implementation inputs subject to the following explicit N1–N7 resolutions. Where older documents conflict, these owner-directed resolutions and `policy-v1.json` govern the freeze. No original review/snapshot is rewritten.

Owner's additional constraint: always ask whether the change is over-engineered; strictly follow YAGNI/KISS. Phase 1 adds only evidence, fixtures and direct tests, no production abstractions or behavior.

## Accepted Medium finding resolutions

- **N1 — Fail-open capture.** If authorized pre-dispatch intent cannot persist within the 5 ms budget, execute once anyway; mark capture degraded/gap, never replay side effects. Count a gap in memory when even the DB gap record cannot persist; expose that counter through `local_status` and do not claim complete coverage. If outcome persistence later succeeds, insert a late event with `recording_status=degraded` and missing-intent reason; it does not retroactively close the gap or invent a committed pre-intent. RAM counters are process-local, not durable.
- **N2 — Bounded writer batches and yield.** Maintenance write-lock batch target 5 ms, hard maximum 50 ms. Commit short batches and `await setImmediate` between them; no IO, parsing, compression or provider/network calls in transactions. Capture acquisition waits remain 5/10 ms, maintenance acquisition 100 ms. These are acceptance bounds, not a claim that synchronous SQLite can preempt a running statement. Online heavy DB work must not execute on the gateway websocket/heartbeat event loop; measure contention and responsiveness in T033 before live wiring. A 50 ms main-thread stall is not acceptable merely because it is below the lock ceiling.
- **N3 — Device-wide quota and cleanup gate.** Default total device quota is 8 GiB, covering active **and sealed** namespaces (including context DB/WAL/blob/derived state), in addition to owner 8 GiB/repo 2 GiB bounds. No metadata or payload age TTL, no silent old-evidence eviction; quota pressure degrades new writes. Plan a minimal owner-admin cleanup CLI, **local TTY only, never MCP**, with explicit interactive consent, namespace selection, registry/tombstone consistency, secret-removal and recovery tests. **Implementation is scheduled for Phase 5, before live capture**: enforce the total device quota and deliver/test the local owner-admin cleanup CLI together. These remain deferred at Checkpoint 1 (Phases 1–3); existing accounting is not quota enforcement. Cleanup verification is mandatory **before T047/live capture**. Do not treat an agent-provided confirmation token as human consent.
- **N4 — Pinned cursor visibility.** A cursor pinned to generation G queries only rows satisfying `first_indexed_generation <= G AND (deleted_generation IS NULL OR deleted_generation > G)`; never leak G+1 rows into later pages. `last_indexed_generation` is maintenance metadata, not a visibility bound: re-indexing an existing row must not remove it from an issued cursor's later pages. Advancing the manifest alone does not invalidate search cursors; keep their original generation and expiry. Deletion uses a generation tombstone, and retained display evidence remains subject to retention/access policy. If destructive maintenance makes the pinned view unavailable, return `CURSOR_STALE`, not silently inconsistent pagination. The Checkpoint 1 regression issues a cursor, re-indexes a page-two row, advances G to G+1, and checks all pages for skipped/extra rows. T034 must retain update, insert, deletion and unavailable-snapshot coverage.
- **N5 — Import redaction and truthful scope.** Every accepted legacy record must pass `src/context/redact.ts` before DB/blob/FTS persistence; quarantine malformed/unknown-owner or unknown-repo records without assigning them to the active namespace. Secret replacements carry a keyed HMAC-SHA256 tag truncated to 16 hex characters, using the domain-separated redaction subkey derived from the protected installation key (never a plain secret hash). Content hashes/deduplication are SHA-256 over retained **redacted** text, and FTS receives only folded redacted evidence. Include canary-secret tests in T016. Pre-handoff usefulness is on synthetic/explicitly scoped imported evidence and checkpoints, not a promise that arbitrary ownerless real history is automatically searchable. No speculative adoption workflow is authorized here.
- **N6 — Shared installation root key.** Store one device-local HMAC key at the device state root, outside repository stores, restricted to the OS user (POSIX owner-only permissions; Windows user ACL). CLI and MCP use the same key for parity. Keep it stable across re-pair; cursor owner/repo bindings still reject sealed/old-owner access. Authenticate owner ID, repository ID, sealed flag, generation, query hash, expiry and pagination position; verify with `crypto.timingSafeEqual`. Read cursors bind their full serialized state plus owner/repo/sealed scope; durable cursors bind the stored row state as well as their opaque token ID. Only active namespaces are accessible (`sealed=false`); callers cannot request sealed access. Derive independent HMAC-SHA256 subkeys with `HMAC(root, 'cursor_signing_v1')` and `HMAC(root, 'redaction_tagging_v1')`; the cursor key is not the redaction key. Cursor MAC input includes format version `v1` and cursor_kind `read` or `durable`. Length-check decoded MAC buffers before `timingSafeEqual`; authenticate read payload bytes before JSON parsing. Create the root key with exclusive `wx` and mode `0600`, with current-user ACL enforcement on Windows. Explicit key replacement invalidates existing cursors; never expose the key or state-root path in results. No key is created by this freeze.
- **N7 — Minimal disabled wiki.** Preserve the sixth name with `action: "status"` only; `readOnlyHint=true`, idempotent, non-destructive, closed-world. Return typed `WIKI_DISABLED`, `enabled=false`, feature `003-manual-repo-wiki`, with **zero provider calls** and no provider/library/config loading. Generation/read/export actions are not accepted schema actions. Feature 003 requires a controlled catalog refresh. Whole gateway catalog target remains <=10,000 estimated tokens (`ceil(UTF-8 serialized {tools} bytes / 4)`); no larger-budget approval is inferred.

## Checkpoint 1 targeted revision scope

H1/H2/H3/M1/M2/M5 authorize targeted corrections and regression tests in Phases 1–3, superseding the old N4 last-indexed visibility bound. Schema version 3 adds `deleted_generation` and folds existing redacted FTS rows; query-only access refuses incompatible stores instead of migrating. Both index and query normalization map `đ`/`Đ` to `d` before NFD accent removal. Payload, snippet and read-page clipping measure UTF-8 bytes and preserve complete code points, including emoji surrogate pairs. No new background scheduling, quota framework, cleanup interface or live capture is introduced by these corrections.

## Checkpoint 1 high-precision verification decisions

- **H1 — Pinned membership, not content versioning.** Evidence references retain in-place content semantics; Checkpoint 1 does not implement historical content versions/MVCC. Normal append/import creates new evidence refs; real re-index/upsert refreshes derived FTS text and `last_indexed_generation` only, preserving the original `first_indexed_generation`, original timestamp and any deletion tombstone. A pinned generation G stabilizes row membership using N4, not a historical copy of display text, match score or ordering after arbitrary content edits. Content-changing maintenance that would invalidate a pinned result must return `CURSOR_STALE` or wait until live cursors expire; it must not claim a byte-for-byte historical snapshot. The regression replays a real committed event through `sync` and its SQL upsert, advances G to G+1, and verifies the original first generation, one FTS row and complete page membership.
- **H1 / N3 — Physical cleanup rule.** Physical cleanup/GC must only purge tombstoned rows where `deleted_generation <= oldest_live_cursor_generation`; NULL tombstones are never eligible. With no live cursors, the published generation may serve as the cutoff. Preserve evidence and FTS backing rows required by older pinned cursors. Stateless read/search cursors are not currently enumerated in the durable cursor table: Phase 5 must establish a conservative live-cursor watermark (or wait out the full issuance/expiry window) before any GC. This rule is a required Phase 5 design/verification gate, not implemented cleanup. Migration v3 adds the nullable column without a non-NULL default, initializing existing rows to `deleted_generation = NULL`.
- **H2/H3 — Key separation and rotation.** One protected device-local 32-byte root key is shared by trusted CLI/MCP; cursor signing and redaction use distinct domain-separated subkeys specified in N6. The new derivation/MAC format invalidates pre-hardening cursors without a legacy fallback. Root-key rotation invalidates all issued cursors and changes tags for newly redacted secrets; existing retained redacted evidence/tags/hashes remain unchanged, so cross-rotation import deduplication is not guaranteed. Never reconstitute raw secrets or rewrite retained evidence merely to retag it. A version/domain change needs explicit migration/rotation review; key loss fails closed. Indexed real canaries are checked directly against every FTS5 shadow-table value (including BLOBs), as well as DB/WAL files.
- **M1/M2 — Migration and byte boundaries.** FTS indexing calls `fold` from `src/context/text.ts` before insertion. Migration v3 rebuilds already-indexed FTS rows using the same folding loop; the v2 upgrade regression demonstrates that raw `ĐƯỜNG DẪN` previously fails `duong` and matches after migration while display evidence stays unchanged. Zero payload/prefix budget yields empty text; public response budgets remain positive-only (`0` is `BUDGET_EXCEEDED`). Four-byte emoji and UTF-16 surrogate pairs are never split by clipping.
- **M5 — Mandatory enablement gate.** Live capture and public tools are strictly BLOCKED until N3 (total device quota & admin cleanup) is closed in Phase 5.

## Adversarial blocker closure (H1/H2/H3/M1)

- **H1 — Stable keyset ordering.** Search orders by stable exact-match bucket (0 exact, 1 FTS-only), then `timestamp DESC, ref ASC`; authenticated continuation carries `(last_match, last_timestamp, last_ref)`. The next-page predicate advances to a greater bucket or, within the same bucket, `timestamp < last_timestamp OR (timestamp = last_timestamp AND ref > last_ref)`. No LIMIT/OFFSET and no BM25 ordering remain. The deterministic exact bucket preserves the frozen exact-path top-3 acceptance threshold; the first full-suite run showed pure recency would regress it to 83.33%. BM25 is not used as a sort key. This deliberately chooses exact-first deterministic recency over mutable global BM25 rank. The visibility predicate remains exactly `first_indexed_generation <= G AND (deleted_generation IS NULL OR deleted_generation > G)`. The regression uses different BM25 scores, verifies those scores actually shift on G+1 insertion, and asserts ordered, exact, deduplicated retrieval of all G references, including timestamp ties. Re-indexing updates only derived FTS and `last_indexed_generation`; snippets always read `evidence.text`, preserving display diacritics. Arbitrary content mutation is still outside the pinned membership guarantee above.
- **H2 — Unambiguous authenticated encoding.** Both cursor kinds use `JSON.stringify` arrays as MAC inputs, rather than colon delimiters. Read input is `['v1', 'read', owner, repo, false, body]`; durable input is `['v1', 'durable', owner, repo, generation, queryHash, expiry, false, id, position]`. New encoding invalidates previous cursors, with no insecure compatibility fallback. Read token validation accepts bounded even-length hexadecimal signatures so the explicit decoded-length check rejects a two-byte MAC before `timingSafeEqual` or `JSON.parse`. Tests intercept `JSON.parse` to prove neither a short MAC nor an unauthenticated modified body is parsed; cross-owner/repo, kind-confusion, and actual colon-scope collision cases are exercised.
- **H3 — Redacted-byte persistence proof.** The full redaction test indexes `sk-testsecret1234567890abcdef`, bearer/password/private-key canaries, and inspects every value (including BLOBs) in all five named FTS shadow tables: data, idx, content, docsize, config. It also asserts main DB and live WAL exist and scans all SQLite files before close/checkpoint. `safe.hash = SHA256(UTF8(safe.text))` is asserted directly: hashing occurs after redaction and byte clipping, never over the raw payload. Import deduplication uses the same redacted-byte hash.
- **M1 — Atomic stored-content rebuild.** Migration already wraps schema changes, folded FTS rebuild and `PRAGMA user_version=3` in `BEGIN IMMEDIATE ... COMMIT`, with exception rollback. The insert statement is now prepared once outside the rebuild loop. FTS remains a standard stored-content table, so `SELECT text` works. The full regression injects failure immediately before commit, verifies unchanged v2 schema/content, then exits a separate process at that boundary without JS cleanup, verifies recovery rollback, reruns twice, and checks integrity, exactly one tombstone column, user_version 3, folded FTS and original-diacritic snippets. This demonstrates process-crash recovery, not power-loss durability.
- **Scope retained.** These fixes do not enable live capture, enforce quota, add cleanup, publish a release, or grant reviewer approval. Phase 5 gates remain unchanged.

## Other frozen policy decisions

Node floor for feature 002: >=22.13.0 with built-in `node:sqlite` and FTS5. 1.0.10's package engine remains unchanged in this phase. WAL + `synchronous=NORMAL` is the frozen process-crash profile: **recent committed transactions may be lost on power failure**; no power-loss durability claim. Use FULL only following a separately accepted guarantee change. No hidden auto-sync, startup/idle scheduler, source-code parser or wiki provider.

## Gates retained

`handoff-110.json` records actual release source, not capabilities imagined from the earlier design snapshot. Missing observer/exclusion/process seams and deferred shared accounting keep live wiring BLOCKED. Source signature/semantics changes invalidate dependent capture, process, parity and catalog evidence. Linux/Node-floor evidence must reflect actual runs or explicitly remain NOT_MEASURED. No merge/release authorization is inferred from successful tests.
~~~~

## Complete final context test output

~~~~text
TAP version 13
# (node:39076) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
ok 1 - frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
  ---
  duration_ms: 554.1456
  type: 'test'
  ...
# (node:41056) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: re-pair seals old namespace; refs and cursors never authorize another scope
ok 2 - re-pair seals old namespace; refs and cursors never authorize another scope
  ---
  duration_ms: 484.0475
  type: 'test'
  ...
# Subtest: read cursor binds repository scope and sealed state
ok 3 - read cursor binds repository scope and sealed state
  ---
  duration_ms: 396.985
  type: 'test'
  ...
# Subtest: durable cursor signature protects generation, query, expiry and position
ok 4 - durable cursor signature protects generation, query, expiry and position
  ---
  duration_ms: 171.3736
  type: 'test'
  ...
# Subtest: sandbox denial is propagated once, without Git or alternate-path fallback
ok 5 - sandbox denial is propagated once, without Git or alternate-path fallback
  ---
  duration_ms: 3.2502
  type: 'test'
  ...
# (node:24400) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: fresh status creates no repo database; unknown intent and wrong job scope are visible
ok 6 - fresh status creates no repo database; unknown intent and wrong job scope are visible
  ---
  duration_ms: 556.1945
  type: 'test'
  ...
# Subtest: migration rejects a newer schema without replacing it and publication rejects invalid watermarks
ok 7 - migration rejects a newer schema without replacing it and publication rejects invalid watermarks
  ---
  duration_ms: 545.9238
  type: 'test'
  ...
# Subtest: symlink sandbox escape is denied on its canonical target
ok 8 - symlink sandbox escape is denied on its canonical target
  ---
  duration_ms: 345.845
  type: 'test'
  ...
# (node:26740) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
ok 9 - JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
  ---
  duration_ms: 611.7692
  type: 'test'
  ...
# Subtest: legacy id wins over changed content, and excluded paths never persist payloads
ok 10 - legacy id wins over changed content, and excluded paths never persist payloads
  ---
  duration_ms: 361.1699
  type: 'test'
  ...
# (node:9768) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: sync indexes only pending retained events and advances watermark without copying old rows
ok 11 - sync indexes only pending retained events and advances watermark without copying old rows
  ---
  duration_ms: 632.3999
  type: 'test'
  ...
# PASS: frozen policy bounds, six-tool contract, baseline byte accounting and proposed local catalog budget
# Subtest: test\\context\\policy-contract.test.js
ok 6 - test\\context\\policy-contract.test.js
  ---
  duration_ms: 498.6271
  type: 'test'
  ...
# (node:10144) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Vietnamese and emoji byte-budget pages preserve code points and byte offsets
ok 13 - Vietnamese and emoji byte-budget pages preserve code points and byte offsets
  ---
  duration_ms: 1199.118
  type: 'test'
  ...
# Subtest: evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
ok 14 - evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
  ---
  duration_ms: 872.9146
  type: 'test'
  ...
# (node:40836) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
ok 15 - secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
  ---
  duration_ms: 683.8838
  type: 'test'
  ...
# Subtest: import deduplicates redacted content and indexes only redacted text
ok 16 - import deduplicates redacted content and indexes only redacted text
  ---
  duration_ms: 232.9576
  type: 'test'
  ...
# Subtest: secret markers use keyed tags, never offline-guessable plain hashes
ok 17 - secret markers use keyed tags, never offline-guessable plain hashes
  ---
  duration_ms: 0.884
  type: 'test'
  ...
# Subtest: UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
ok 18 - UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
  ---
  duration_ms: 2.1368
  type: 'test'
  ...
# Subtest: excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
ok 19 - excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
  ---
  duration_ms: 71.3207
  type: 'test'
  ...
# Subtest: Git roots, worktrees, separate clones and nested repositories
ok 20 - Git roots, worktrees, separate clones and nested repositories
  ---
  duration_ms: 2260.2489
  type: 'test'
  ...
# Subtest: non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
ok 21 - non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
  ---
  duration_ms: 60.3615
  type: 'test'
  ...
# (node:8664) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: v1 repo migration preserves evidence and installs incremental retrieval schema
ok 22 - v1 repo migration preserves evidence and installs incremental retrieval schema
  ---
  duration_ms: 13.387
  type: 'test'
  ...
# Subtest: v2 migration adds snapshot tombstones and folds existing redacted FTS content
ok 23 - v2 migration adds snapshot tombstones and folds existing redacted FTS content
  ---
  duration_ms: 2.9339
  type: 'test'
  ...
# Subtest: FTS filters first generation, retention, source and time without returning cross-scope evidence
ok 24 - FTS filters first generation, retention, source and time without returning cross-scope evidence
  ---
  duration_ms: 802.3229
  type: 'test'
  ...
# (node:37348) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: pinned pagination retains page-two reindexed rows and excludes new generations
ok 25 - pinned pagination retains page-two reindexed rows and excludes new generations
  ---
  duration_ms: 750.5362
  type: 'test'
  ...
# Subtest: pinned generation excludes a clock-skewed G+1 event older than the cursor
ok 26 - pinned generation excludes a clock-skewed G+1 event older than the cursor
  ---
  duration_ms: 267.24
  type: 'test'
  ...
# Subtest: read continuation cannot be replayed against different refs in the same repo
ok 27 - read continuation cannot be replayed against different refs in the same repo
  ---
  duration_ms: 236.2401
  type: 'test'
  ...
# Subtest: pinned keyset pagination ignores BM25 shifts after new-generation inserts
ok 28 - pinned keyset pagination ignores BM25 shifts after new-generation inserts
  ---
  duration_ms: 803.1715
  type: 'test'
  ...
# Subtest: stable exact-match bucket precedes newer FTS-only matches across keyset pages
ok 29 - stable exact-match bucket precedes newer FTS-only matches across keyset pages
  ---
  duration_ms: 151.2829
  type: 'test'
  ...
# Subtest: expired authenticated search and read cursors are stale at the domain boundary
ok 30 - expired authenticated search and read cursors are stale at the domain boundary
  ---
  duration_ms: 161.3635
  type: 'test'
  ...
# Subtest: read cursor issued at G is stale after publication of G+1
ok 31 - read cursor issued at G is stale after publication of G+1
  ---
  duration_ms: 139.362
  type: 'test'
  ...
# Subtest: one-byte payload tampering with the original MAC is invalid
ok 32 - one-byte payload tampering with the original MAC is invalid
  ---
  duration_ms: 128.7073
  type: 'test'
  ...
# Subtest: query mismatch and search/read/durable kind confusion are invalid
ok 33 - query mismatch and search/read/durable kind confusion are invalid
  ---
  duration_ms: 156.3911
  type: 'test'
  ...
# Subtest: current retention availability overrides pinned generation for purged evidence
ok 34 - current retention availability overrides pinned generation for purged evidence
  ---
  duration_ms: 201.111
  type: 'test'
  ...
# Subtest: Vietnamese stroked d folds on index and query sides
ok 35 - Vietnamese stroked d folds on index and query sides
  ---
  duration_ms: 197.0297
  type: 'test'
  ...
# Subtest: v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
ok 36 - v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
  ---
  duration_ms: 167.2873
  type: 'test'
  ...
# (node:37348) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: concurrent migration opener waits and rechecks v3, then commits without DDL
ok 37 - concurrent migration opener waits and rechecks v3, then commits without DDL
  ---
  duration_ms: 447.5504
  type: 'test'
  ...
# Subtest: concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
ok 38 - concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
  ---
  duration_ms: 2102.0715
  type: 'test'
  ...
# Subtest: v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
ok 39 - v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
  ---
  duration_ms: 220.9454
  type: 'test'
  ...
# Subtest: search/status are read-only, Unicode-aware, bounded and never sync implicitly
ok 40 - search/status are read-only, Unicode-aware, bounded and never sync implicitly
  ---
  duration_ms: 201.0818
  type: 'test'
  ...
# {"ok":true,"platform":"win32","arch":"x64","node":"22.22.2","sqlite":"3.51.2","constructor":"PASS","busy_timeout_ms":5,"fts5":"PASS","warnings":["ExperimentalWarning"],"json_stdout":"PASS","warning_stderr":"(node:19164) ExperimentalWarning: SQLite is an experimental feature and might change at any time\\n(Use `node --trace-warnings ...` to show where the warning was created)"}
# Subtest: test\\context\\sqlite-platform.test.js
ok 12 - test\\context\\sqlite-platform.test.js
  ---
  duration_ms: 581.3189
  type: 'test'
  ...
# (node:28336) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
ok 42 - WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
  ---
  duration_ms: 629.776
  type: 'test'
  ...
# Subtest: cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
ok 43 - cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
  ---
  duration_ms: 245.909
  type: 'test'
  ...
# Subtest: JSON MAC encoding rejects colon-delimiter scope collisions across owners
ok 44 - JSON MAC encoding rejects colon-delimiter scope collisions across owners
  ---
  duration_ms: 696.9821
  type: 'test'
  ...
# Subtest: status is read-only, capture gaps are visible and jobs/stores have ownership bounds
ok 45 - status is read-only, capture gaps are visible and jobs/stores have ownership bounds
  ---
  duration_ms: 193.8806
  type: 'test'
  ...
1..45
# tests 45
# suites 0
# pass 45
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6716.4297
~~~~
