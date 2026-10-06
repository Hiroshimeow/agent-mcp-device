# Checkpoint 1 complete evidence — 002-device-local-context

This file embeds complete source files and the unabridged context-suite TAP output; no external snippets are needed for B1–B3 review.

## Verification

- Workspace: E:/git-project/wt-mcp-device-111-context
- Platform: Windows x64; Node v22.22.2; SQLite 3.51.2.
- `npm run build`: exit 0 (TypeScript compilation and build steps succeeded).
- `node --test test/context/*.test.js`: exit 0; 48 tests, 48 passed, 0 failed, 0 skipped.
- SQLite ExperimentalWarning is expected and included without suppression.

## Requirement mapping

- **B1-a:** createV2Repository builds the historical v2 schema directly before starting the worker; the race asserts all eight required tables and version 2.
- **B1-b:** the v4 race explicitly asserts versions [2, 4], demonstrating the post-lock version recheck.
- **B1-c:** INDEX_INCOMPATIBLE immediately triggers BEGIN IMMEDIATE; COMMIT; on the same worker connection; the main thread asserts canBegin === true.
- **B1-d:** rollback is guarded so a missing transaction cannot mask the original error; pre-commit, post-commit and process-crash regressions are included.
- **B2-a:** a verified position field offset is changed by exactly one byte, valid JSON is asserted, and the original MAC is retained; store and service reject it as CURSOR_INVALID.
- **B2-b:** every starting search/read continuation in retrieval.test.js asserts a non-null next_cursor. Search fixtures have multiple matches; read fixtures have sufficient retained bytes to force continuation.
- **B2-c:** correctly signed expired search/read tokens first yield CURSOR_STALE; tampering their valid JSON key while preserving the MAC yields CURSOR_INVALID at both store and domain boundaries.
- **B3-a:** the complete search SQL below uses UNION ALL, GROUP BY d.ref, min(m.score), aggregate HAVING and deterministic keyset ordering. A real dual-match event is returned once and the actual production SQL row has score 0.
- **B3-c:** Unicode token extraction and individual token quoting are retained; explicit queries containing quotes, AND, minus, OR, wildcard and NEAR syntax execute without errors, including the requested combined query.

## src/context/search.ts

```typescript
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
```

## src/context/store.ts

```typescript
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
```

## src/context/migrations/index.ts

```typescript
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
  } catch (error) {
    // COMMIT may already have released the transaction; preserve the original error.
    try { db.exec('ROLLBACK'); } catch { /* No active transaction to roll back. */ }
    throw error;
  }
}
```

## test/context/fixtures/migration-worker.js

```javascript
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
let error, canBegin;
try { migrate(db, 'repo'); } catch (caught) {
  error = caught.message;
  if (error === 'INDEX_INCOMPATIBLE') {
    // Probe this SAME connection immediately, before close or any other cleanup.
    canBegin = (() => {
      try { db.exec('BEGIN IMMEDIATE; COMMIT;'); return true; }
      catch { return false; }
    })();
  }
}
const result = { error, canBegin, sql, versions,
  busyTimeout: prepare('PRAGMA busy_timeout').get().timeout,
  changes: prepare('SELECT total_changes() AS n').get().n,
  schemaVersion: prepare('PRAGMA schema_version').get().schema_version };
// BEGIN would fail if migrate left a transaction dangling.
try { exec('BEGIN IMMEDIATE; ROLLBACK'); result.transactionReleased = true; }
catch (caught) { result.transactionError = caught.message; }
db.close();
Atomics.store(signal, 1, 1); Atomics.notify(signal, 1);
parentPort.postMessage(result);
```

## test/context/fixtures/v2-schema.js

```javascript
// Historical repository v2 schema: create it directly, never downgrade a v3 database.
export function createV2Repository(db) {
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE evidence(ref TEXT PRIMARY KEY, text TEXT NOT NULL, hash TEXT NOT NULL,
      original_bytes INTEGER NOT NULL, retained_bytes INTEGER NOT NULL, redaction_state TEXT NOT NULL,
      partial INTEGER NOT NULL, retention_state TEXT NOT NULL DEFAULT 'available');
    CREATE TABLE events(event_id INTEGER PRIMARY KEY, invocation_id TEXT UNIQUE NOT NULL,
      accepted_at INTEGER NOT NULL, execution_status TEXT NOT NULL DEFAULT 'succeeded',
      recording_status TEXT NOT NULL DEFAULT 'committed', payload_ref TEXT REFERENCES evidence(ref));
    CREATE VIRTUAL TABLE evidence_fts USING fts5(ref UNINDEXED,text,tokenize='unicode61 remove_diacritics 2');
    CREATE TABLE activity_nodes(node_id TEXT PRIMARY KEY, kind TEXT NOT NULL, evidence_ref TEXT REFERENCES evidence(ref));
    CREATE TABLE activity_edges(edge_id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES activity_nodes(node_id),
      target TEXT NOT NULL REFERENCES activity_nodes(node_id), relation TEXT NOT NULL, evidence_ref TEXT NOT NULL REFERENCES evidence(ref));
    CREATE TABLE generations(generation_id INTEGER PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('shadow','published')),
      indexed_through_event INTEGER NOT NULL DEFAULT 0, manifest_hash TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE manifest(singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation INTEGER REFERENCES generations(generation_id));
    INSERT INTO manifest VALUES(1,NULL);
    CREATE TABLE cursors(token_id TEXT PRIMARY KEY, generation INTEGER, query_hash TEXT NOT NULL, position INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE legacy_imports(legacy_id TEXT PRIMARY KEY, content_hash TEXT NOT NULL, evidence_ref TEXT NOT NULL REFERENCES evidence(ref));
    CREATE INDEX legacy_content ON legacy_imports(content_hash);
    CREATE TABLE search_documents(ref TEXT PRIMARY KEY REFERENCES evidence(ref), source_kind TEXT NOT NULL,
      timestamp INTEGER NOT NULL, first_indexed_generation INTEGER NOT NULL, last_indexed_generation INTEGER NOT NULL);
    PRAGMA user_version=2;
  `);
}
```

## test/context/helpers.js

```javascript
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
```

## test/context/retrieval.test.js

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { createV2Repository } from './fixtures/v2-schema.js';
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
  assert.ok(first.next_cursor);
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
  assert.ok(first.next_cursor);
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
  assert.ok(first.next_cursor);
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
  assert.ok(first.next_cursor);
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
  assert.ok(searchPage.next_cursor);
  assert.ok(readPage.next_cursor);
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
    const [body, mac] = expired.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    payload.key = 'modified';
    const tamperedBody = JSON.stringify(payload);
    assert.doesNotThrow(() => JSON.parse(tamperedBody));
    const tamperedExpired = `${Buffer.from(tamperedBody).toString('base64url')}.${mac}`;
    assert.throws(() => store.parseReadCursor(owner, repo, tamperedExpired), { message: 'CURSOR_INVALID' });
    assert.throws(() => resume(tamperedExpired), { message: 'CURSOR_INVALID' });
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
  const fieldOffset = original.indexOf(Buffer.from('"position":0'));
  assert.ok(fieldOffset >= 0, 'known JSON field is present');
  const index = fieldOffset + '"position":'.length;
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
  let db;
  t.after(() => db?.close());
  const path = join(temporary(t), 'context.sqlite');
  db = new DatabaseSync(path);
  createV2Repository(db);
  const required = ['evidence', 'events', 'evidence_fts', 'generations', 'manifest', 'cursors', 'legacy_imports', 'search_documents'];
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
  for (const table of required) assert.ok(tables.includes(table), `v2 fixture has ${table}`);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
  const ref = 'a'.repeat(48);
  db.prepare('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?)').run(ref, 'migration sentinel', 'hash', 18, 18, 'none', 0, 'available');
  db.prepare('INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES(?,?,?)').run('sentinel', 1, ref);
  db.prepare('INSERT INTO evidence_fts(ref,text) VALUES(?,?)').run(ref, 'migration sentinel');
  db.prepare('INSERT INTO generations VALUES(?,?,?,?,?)').run(1, 'published', 1, 'manifest', 1);
  db.exec('UPDATE manifest SET generation=1');
  db.prepare('INSERT INTO search_documents VALUES(?,?,?,?,?)').run(ref, 'history', 1, 1, 1);
  // Handle A applies v3 changes but holds its write lock without committing.
  db.exec('BEGIN IMMEDIATE; ALTER TABLE search_documents ADD COLUMN deleted_generation INTEGER;');
  db.exec('DELETE FROM evidence_fts; INSERT INTO evidence_fts(ref,text) SELECT ref,lower(text) FROM evidence;');
  db.exec(`PRAGMA user_version=${committedVersion}`);
  const schemaVersion = db.prepare('PRAGMA schema_version').get().schema_version;
  const signal = new Int32Array(new SharedArrayBuffer(8));
  const worker = new Worker(new URL('./fixtures/migration-worker.js', import.meta.url), { workerData: {
    path, signal: signal.buffer,
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
  assert.deepEqual(result.versions, [2, 4]);
  assert.equal(result.canBegin, true);
  assert.deepEqual(result.sql, ['PRAGMA busy_timeout=5000', 'BEGIN IMMEDIATE', 'ROLLBACK', 'BEGIN IMMEDIATE; COMMIT;']);
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

test('migration preserves the original error when COMMIT already released the transaction', t => {
  let db;
  t.after(() => db?.close());
  db = new DatabaseSync(join(temporary(t), 'context.sqlite'));
  createV2Repository(db);
  const failure = new Error('simulated post-commit failure');
  const wrapper = {
    prepare: sql => db.prepare(sql),
    exec: sql => {
      db.exec(sql);
      if (sql === 'PRAGMA user_version=3; COMMIT') throw failure;
    },
  };
  assert.throws(() => migrate(wrapper, 'repo'), error => error === failure);
  assert.doesNotThrow(() => db.exec('BEGIN IMMEDIATE; COMMIT;'));
});

test('substring and FTS matches collapse to one row with exact score zero', t => {
  const { store, owner, repo, service } = setup(t);
  const ref = store.append(owner, repo, 'duplicate SQL token');
  sync(store, owner, repo);
  const db = store.repoDatabase(owner, repo);
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence WHERE instr(lower(text),lower(?))>0").get('SQL').n, 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence_fts WHERE evidence_fts MATCH ?').get('"sql"').n, 1);
  // Capture actual rows from the production query, not a copied test SQL statement.
  const withReadDatabase = store.withReadDatabase.bind(store);
  let rows;
  store.withReadDatabase = (owner, repo, action) => withReadDatabase(owner, repo, db => action({
    prepare: sql => {
      const statement = db.prepare(sql);
      return { all: (...parameters) => { rows = statement.all(...parameters); return rows; } };
    },
  }));
  const page = service.search(owner, repo, { query: 'SQL' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ref, ref);
  assert.equal(rows[0].score, 0);
  assert.deepEqual(page.items.map(item => item.ref), [ref]);
  assert.equal(page.items[0].match_reason, 'exact');
});

test('FTS syntax characters are quoted as tokens and never interpreted as operators', t => {
  const { store, owner, repo, service } = setup(t);
  store.append(owner, repo, 'foo x OR NEAR SQL');
  sync(store, owner, repo);
  for (const query of ['"', 'foo AND', '-x', 'OR * NEAR(', ' " OR * NEAR( SQL -- ']) {
    assert.doesNotThrow(() => service.search(owner, repo, { query }), query);
  }
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
```

## Complete TAP output

Command: `node --test test/context/*.test.js` (stdout and stderr captured together, exit 0).

```text
TAP version 13
# (node:35628) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
ok 1 - frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
  ---
  duration_ms: 4090.9343
  type: 'test'
  ...
# (node:30756) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: re-pair seals old namespace; refs and cursors never authorize another scope
ok 2 - re-pair seals old namespace; refs and cursors never authorize another scope
  ---
  duration_ms: 3631.3119
  type: 'test'
  ...
# Subtest: read cursor binds repository scope and sealed state
ok 3 - read cursor binds repository scope and sealed state
  ---
  duration_ms: 448.9132
  type: 'test'
  ...
# Subtest: durable cursor signature protects generation, query, expiry and position
ok 4 - durable cursor signature protects generation, query, expiry and position
  ---
  duration_ms: 226.5545
  type: 'test'
  ...
# Subtest: sandbox denial is propagated once, without Git or alternate-path fallback
ok 5 - sandbox denial is propagated once, without Git or alternate-path fallback
  ---
  duration_ms: 4.715
  type: 'test'
  ...
# (node:35188) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: fresh status creates no repo database; unknown intent and wrong job scope are visible
ok 6 - fresh status creates no repo database; unknown intent and wrong job scope are visible
  ---
  duration_ms: 3991.7458
  type: 'test'
  ...
# Subtest: migration rejects a newer schema without replacing it and publication rejects invalid watermarks
ok 7 - migration rejects a newer schema without replacing it and publication rejects invalid watermarks
  ---
  duration_ms: 388.1397
  type: 'test'
  ...
# Subtest: symlink sandbox escape is denied on its canonical target
ok 8 - symlink sandbox escape is denied on its canonical target
  ---
  duration_ms: 369.599
  type: 'test'
  ...
# (node:29128) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
ok 9 - JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
  ---
  duration_ms: 3568.9431
  type: 'test'
  ...
# Subtest: legacy id wins over changed content, and excluded paths never persist payloads
ok 10 - legacy id wins over changed content, and excluded paths never persist payloads
  ---
  duration_ms: 532.4455
  type: 'test'
  ...
# (node:22756) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: sync indexes only pending retained events and advances watermark without copying old rows
ok 11 - sync indexes only pending retained events and advances watermark without copying old rows
  ---
  duration_ms: 3531.7587
  type: 'test'
  ...
# PASS: frozen policy bounds, six-tool contract, baseline byte accounting and proposed local catalog budget
# Subtest: test\\context\\policy-contract.test.js
ok 6 - test\\context\\policy-contract.test.js
  ---
  duration_ms: 205.4948
  type: 'test'
  ...
# (node:32632) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Vietnamese and emoji byte-budget pages preserve code points and byte offsets
ok 13 - Vietnamese and emoji byte-budget pages preserve code points and byte offsets
  ---
  duration_ms: 3927.9545
  type: 'test'
  ...
# Subtest: evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
ok 14 - evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
  ---
  duration_ms: 377.6328
  type: 'test'
  ...
# (node:2220) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
ok 15 - secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
  ---
  duration_ms: 3481.149
  type: 'test'
  ...
# Subtest: import deduplicates redacted content and indexes only redacted text
ok 16 - import deduplicates redacted content and indexes only redacted text
  ---
  duration_ms: 541.4775
  type: 'test'
  ...
# Subtest: secret markers use keyed tags, never offline-guessable plain hashes
ok 17 - secret markers use keyed tags, never offline-guessable plain hashes
  ---
  duration_ms: 1.5791
  type: 'test'
  ...
# Subtest: UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
ok 18 - UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
  ---
  duration_ms: 2.4222
  type: 'test'
  ...
# Subtest: excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
ok 19 - excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
  ---
  duration_ms: 72.8982
  type: 'test'
  ...
# Subtest: Git roots, worktrees, separate clones and nested repositories
ok 20 - Git roots, worktrees, separate clones and nested repositories
  ---
  duration_ms: 4978.9935
  type: 'test'
  ...
# Subtest: non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
ok 21 - non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
  ---
  duration_ms: 51.2567
  type: 'test'
  ...
# (node:42272) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: v1 repo migration preserves evidence and installs incremental retrieval schema
ok 22 - v1 repo migration preserves evidence and installs incremental retrieval schema
  ---
  duration_ms: 9.6494
  type: 'test'
  ...
# Subtest: v2 migration adds snapshot tombstones and folds existing redacted FTS content
ok 23 - v2 migration adds snapshot tombstones and folds existing redacted FTS content
  ---
  duration_ms: 1.7682
  type: 'test'
  ...
# Subtest: FTS filters first generation, retention, source and time without returning cross-scope evidence
ok 24 - FTS filters first generation, retention, source and time without returning cross-scope evidence
  ---
  duration_ms: 3880.4161
  type: 'test'
  ...
# (node:41732) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: pinned pagination retains page-two reindexed rows and excludes new generations
ok 25 - pinned pagination retains page-two reindexed rows and excludes new generations
  ---
  duration_ms: 3435.7
  type: 'test'
  ...
# Subtest: pinned generation excludes a clock-skewed G+1 event older than the cursor
ok 26 - pinned generation excludes a clock-skewed G+1 event older than the cursor
  ---
  duration_ms: 554.6023
  type: 'test'
  ...
# Subtest: read continuation cannot be replayed against different refs in the same repo
ok 27 - read continuation cannot be replayed against different refs in the same repo
  ---
  duration_ms: 275.3786
  type: 'test'
  ...
# Subtest: pinned keyset pagination ignores BM25 shifts after new-generation inserts
ok 28 - pinned keyset pagination ignores BM25 shifts after new-generation inserts
  ---
  duration_ms: 297.9003
  type: 'test'
  ...
# Subtest: stable exact-match bucket precedes newer FTS-only matches across keyset pages
ok 29 - stable exact-match bucket precedes newer FTS-only matches across keyset pages
  ---
  duration_ms: 166.3886
  type: 'test'
  ...
# Subtest: expired authenticated search and read cursors are stale at the domain boundary
ok 30 - expired authenticated search and read cursors are stale at the domain boundary
  ---
  duration_ms: 149.4712
  type: 'test'
  ...
# Subtest: read cursor issued at G is stale after publication of G+1
ok 31 - read cursor issued at G is stale after publication of G+1
  ---
  duration_ms: 141.8095
  type: 'test'
  ...
# Subtest: one-byte payload tampering with the original MAC is invalid
ok 32 - one-byte payload tampering with the original MAC is invalid
  ---
  duration_ms: 136.0422
  type: 'test'
  ...
# Subtest: query mismatch and search/read/durable kind confusion are invalid
ok 33 - query mismatch and search/read/durable kind confusion are invalid
  ---
  duration_ms: 164.2784
  type: 'test'
  ...
# Subtest: current retention availability overrides pinned generation for purged evidence
ok 34 - current retention availability overrides pinned generation for purged evidence
  ---
  duration_ms: 169.578
  type: 'test'
  ...
# Subtest: Vietnamese stroked d folds on index and query sides
ok 35 - Vietnamese stroked d folds on index and query sides
  ---
  duration_ms: 164.2934
  type: 'test'
  ...
# Subtest: v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
ok 36 - v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
  ---
  duration_ms: 139.2614
  type: 'test'
  ...
# (node:41732) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: concurrent migration opener waits and rechecks v3, then commits without DDL
ok 37 - concurrent migration opener waits and rechecks v3, then commits without DDL
  ---
  duration_ms: 339.7579
  type: 'test'
  ...
# (node:41732) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
ok 38 - concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
  ---
  duration_ms: 311.9512
  type: 'test'
  ...
# Subtest: v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
ok 39 - v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
  ---
  duration_ms: 216.7809
  type: 'test'
  ...
# Subtest: migration preserves the original error when COMMIT already released the transaction
ok 40 - migration preserves the original error when COMMIT already released the transaction
  ---
  duration_ms: 54.2218
  type: 'test'
  ...
# Subtest: substring and FTS matches collapse to one row with exact score zero
ok 41 - substring and FTS matches collapse to one row with exact score zero
  ---
  duration_ms: 111.165
  type: 'test'
  ...
# Subtest: FTS syntax characters are quoted as tokens and never interpreted as operators
ok 42 - FTS syntax characters are quoted as tokens and never interpreted as operators
  ---
  duration_ms: 129.2347
  type: 'test'
  ...
# Subtest: search/status are read-only, Unicode-aware, bounded and never sync implicitly
ok 43 - search/status are read-only, Unicode-aware, bounded and never sync implicitly
  ---
  duration_ms: 166.2344
  type: 'test'
  ...
# {"ok":true,"platform":"win32","arch":"x64","node":"22.22.2","sqlite":"3.51.2","constructor":"PASS","busy_timeout_ms":5,"fts5":"PASS","warnings":["ExperimentalWarning"],"json_stdout":"PASS","warning_stderr":"(node:27096) ExperimentalWarning: SQLite is an experimental feature and might change at any time\\n(Use `node --trace-warnings ...` to show where the warning was created)"}
# Subtest: test\\context\\sqlite-platform.test.js
ok 12 - test\\context\\sqlite-platform.test.js
  ---
  duration_ms: 400.7961
  type: 'test'
  ...
# (node:38808) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
ok 45 - WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
  ---
  duration_ms: 3822.0738
  type: 'test'
  ...
# Subtest: cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
ok 46 - cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
  ---
  duration_ms: 250.3939
  type: 'test'
  ...
# Subtest: JSON MAC encoding rejects colon-delimiter scope collisions across owners
ok 47 - JSON MAC encoding rejects colon-delimiter scope collisions across owners
  ---
  duration_ms: 193.0695
  type: 'test'
  ...
# Subtest: status is read-only, capture gaps are visible and jobs/stores have ownership bounds
ok 48 - status is read-only, capture gaps are visible and jobs/stores have ownership bounds
  ---
  duration_ms: 282.4086
  type: 'test'
  ...
1..48
# tests 48
# suites 0
# pass 48
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7508.2598
```
