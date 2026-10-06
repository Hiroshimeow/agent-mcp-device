import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../../dist/context/migrations/index.js';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { sync } from '../../dist/context/indexer.js';
import { temporary } from './helpers.js';

test('v1 repo migration preserves evidence and installs incremental retrieval schema', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE evidence(ref TEXT PRIMARY KEY,text TEXT); INSERT INTO evidence VALUES('r','retained');
      CREATE VIRTUAL TABLE evidence_fts USING fts5(ref UNINDEXED,text);
      INSERT INTO evidence_fts VALUES('r','chẩn đoán'); PRAGMA user_version=1;`);
    migrate(db, 'repo'); migrate(db, 'repo');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    assert.equal(db.prepare('SELECT text,retention_state FROM evidence').get().text, 'retained');
    assert.equal(db.prepare('SELECT count(*) AS n FROM search_documents').get().n, 0);
    assert.equal(db.prepare("SELECT ref FROM evidence_fts WHERE evidence_fts MATCH 'chan'").get().ref, 'r');
  } finally { db.close(); }
});

test('v2 migration adds snapshot tombstones and folds existing redacted FTS content', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE search_documents(ref TEXT PRIMARY KEY,source_kind TEXT,timestamp INTEGER,first_indexed_generation INTEGER,last_indexed_generation INTEGER);
      CREATE VIRTUAL TABLE evidence_fts USING fts5(ref UNINDEXED,text);
      INSERT INTO evidence_fts VALUES('r','Đường dẫn [REDACTED:password:0123456789abcdef]'); PRAGMA user_version=2;`);
    migrate(db, 'repo'); migrate(db, 'repo');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    assert.ok(db.prepare('PRAGMA table_info(search_documents)').all().some(column => column.name === 'deleted_generation'));
    assert.equal(db.prepare("SELECT ref FROM evidence_fts WHERE evidence_fts MATCH 'duong'").get().ref, 'r');
  } finally { db.close(); }
});

test('FTS filters first generation, retention, source and time without returning cross-scope evidence', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const owner = store.activateOwner('a'), repo = store.repository(owner, 'repo'), other = store.repository(owner, 'other');
  const visible = store.append(owner, repo, 'chẩn đoán lỗi tiếng Việt');
  const hidden = store.append(owner, repo, 'chẩn đoán lỗi đã hết hạn');
  store.append(owner, other, 'CROSS_SCOPE_CANARY'); sync(store, owner, other); sync(store, owner, repo);
  const db = store.repoDatabase(owner, repo), service = new ContextService(store), g = store.manifest(owner, repo).generation;
  db.prepare('UPDATE search_documents SET first_indexed_generation=? WHERE ref=?').run(g + 1, hidden);
  assert.deepEqual(service.search(owner, repo, { query: 'chẩn đoán' }).items.map(r => r.ref), [visible]);
  db.prepare('UPDATE search_documents SET first_indexed_generation=? WHERE ref=?').run(g, hidden);
  db.prepare('UPDATE search_documents SET deleted_generation=? WHERE ref=?').run(g, hidden);
  assert.deepEqual(service.search(owner, repo, { query: 'chẩn đoán' }).items.map(r => r.ref), [visible]);
  db.prepare('UPDATE search_documents SET deleted_generation=? WHERE ref=?').run(g + 1, hidden);
  assert.equal(service.search(owner, repo, { query: 'chẩn đoán' }).items.length, 2);
  db.prepare("UPDATE evidence SET retention_state='expired' WHERE ref=?").run(hidden);
  assert.deepEqual(service.search(owner, repo, { query: 'chẩn đoán' }).items.map(r => r.ref), [visible]);
  assert.equal(service.search(owner, repo, { query: 'chẩn đoán', source_types: ['checkpoint'] }).items.length, 0);
  assert.equal(service.search(owner, repo, { query: 'chẩn đoán', until: 1 }).items.length, 0);
  assert.equal(service.search(owner, repo, { query: 'CROSS_SCOPE_CANARY' }).items.length, 0);
  assert.equal(service.search(owner, repo, { query: 'chan doan' }).items[0].ref, visible);
});
