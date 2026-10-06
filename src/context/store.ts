import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, chmodSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { migrate } from './migrations/index.js';
import { redact } from './redact.js';

/** Only context connection constructor, including read-only handles. */
export function createContextDatabase(path: string, options: { readOnly?: boolean } = {}): DatabaseSync {
  const db = new DatabaseSync(path, options);
  try {
    db.exec('PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL');
    return db;
  } catch (error) { db.close(); throw error; }
}

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
  private activeReservation: string | undefined;
  private activeEpoch: number | undefined;

  /** Registry provides lease liveness only; repo.sqlite owns epoch authority.
   * Registry and repository are separate SQLite files, not an atomic transaction. */
  assertReservationLive(): void {
    if (!this.activeReservation) throw new Error('RESERVATION_FENCED_OFF');
    const row = this.registry.prepare('SELECT expires_at FROM reservations WHERE reservation_id=?').get(this.activeReservation);
    if (!row || Number(row.expires_at) <= Date.now()) throw new Error('RESERVATION_FENCED_OFF');
  }

  /** Store-owned commit gate: stale caller tokens cannot commit repository work. */
  commitRepository(db: DatabaseSync, token = this.activeReservation): void {
    if (!token || token !== this.activeReservation || !db.isTransaction || !this.registry.isTransaction) throw new Error('RESERVATION_FENCED_OFF');
    // Compare the cached admission epoch inside the worker's repo transaction,
    // before consulting the possibly reaped registry lease.
    if (this.activeEpoch !== undefined) {
      const fence = db.prepare('SELECT authoritative_epoch,active_reservation_id FROM fencing_state WHERE singleton=1').get();
      if (Number(fence?.authoritative_epoch) !== this.activeEpoch || fence?.active_reservation_id !== token) throw new Error('RESERVATION_FENCED_OFF');
    }
    this.assertReservationLive();
    const row = this.registry.prepare(`SELECT r.owner_key,r.repo_uuid,e.epoch FROM reservations r
      JOIN reservation_epochs e USING(reservation_id) WHERE r.reservation_id=?`).get(token)!;
    if (db !== this.repoDatabase(String(row.owner_key), String(row.repo_uuid))) throw new Error('RESERVATION_FENCED_OFF');
    // Callers begin repo work with BEGIN IMMEDIATE. The conditional watermark
    // check/update is one SQL statement in that same transaction (never autocommit).
    // The watermark and receipt commit with evidence, so recovery can distinguish
    // a repo commit from an abandoned allocation even after registry rollback.
    const updated = db.prepare(`UPDATE repository_fence SET last_committed_epoch=?,reservation_id=?
      WHERE singleton=1 AND last_committed_epoch<? AND EXISTS (
        SELECT 1 FROM fencing_state WHERE singleton=1 AND authoritative_epoch=? AND active_reservation_id=?)`).run(row.epoch, token, row.epoch, row.epoch, token);
    if (!updated.changes) throw new Error('RESERVATION_FENCED_OFF');
    db.exec('COMMIT');
  }

  constructor(private readonly stateRoot: string, options: { readOnly?: boolean } = {}) {
    this.root = join(stateRoot, 'context');
    if (options.readOnly) {
      try {
        this.key = readFileSync(join(stateRoot, 'context-hmac.key'));
        if (this.key.length !== 32) throw new Error();
        this.cursorKey = createHmac('sha256', this.key).update('cursor_signing_v1').digest();
        this.registry = createContextDatabase(join(this.root, 'registry.sqlite'), { readOnly: true });
        if (Number(this.registry.prepare('PRAGMA user_version').get()?.user_version) !== 3) {
          this.registry.close();
          throw new Error('INDEX_INCOMPATIBLE');
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'INDEX_INCOMPATIBLE') throw error;
        throw new Error('LOCAL_STATE_UNAVAILABLE');
      }
      return;
    }
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
    this.registry.exec(`CREATE TABLE IF NOT EXISTS quota_policy(singleton INTEGER PRIMARY KEY CHECK(singleton=1), device_bytes INTEGER NOT NULL, owner_bytes INTEGER NOT NULL, repo_bytes INTEGER NOT NULL, metadata_reserve_bytes INTEGER NOT NULL);
      INSERT OR IGNORE INTO quota_policy VALUES(1,8589934592,8589934592,2147483648,134217728);
      CREATE TABLE IF NOT EXISTS cursor_epochs(repo_uuid TEXT PRIMARY KEY, epoch INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS admin_audit(audit_id TEXT PRIMARY KEY, repo_uuid TEXT NOT NULL, created_at INTEGER NOT NULL, purged INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS purge_retries(repo_uuid TEXT PRIMARY KEY, checkpoint_pending INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS quota_usage(repo_uuid TEXT PRIMARY KEY REFERENCES repositories(repo_uuid), evidence_bytes INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reservations(reservation_id TEXT PRIMARY KEY, repo_uuid TEXT NOT NULL REFERENCES repositories(repo_uuid), pid INTEGER NOT NULL, host TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, allocation INTEGER NOT NULL, owner_key TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS epoch_counter(repo_uuid TEXT PRIMARY KEY REFERENCES repositories(repo_uuid), epoch INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reservation_epochs(reservation_id TEXT PRIMARY KEY REFERENCES reservations(reservation_id) ON DELETE CASCADE, epoch INTEGER NOT NULL);`);
    try { this.reconcileQuota(); }
    catch (error) { this.registry.close(); throw error; }
  }

  private open(path: string, kind: 'registry' | 'repo' | 'unscoped'): DatabaseSync {
    mkdirSync(join(path, '..'), { recursive: true, mode: 0o700 });
    const db = createContextDatabase(path);
    try {
      // Set before the first schema allocation. Existing NONE databases are not
      // converted with a blocking VACUUM: reclaimed pages remain reusable there.
      db.exec('PRAGMA busy_timeout=5000; PRAGMA auto_vacuum=INCREMENTAL; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON');
      migrate(db, kind);
      if (kind === 'repo') {
        db.exec(`CREATE TABLE IF NOT EXISTS repository_fence(singleton INTEGER PRIMARY KEY CHECK(singleton=1), last_committed_epoch INTEGER NOT NULL, reservation_id TEXT);
          INSERT OR IGNORE INTO repository_fence VALUES(1,0,NULL);
          CREATE TABLE IF NOT EXISTS fencing_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1), authoritative_epoch INTEGER NOT NULL, active_reservation_id TEXT);
          INSERT OR IGNORE INTO fencing_state SELECT 1,last_committed_epoch,NULL FROM repository_fence; `);
        db.exec(`BEGIN IMMEDIATE;
          DELETE FROM generations WHERE status='shadow' AND generation_id NOT IN (SELECT generation FROM manifest WHERE generation IS NOT NULL);
          UPDATE events SET execution_status='unknown_after_restart',recording_status='degraded' WHERE execution_status='pending';
          COMMIT;`);
        const row = db.prepare('SELECT g.indexed_through_event FROM manifest m JOIN generations g ON g.generation_id=m.generation').get();
        const max = Number(db.prepare('SELECT coalesce(max(event_id),0) AS n FROM events').get()?.n);
        if (row && Number(row.indexed_through_event) > max) throw new Error('INDEX_INCOMPATIBLE');
      }
      return db;
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

  findRepository(owner: string, identity: string): string | null {
    this.authorize(owner);
    return this.registry.prepare('SELECT repo_uuid FROM repositories WHERE owner_key=? AND identity=?').get(owner, identity)?.repo_uuid as string ?? null;
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

  private repositoryPath(owner: string, repo: string): string {
    const directory = join(this.root, 'owners', owner, 'repos', repo);
    return existsSync(join(directory, 'repo.sqlite')) ? join(directory, 'repo.sqlite') : join(directory, 'context.sqlite');
  }

  private database(owner: string, repo?: string, localAdmin = false): DatabaseSync {
    if (localAdmin) {
      if (!repo || !this.registry.prepare('SELECT 1 FROM repositories WHERE owner_key=? AND repo_uuid=?').get(owner, repo)) throw new Error('ACCESS_DENIED');
    } else this.authorize(owner, repo);
    const path = repo ? join(this.root, 'owners', owner, 'repos', repo, 'repo.sqlite') : join(this.root, 'owners', owner, 'unscoped.sqlite');
    if (repo && !existsSync(path)) {
      const legacy = join(this.root, 'owners', owner, 'repos', repo, 'context.sqlite');
      // Preserve crash WAL frames when upgrading a closed legacy repository.
      if (existsSync(legacy)) for (const suffix of ['', '-wal', '-shm']) {
        if (existsSync(legacy + suffix)) renameSync(legacy + suffix, path + suffix);
      }
    }
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
    const db = this.unscopedDatabase(owner), now = Date.now();
    // A transaction makes dedup safe across processes; preserve other gap reasons.
    db.exec('BEGIN IMMEDIATE');
    try {
      if (reason !== 'quota' || !db.prepare("SELECT 1 FROM gaps WHERE reason='quota' AND created_at>? LIMIT 1").get(now - 60000)) {
        db.prepare('INSERT INTO gaps VALUES(?,?,?)').run(opaque(), now, reason);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  append(owner: string, repo: string, input: string | Buffer, options: { path?: string; maxBytes?: number; checkpoint?: boolean } = {}): string {
    this.authorize(owner, repo);
    const safe = this.redactPayload(input, options); // No raw text, path, or raw hash enters SQLite.
    return this.quotaWrite(owner, repo, safe.retainedBytes * 4 + 65536, () => {
    const db = this.repoDatabase(owner, repo), ref = opaque();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES(?,?,?,?,?,?,?)').run(ref, safe.text, safe.hash, safe.originalBytes, safe.retainedBytes, safe.state, Number(safe.partial));
      db.prepare('INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES(?,?,?)').run(opaque(), Date.now(), ref);
      if (options.checkpoint) db.prepare("INSERT INTO activity_nodes(node_id,kind,evidence_ref) VALUES(?,'checkpoint',?)").run(opaque(), ref);
      this.commitRepository(db); return ref;
    } catch (error) {
      db.exec('ROLLBACK');
      if (error instanceof Error && error.message === 'RESERVATION_FENCED_OFF') throw error;
      throw new Error('STORAGE_DEGRADED');
    }
    });
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
    const path = this.repositoryPath(owner, repo);
    const empty = { generation: null, indexed_through_event: 0, manifest_hash: null, pending_events: 0, unknown_events: 0, fts_documents: 0 };
    if (!existsSync(path)) return empty;
    const existing = this.databases.get(path);
    const db = existing ?? createContextDatabase(path, { readOnly: true });
    try {
      const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
      if (version !== 3) throw new Error('INDEX_INCOMPATIBLE');
      return this.readManifest(db);
    } finally { if (!existing) db.close(); }
  }

  /** Query-only access never creates, migrates or opens a writable handle. */
  withReadDatabase<T>(owner: string, repo: string, action: (db: DatabaseSync) => T): T {
    this.authorize(owner, repo);
    const path = this.repositoryPath(owner, repo);
    if (!existsSync(path)) throw new Error('INDEX_MISSING');
    const db = createContextDatabase(path, { readOnly: true });
    try {
      if (Number(db.prepare('PRAGMA user_version').get()?.user_version) !== 3) throw new Error('INDEX_INCOMPATIBLE');
      return action(db);
    } finally { db.close(); }
  }

  signReadCursor(owner: string, repo: string, state: { generation?: unknown; key?: unknown; expires_at?: unknown; [field: string]: unknown }): string {
    this.authorize(owner, repo);
    const body = Buffer.from(JSON.stringify({ ...state, sealed: false, epoch: this.cursorEpoch(repo) })).toString('base64url');
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
      if (Number(state.epoch ?? 0) !== this.cursorEpoch(repo)) throw new Error('CURSOR_STALE');
      return state;
    } catch (error) {
      if (error instanceof Error && error.message === 'CURSOR_STALE') throw error;
      throw new Error('CURSOR_INVALID');
    }
  }

  manifest(owner: string, repo: string) {
    return this.readManifest(this.repoDatabase(owner, repo));
  }

  private readManifest(db: DatabaseSync) {
    const row = db.prepare('SELECT g.generation_id,g.indexed_through_event,g.manifest_hash FROM manifest m LEFT JOIN generations g ON g.generation_id=m.generation').get()!;
    const indexed = Number(row.indexed_through_event ?? 0);
    const pending = Number(db.prepare('SELECT count(*) AS n FROM events WHERE event_id>?').get(indexed)?.n);
    const unknown = Number(db.prepare("SELECT count(*) AS n FROM events WHERE execution_status='unknown_after_restart'").get()?.n);
    return { generation: row.generation_id == null ? null : Number(row.generation_id), indexed_through_event: indexed, manifest_hash: row.manifest_hash ?? null, pending_events: pending, unknown_events: unknown,
      fts_documents: Number(db.prepare('SELECT count(*) AS n FROM search_documents WHERE deleted_generation IS NULL').get()?.n) };
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
    for (const row of this.registry.prepare('SELECT repo_uuid,owner_key FROM repositories').all()) {
      this.registry.prepare('UPDATE repositories SET accounted_bytes=? WHERE repo_uuid=?').run(size(join(this.root, 'owners', String(row.owner_key), 'repos', String(row.repo_uuid))), row.repo_uuid);
    }
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

  /** Explicit recovery also works in a continuing process (no restart required).
   * Admission and foreground sync invoke this sweep; no hidden timer is added.
   * Registry-first snapshots retain durable living reservations, and reap only
   * expired leases or demonstrably dead same-host PIDs. Committed evidence is
   * always tallied from repo DBs, never inferred from reservation allocations.
   * Logical evidence totals
   * include sealed stores; physical allocation still gates admission. */
  reconcileQuota(): number {
    this.registry.exec('BEGIN IMMEDIATE');
    try {
      const total = this.reconcileQuotaLocked();
      this.refreshAccounting();
      this.registry.exec('COMMIT');
      return total;
    } catch (error) { this.registry.exec('ROLLBACK'); throw error; }
  }

  private reconcileQuotaLocked(): number {
    for (const row of this.registry.prepare('SELECT reservation_id,repo_uuid,owner_key,pid,host,expires_at FROM reservations').all()) {
      let active = Date.now() < Number(row.expires_at);
      if (active && row.host === hostname()) {
        try { process.kill(Number(row.pid), 0); }
        catch (error) {
          // EPERM means the PID exists but is inaccessible: retain its lease.
          if ((error as NodeJS.ErrnoException).code === 'ESRCH') active = false;
        }
      }
      if (!active) {
        // Revoke before returning quota, atomically under the registry writer lock.
        // Deletion cascades to the token epoch; the monotonic bump also invalidates
        // any cached epoch even when no replacement writer has been admitted.
        const db = this.repoDatabase(String(row.owner_key), String(row.repo_uuid));
        db.exec('BEGIN IMMEDIATE');
        try {
          const epoch = db.prepare('UPDATE fencing_state SET authoritative_epoch=authoritative_epoch+1,active_reservation_id=NULL WHERE singleton=1 RETURNING authoritative_epoch').get()!.authoritative_epoch;
          db.exec('COMMIT');
          this.registry.prepare('INSERT INTO epoch_counter VALUES(?,?) ON CONFLICT(repo_uuid) DO UPDATE SET epoch=excluded.epoch').run(row.repo_uuid, epoch);
        } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
        this.registry.prepare('DELETE FROM reservations WHERE reservation_id=?').run(row.reservation_id);
      }
    }
    let total = 0;
    for (const row of this.registry.prepare('SELECT repo_uuid,owner_key FROM repositories').all()) {
      const path = this.repositoryPath(String(row.owner_key), String(row.repo_uuid));
      let bytes = 0;
      if (existsSync(path)) {
        const db = createContextDatabase(path, { readOnly: true });
        try {
          bytes = Number(db.prepare('SELECT coalesce(sum(retained_bytes),0) AS n FROM evidence').get()?.n);
        } finally { db.close(); }
      }
      this.registry.prepare('INSERT INTO quota_usage VALUES(?,?) ON CONFLICT(repo_uuid) DO UPDATE SET evidence_bytes=excluded.evidence_bytes').run(row.repo_uuid, bytes);
      total += bytes;
    }
    return total;
  }

  /** Trusted local configuration only. Caps can be lowered; no tool exposes this method. */
  configureQuota(input: Partial<{ device_bytes: number; owner_bytes: number; repo_bytes: number; metadata_reserve_bytes: number }>): void {
    const current = this.registry.prepare('SELECT * FROM quota_policy WHERE singleton=1').get()!;
    const keys = ['device_bytes', 'owner_bytes', 'repo_bytes', 'metadata_reserve_bytes'] as const;
    const values = keys.map(key => input[key] ?? Number(current[key]));
    if (values.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('BUDGET_EXCEEDED');
    this.registry.prepare('UPDATE quota_policy SET device_bytes=?,owner_bytes=?,repo_bytes=?,metadata_reserve_bytes=? WHERE singleton=1').run(...values);
  }

  /** Two-phase, recoverable protocol across separate Registry and Repo SQLite files:
   * Single-writer invariant: each repository has at most one active writer lease.
   * Admission checks for a living lease under registry BEGIN IMMEDIATE; the same
   * mutex serializes reconciliation and is held through repo COMMIT/finalization.
   * The durable allocation/reacquisition gap cannot admit a second writer lease.
   * 1. Repo durably increments fencing_state; registry reserves allocation and
   *    records that epoch as a non-authoritative lease token/cache.
   * 2. Repo checks exact epoch/id in its writer transaction and commits evidence.
   * 3. Registry finalizes quota under the same registry-first writer mutex.
   * This is not distributed atomic commit; reconcileQuota repairs the crash gap.
   * Includes DB/WAL/SHM and sealed allocations; reserve is never payload space.
   */
  quotaWrite<T>(owner: string, repo: string, allocation: number, action: () => T): T {
    this.authorize(owner, repo);
    this.repoDatabase(owner, repo);
    this.unscopedDatabase(owner); // Coverage reserve exists before admission.
    if (this.activeReservation) throw new Error('RESERVATION_FENCED_OFF');
    const reservation = opaque();
    this.registry.exec('BEGIN IMMEDIATE');
    try {
      // Automatic reconciliation precedes every quota decision, including failed
      // allocations: dead leases cannot cause a spurious QUOTA_EXCEEDED.
      this.reconcileQuotaLocked();
      if (this.registry.prepare('SELECT 1 FROM reservations WHERE repo_uuid=? LIMIT 1').get(repo)) throw new Error('BUSY');
      const total = this.refreshAccounting();
      const policy = this.registry.prepare('SELECT * FROM quota_policy WHERE singleton=1').get()!;
      const ownerSize = Number(this.registry.prepare('SELECT accounted_bytes FROM owners WHERE owner_key=?').get(owner)?.accounted_bytes);
      const repoSize = Number(this.registry.prepare('SELECT accounted_bytes FROM repositories WHERE repo_uuid=?').get(repo)?.accounted_bytes);
      const reserve = Number(policy.metadata_reserve_bytes);
      const pending = this.registry.prepare('SELECT coalesce(sum(allocation),0) AS device, coalesce(sum(CASE WHEN owner_key=? THEN allocation ELSE 0 END),0) AS owner, coalesce(sum(CASE WHEN repo_uuid=? THEN allocation ELSE 0 END),0) AS repo FROM reservations').get(owner, repo)!;
      if (total + Number(pending.device) + allocation > Number(policy.device_bytes) || ownerSize + Number(pending.owner) + allocation > Number(policy.owner_bytes) || repoSize + Number(pending.repo) + allocation > Number(policy.repo_bytes) - reserve) {
        this.registry.exec('COMMIT');
        this.recordUnscoped(owner, 'quota');
        throw new Error('QUOTA_EXCEEDED');
      }
      const now = Date.now();
      this.registry.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?)').run(reservation, repo, process.pid, hostname(), now, now + 300000, allocation, owner);
      const db = this.repoDatabase(owner, repo);
      db.exec('BEGIN IMMEDIATE');
      let epoch;
      try {
        epoch = db.prepare('UPDATE fencing_state SET authoritative_epoch=authoritative_epoch+1,active_reservation_id=? WHERE singleton=1 RETURNING authoritative_epoch').get(reservation)!.authoritative_epoch;
        db.exec('COMMIT'); // Repository authority is durable before registry admission.
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
      this.registry.prepare('INSERT INTO epoch_counter VALUES(?,?) ON CONFLICT(repo_uuid) DO UPDATE SET epoch=excluded.epoch').run(repo, epoch);
      this.registry.prepare('INSERT INTO reservation_epochs VALUES(?,?)').run(reservation, epoch);
      this.activeReservation = reservation;
      this.activeEpoch = Number(this.registry.prepare('SELECT epoch FROM reservation_epochs WHERE reservation_id=?').get(reservation)!.epoch);
      // Deterministic interleaving boundary: lease acquired and registry epoch
      // read, admission COMMIT releases registry; NO evidence BEGIN IMMEDIATE
      // has started. A reaper can now revoke in its own repo transaction.
      this.registry.exec('COMMIT'); // Durable before repo writes.
      this.registry.exec('BEGIN IMMEDIATE'); // Preserve registry -> repo lock order.
      const result = action();
      // Do not unlock after repo COMMIT. Expiry fences the repo commit, not
      // accounting for evidence already committed under a valid token.
      this.registry.prepare('DELETE FROM reservations WHERE reservation_id=?').run(reservation);
      this.reconcileQuotaLocked();
      this.refreshAccounting();
      this.registry.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.registry.exec('ROLLBACK'); } catch { /* Admission rejection already committed accounting. */ }
      this.registry.prepare('DELETE FROM reservations WHERE reservation_id=?').run(reservation);
      throw error;
    } finally { this.activeReservation = undefined; this.activeEpoch = undefined; }
  }

  quotaGaps(owner: string): number {
    this.authorize(owner);
    const path = join(this.root, 'owners', owner, 'unscoped.sqlite');
    if (!existsSync(path)) return 0;
    const db = createContextDatabase(path, { readOnly: true });
    try { return Number(db.prepare("SELECT count(*) AS n FROM gaps WHERE reason='quota'").get()?.n); }
    finally { db.close(); }
  }

  private cursorEpoch(repo: string): number {
    const exists = this.registry.prepare("SELECT 1 FROM sqlite_master WHERE name='cursor_epochs'").get();
    return exists ? Number(this.registry.prepare('SELECT epoch FROM cursor_epochs WHERE repo_uuid=?').get(repo)?.epoch ?? 0) : 0;
  }

  /** Destructive domain seam for trusted local owner administration, never MCP dispatch. */
  cleanup(owner: string, repo: string, input: { before: number; localAdmin: boolean }) {
    if (input.localAdmin !== true) throw new Error('ACCESS_DENIED');
    if (!Number.isSafeInteger(input.before) || input.before < 0) throw new Error('BUDGET_EXCEEDED');
    // Purge and capture/sync admission share a registry writer mutex, always
    // acquired before the repo lock. Contention waits up to busy_timeout; on
    // timeout maintenance fails without deleting anything, never steals a writer.
    if (!this.registry.prepare('SELECT 1 FROM repositories WHERE owner_key=? AND repo_uuid=?').get(owner, repo)) throw new Error('ACCESS_DENIED');
    // Commit intent/epoch separately before repo deletion, so a crash between
    // repo and registry commits cannot erase audit history or revive cursors.
    this.registry.prepare('INSERT INTO cursor_epochs VALUES(?,1) ON CONFLICT(repo_uuid) DO UPDATE SET epoch=epoch+1').run(repo);
    const audit = opaque();
    this.registry.prepare('INSERT INTO admin_audit VALUES(?,?,?,?)').run(audit, repo, Date.now(), 0);
    // Durable before deletion: retries (including after crash) repeat the
    // idempotent deletion/optimize/checkpoint, even when no refs remain.
    this.registry.prepare('INSERT OR REPLACE INTO purge_retries VALUES(?,1)').run(repo);
    this.registry.exec('BEGIN IMMEDIATE');
    try {
      const db = this.database(owner, repo, true);
      db.exec('BEGIN IMMEDIATE');
      let purged = 0;
      try {
        db.prepare('DELETE FROM cursors WHERE expires_at<=?').run(Date.now());
        if (db.prepare('SELECT 1 FROM cursors LIMIT 1').get()) throw new Error('BUSY');
        const refs = db.prepare("SELECT DISTINCT p.ref FROM evidence p JOIN events e ON e.payload_ref=p.ref WHERE e.accepted_at<? AND p.retention_state='available'").all(input.before);
        for (const row of refs) {
          db.prepare('DELETE FROM evidence_fts WHERE ref=?').run(row.ref);
          db.prepare('DELETE FROM search_documents WHERE ref=?').run(row.ref);
          db.prepare("UPDATE evidence SET text='',retained_bytes=0,retention_state='expired' WHERE ref=?").run(row.ref);
        }
        // secure_delete=ON zeroes deleted content in main SQLite pages. FTS5
        // optimize merges segments into one new tree without old tombstones,
        // removing shared-prefix/suffix fragments that whole-token scans miss.
        // Success additionally requires checked WAL TRUNCATE below.
        db.exec("INSERT INTO evidence_fts(evidence_fts) VALUES('optimize')");
        purged = refs.length;
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      this.registry.prepare('UPDATE admin_audit SET purged=? WHERE audit_id=?').run(purged, audit);
      // Bounded reclaim requires no second full-size DB. Registry serialization
      // excludes capture writers; a reader blocking WAL erasure returns BUSY.
      // Legacy NONE stores reuse pages.
      for (let page = 0; page < 256; page++) {
        if (!Number(db.prepare('PRAGMA freelist_count').get()?.freelist_count)) break;
        db.exec('PRAGMA incremental_vacuum(1)');
      }
      const checkpoint = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
      // SQLite retries internally for the configured busy_timeout. Missing or
      // nonzero status cannot establish erasure and must fail closed.
      if (!checkpoint || Number(checkpoint.busy) !== 0) throw new Error('PURGE_CHECKPOINT_BUSY');
      this.registry.prepare('DELETE FROM purge_retries WHERE repo_uuid=?').run(repo);
      this.reconcileQuotaLocked();
      const accounted_bytes = this.refreshAccounting();
      this.registry.exec('COMMIT');
      return { purged, accounted_bytes };
    } catch (error) { this.registry.exec('ROLLBACK'); throw error; }
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
