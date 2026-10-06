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
