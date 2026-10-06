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

export function parseVersion(raw: unknown): number {
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^(0|[1-9]\d*)$/.test(raw))) {
    throw new Error('INDEX_INCOMPATIBLE');
  }
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 0 || version > 3) {
    throw new Error('INDEX_INCOMPATIBLE');
  }
  return version;
}

/** Versioned transactional migration; future schema is never replaced by an empty DB. */
export function migrate(db: DatabaseSync, kind: 'registry' | 'repo' | 'unscoped'): void {
  db.exec('PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON');
  let version = parseVersion(db.prepare('PRAGMA user_version').get()?.user_version);
  if (version === 3) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    // Another opener may have migrated while we waited for the write lock.
    version = parseVersion(db.prepare('PRAGMA user_version').get()?.user_version);
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
