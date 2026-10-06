import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { createV2Repository } from './fixtures/v2-schema.js';
import { ContextStore } from '../../dist/context/store.js';
import { migrate, parseVersion } from '../../dist/context/migrations/index.js';
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

test('pinned keyset pagination uses deterministic bucket and timestamp ordering across generation advances', t => {
  const { store, owner, repo, service } = setup(t);
  const db = store.repoDatabase(owner, repo);
  // Search ranks by discrete relevance buckets (0 = exact substring, 1 = FTS
  // token match), then timestamp DESC and ref ASC as stable tie-breakers.
  // These deterministic keysets are completely insulated from dynamic BM25
  // score shifts. At G, ten documents vary in length and term frequency.
  const texts = Array.from({ length: 10 }, (_, i) =>
    i % 2 ? 'beta '.repeat(i + 1) + 'filler '.repeat(i * 7) : 'alpha beta '.repeat(i + 1) + 'filler '.repeat(i * 3));
  const refs = texts.map((text, i) => {
    const ref = store.append(owner, repo, text);
    // Include equal timestamps to exercise the ref tie-break, not just time ordering.
    db.prepare('UPDATE events SET accepted_at=? WHERE payload_ref=?').run(1000 + Math.floor(i / 4), ref);
    return ref;
  });
  sync(store, owner, repo);
  const scores = () => db.prepare("SELECT ref,bm25(evidence_fts) AS score FROM evidence_fts WHERE evidence_fts MATCH 'alpha OR beta' ORDER BY ref").all();
  const before = scores();
  assert.ok(new Set(before.map(row => row.score)).size > 1);
  const expected = refs.map((ref, i) => ({ ref, bucket: i % 2, timestamp: 1000 + Math.floor(i / 4) }))
    .sort((a, b) => a.bucket - b.bucket || b.timestamp - a.timestamp || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
    .map(doc => doc.ref);
  const first = service.search(owner, repo, { query: 'alpha beta', limit: 2 });
  assert.ok(first.next_cursor);
  assert.deepEqual(first.items.map(item => item.ref), expected.slice(0, 2));
  const generation = first.index.generation;
  assert.equal(generation, 1, 'ten original documents published at G1');
  // At G+1, thirty uneven documents change global token counts and BM25 scores.
  for (let i = 0; i < 30; i++) store.append(owner, repo,
    i % 3 ? 'alpha '.repeat(20 + i) : 'beta '.repeat(i + 1) + 'filler '.repeat(100 + i));
  sync(store, owner, repo);
  assert.equal(store.manifest(owner, repo).generation, 2, 'thirty new documents published at G2');
  assert.equal(db.prepare('SELECT count(*) AS n FROM search_documents').get().n, 40);
  const after = scores();
  assert.ok(before.some(row => row.score !== after.find(next => next.ref === row.ref).score), 'global BM25 statistics actually changed');
  let cursor = first.next_cursor;
  const actual = first.items.map(item => item.ref);
  while (cursor) {
    const page = service.search(owner, repo, { query: 'alpha beta', limit: 2, cursor });
    assert.equal(page.index.generation, generation);
    assert.ok(page.items.length > 0, 'each continuation makes progress');
    actual.push(...page.items.map(item => item.ref));
    assert.ok(actual.length <= 10, 'pinned traversal cannot include G2 documents or loop');
    cursor = page.next_cursor;
  }
  assert.equal(cursor, null, 'traversal ends at the final page');
  assert.equal(actual.length, 10, 'all ten G documents traversed, zero gaps');
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, actual.length, 'zero duplicates');
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

test('documents matching both exact and FTS preserve match_reason 0 and never repeat across keyset page boundaries with limit 1', t => {
  const { store, owner, repo, service } = setup(t);
  const db = store.repoDatabase(owner, repo);
  const dualRefs = ['hello world first', 'hello world second', 'hello world third']
    .map(text => store.append(owner, repo, text));
  const ftsRefs = ['hello distant world', 'world before hello', 'hello alone']
    .map(text => store.append(owner, repo, text));
  const expectedRefs = [...dualRefs, ...ftsRefs];
  expectedRefs.forEach((ref, i) => {
    // Ties exercise ref ordering; newer FTS rows must still follow exact rows.
    db.prepare('UPDATE events SET accepted_at=? WHERE payload_ref=?').run(1000 + Math.floor(i / 2), ref);
  });
  sync(store, owner, repo);
  const exactRefs = db.prepare('SELECT ref FROM evidence WHERE instr(lower(text),lower(?))>0')
    .all('hello world').map(row => row.ref);
  const tokenRefs = db.prepare('SELECT ref FROM evidence_fts WHERE evidence_fts MATCH ?')
    .all('"hello" OR "world"').map(row => row.ref);
  assert.deepEqual(new Set(exactRefs), new Set(dualRefs));
  assert.deepEqual(new Set(tokenRefs), new Set(expectedRefs));
  const withReadDatabase = store.withReadDatabase.bind(store);
  const scores = new Map();
  store.withReadDatabase = (owner, repo, action) => withReadDatabase(owner, repo, db => action({
    prepare: sql => {
      const statement = db.prepare(sql);
      return { all: (...parameters) => {
        const rows = statement.all(...parameters);
        for (const row of rows) {
          if (!scores.has(row.ref)) scores.set(row.ref, []);
          scores.get(row.ref).push(row.score);
        }
        return rows;
      } };
    },
  }));
  const items = [];
  let cursor;
  do {
    const page = service.search(owner, repo, { query: 'hello world', limit: 1, cursor });
    assert.equal(page.items.length, 1, 'each page makes progress');
    items.push(...page.items);
    assert.ok(items.length <= expectedRefs.length, 'traversal cannot repeat or loop');
    cursor = page.next_cursor;
  } while (cursor !== null);
  const allRefs = items.map(item => item.ref);
  assert.equal(new Set(allRefs).size, allRefs.length, 'zero duplicate refs');
  assert.deepEqual(new Set(allRefs), new Set(expectedRefs), 'all expected refs, zero gaps');
  for (const ref of dualRefs) {
    assert.equal(items.find(item => item.ref === ref).match_reason, 'exact');
    assert.ok(scores.get(ref).every(score => score === 0), 'dual matches retain numeric SQL score zero on every page');
  }
  for (const ref of ftsRefs) assert.equal(items.find(item => item.ref === ref).match_reason, 'fts');
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
    // Valid-MAC expired control is STALE at the domain boundary; the same
    // expired metadata with an invalid MAC must be INVALID, proving MAC-first.
    // The store authenticates metadata; continuation enforces its lifetime.
    const expiredState = store.parseReadCursor(owner, repo, expired);
    assert.ok(expiredState.expires_at < Date.now(), 'cursor is verified expired');
    assert.throws(() => resume(expired), { message: 'CURSOR_STALE' });
    // Mutate one position digit directly in this expired cursor's raw body,
    // preserving its expiry, query key, valid JSON, and original MAC.
    const [expBody, expMac] = expired.split('.');
    const expRaw = Buffer.from(expBody, 'base64url');
    const original = Buffer.from(expRaw);
    const needle = Buffer.from('"position":');
    const offset = expRaw.indexOf(needle);
    assert.ok(offset >= 0);
    expRaw[offset + needle.length] = expRaw[offset + needle.length] === 0x30 ? 0x31 : 0x30;
    assert.equal(expRaw.filter((byte, i) => byte !== original[i]).length, 1);
    const tamperedBody = expRaw.toString('base64url');
    assert.doesNotThrow(() => JSON.parse(Buffer.from(tamperedBody, 'base64url').toString('utf8')),
      'tampered expired payload remains valid JSON; rejection must come from authentication');
    assert.equal(JSON.parse(Buffer.from(tamperedBody, 'base64url').toString('utf8')).expires_at, expiredState.expires_at);
    const tamperedExpired = `${tamperedBody}.${expMac}`;
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
  const raw = Buffer.from(body, 'base64url'), original = Buffer.from(raw);
  const needle = Buffer.from('"position":');
  const offset = raw.indexOf(needle);
  assert.ok(offset >= 0, 'found position key in raw payload');
  // Mutate the digit after "position", not the key or surrounding JSON syntax.
  const digitOffset = offset + needle.length;
  raw[digitOffset] = raw[digitOffset] === 0x30 ? 0x31 : 0x30;
  assert.equal(raw.filter((byte, i) => byte !== original[i]).length, 1);
  const tamperedBody = raw.toString('base64url');
  const tamperedToken = `${tamperedBody}.${mac}`; // Original MAC.
  assert.doesNotThrow(() => JSON.parse(Buffer.from(tamperedBody, 'base64url').toString('utf8')));
  assert.throws(() => store.parseReadCursor(owner, repo, tamperedToken), { message: 'CURSOR_INVALID' });
  assert.throws(() => service.search(owner, repo, { query: 'foo', limit: 1, cursor: tamperedToken }), { message: 'CURSOR_INVALID' });
  // Positive control: changed metadata is valid when authenticated with a new MAC.
  const validMacOnTampered = store.signReadCursor(owner, repo, JSON.parse(Buffer.from(raw).toString('utf8')));
  assert.doesNotThrow(() => store.parseReadCursor(owner, repo, validMacOnTampered));
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
  assert.deepEqual(result.sql, ['PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON', 'BEGIN IMMEDIATE', 'COMMIT']);
});

test('concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction', { timeout: 15000 }, async t => {
  const result = await migrationRace(t, 4);
  assert.equal(result.error, 'INDEX_INCOMPATIBLE');
  assert.deepEqual(result.versions, [2, 4]);
  assert.equal(result.canBegin, true);
  assert.deepEqual(result.sql, ['PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON', 'BEGIN IMMEDIATE', 'ROLLBACK', 'BEGIN IMMEDIATE; COMMIT;']);
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
  const path = store.databaseFiles().find(file => file.endsWith('repo.sqlite'));
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

const invalidVersions = [null, '', ' ', ' 3', '3.0', '03', [], true, false, undefined, NaN, 'unreadable', -1, 1.5, 4, 3n, Symbol('3')];

test('parseVersion rejects unreadable and invalid versions directly', () => {
  for (const bad of invalidVersions) {
    assert.throws(() => parseVersion(bad), { message: 'INDEX_INCOMPATIBLE' }, `version ${String(bad)}`);
  }
  for (const version of [0, 1, 2, 3]) {
    assert.equal(parseVersion(version), version);
    assert.equal(parseVersion(String(version)), version);
  }
});

test('migration rejects unreadable and invalid versions before and after BEGIN IMMEDIATE', t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  // SQLite normally returns integers; intercept only PRAGMA reads to simulate
  // unreadable/corrupt metadata, keeping transaction behavior on real SQLite.
  for (const bad of invalidVersions) {
    for (const postLock of [false, true]) {
      const sqlLog = [];
      let reads = 0;
      const wrapper = {
        prepare: sql => sql === 'PRAGMA user_version'
          ? { get: () => {
            reads++;
            return { user_version: postLock && reads === 1 ? 2 : bad };
          } }
          : db.prepare(sql),
        exec: sql => { sqlLog.push(sql); db.exec(sql); },
      };
      assert.throws(() => migrate(wrapper, 'repo'), { message: 'INDEX_INCOMPATIBLE' },
        `version ${String(bad)}, post-lock=${postLock}`);
      assert.equal(reads, postLock ? 2 : 1, 'invalid metadata is read at the intended migration boundary');
      assert.deepEqual(sqlLog, postLock
        ? ['PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON', 'BEGIN IMMEDIATE', 'ROLLBACK']
        : ['PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON']);
      assert.doesNotThrow(() => db.exec('BEGIN IMMEDIATE; ROLLBACK'));
    }
  }
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

test('FTS search binds every SQL placeholder and uses all-null first-page keyset sentinels', t => {
  const { store, owner, repo, service } = setup(t);
  const db = store.repoDatabase(owner, repo);
  const refs = [store.append(owner, repo, 'binding sentinel first'), store.append(owner, repo, 'binding sentinel second')];
  for (const ref of refs) db.prepare('UPDATE events SET accepted_at=? WHERE payload_ref=?').run(Number.MAX_SAFE_INTEGER, ref);
  sync(store, owner, repo);
  const expected = [...refs].sort();
  const withReadDatabase = store.withReadDatabase.bind(store);
  const calls = [];
  store.withReadDatabase = (owner, repo, action) => withReadDatabase(owner, repo, db => action({
    prepare: sql => {
      assert.ok(sql.includes('evidence_fts MATCH ?'));
      const statement = db.prepare(sql);
      return { all: (...parameters) => {
        assert.equal(parameters.length, (sql.match(/\?/g) ?? []).length, 'FTS arguments exactly match placeholders');
        calls.push(parameters);
        return statement.all(...parameters);
      } };
    },
  }));
  const options = { query: 'binding', limit: 1, source_types: ['history'], since: 0, until: Number.MAX_SAFE_INTEGER };
  const first = service.search(owner, repo, options);
  assert.deepEqual(first.items.map(item => item.ref), expected.slice(0, 1));
  assert.ok(first.next_cursor);
  assert.deepEqual(calls[0], ['binding', '"binding"', 1, 1, 'history', 0, Number.MAX_SAFE_INTEGER,
    null, null, null, null, null, null, null, 2]);
  assert.deepEqual(calls[0].slice(7, 14), Array(7).fill(null), 'all seven first-page keyset slots are null');
  const second = service.search(owner, repo, { ...options, cursor: first.next_cursor });
  assert.deepEqual(second.items.map(item => item.ref), expected.slice(1));
  assert.equal(second.next_cursor, null);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['binding', '"binding"', 1, 1, 'history', 0, Number.MAX_SAFE_INTEGER,
    0, 0, 0, Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER, expected[0], 2]);
  const state = store.parseReadCursor(owner, repo, first.next_cursor);
  assert.deepEqual(calls[1].slice(7, 14), [
    state.last_match, state.last_match, state.last_match, state.last_timestamp,
    state.last_match, state.last_timestamp, state.last_ref,
  ], 'continuation keyset slots: match, match, match, timestamp, match, timestamp, ref');
});

test('FTS syntax characters are quoted as tokens and never interpreted as operators', t => {
  const { store, owner, repo, service } = setup(t);
  const tokenMatchRef = store.append(owner, repo, 'foo x OR NEAR SQL');
  const expectedRef = store.append(owner, repo, 'foo AND -x special syntax');
  sync(store, owner, repo);
  for (const query of ['"', 'foo AND', '-x', 'OR * NEAR(', ' " OR * NEAR( SQL -- ']) {
    assert.doesNotThrow(() => service.search(owner, repo, { query }), query);
  }
  const page = service.search(owner, repo, { query: 'foo AND -x' });
  assert.deepEqual(page.items.map(item => item.ref), [expectedRef, tokenMatchRef]);
  assert.deepEqual(page.items.map(item => item.match_reason), ['exact', 'fts']);
});

test('empty-token queries skip FTS and return only substring matches', t => {
  const { store, owner, repo, service } = setup(t);
  const expectedRef = store.append(owner, repo, 'literal """ punctuation');
  store.append(owner, repo, 'unrelated text');
  sync(store, owner, repo);
  const withReadDatabase = store.withReadDatabase.bind(store);
  store.withReadDatabase = (owner, repo, action) => withReadDatabase(owner, repo, db => action({
    prepare: sql => {
      assert.ok(!sql.includes('evidence_fts MATCH'), 'empty tokens never execute an FTS MATCH branch');
      const statement = db.prepare(sql);
      return { all: (...parameters) => {
        assert.equal(parameters.length, (sql.match(/\?/g) ?? []).length, 'bound arguments match SQL placeholders without an FTS parameter');
        assert.ok(!parameters.includes(''), 'empty FTS expression is not bound');
        return statement.all(...parameters);
      } };
    },
  }));
  const page = service.search(owner, repo, { query: '"""' });
  assert.deepEqual(page.items.map(item => item.ref), [expectedRef]);
  assert.equal(page.items[0].match_reason, 'exact');
  assert.deepEqual(service.search(owner, repo, { query: '!!!' }).items, []);
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
