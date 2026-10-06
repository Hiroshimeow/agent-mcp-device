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
  assert.throws(() => store.publishGeneration(owner, repo, shadow, 2, 'new-manifest'), /INDEX_INCOMPATIBLE/);
  const recovered = store.beginGeneration(owner, repo);
  store.publishGeneration(owner, repo, recovered, 2, 'new-manifest');
  assert.equal(store.manifest(owner, repo).generation, recovered);
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
