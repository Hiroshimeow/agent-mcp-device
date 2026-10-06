import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import crypto, { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { createV2Repository } from './fixtures/v2-schema.js';
import { ContextStore, createContextDatabase } from '../../dist/context/store.js';
import { consumeAdminToken } from '../../dist/context/cli.js';
import { ContextService } from '../../dist/context/service.js';
import * as authorization from '../../dist/context/service.js';
const isFeatureAuthorized = (...args) => authorization.isFeatureAuthorized(...args);
import { temporary } from './helpers.js';
import { fileURLToPath } from 'node:url';
import { requireFeatureAuthorized } from '../../dist/context/authorization.js';

function fixture(t) {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('blockers'), repo = store.repository(owner, 'repo');
  return { root, store, owner, repo };
}

test('B1 maintenance uses incremental reclamation and explicit WAL truncate', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  assert.equal(db.prepare('PRAGMA auto_vacuum').get().auto_vacuum, 2);
  const source = readFileSync(new URL('../../src/context/store.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /; VACUUM;/);
  assert.match(source, /wal_checkpoint\(TRUNCATE\)/);
});

test('B1 concurrent purge waits for an active writer and preserves every event', async t => {
  const f = fixture(t); f.store.append(f.owner, f.repo, 'old');
  const child = fork(new URL('./fixtures/maintenance-worker.js', import.meta.url), [f.root, f.owner, f.repo, 'writer'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => child.kill());
  await once(child, 'message');
  const exited = once(child, 'exit');
  assert.equal(f.store.cleanup(f.owner, f.repo, { before: 1, localAdmin: true }).purged, 0);
  await exited;
  const db = f.store.repoDatabase(f.owner, f.repo);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 21);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 21);
});

test('B1 capture writer waits for purge lock release with zero lost events', async t => {
  const f = fixture(t); f.store.append(f.owner, f.repo, 'old');
  const child = fork(new URL('./fixtures/maintenance-worker.js', import.meta.url), [f.root, f.owner, f.repo, 'purge'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => child.kill()); await once(child, 'message');
  const exited = once(child, 'exit');
  for (let i = 0; i < 20; i++) f.store.append(f.owner, f.repo, `capture-${i}`);
  await exited;
  const db = f.store.repoDatabase(f.owner, f.repo);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 21);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 21);
});

test('B2 admin purge rejects agent environments even with TTY input and output', () => {
  for (const marker of ['MCP_DEVICE_SESSION', 'MCP_RUNNER', 'MCP_DEVICE_REMOTE', 'PI_SESSION_ID']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { runContextCli } from './dist/context/cli.js';
      Object.defineProperty(process.stdin, 'isTTY', { value: true });
      Object.defineProperty(process.stdout, 'isTTY', { value: true });
      const result = await runContextCli(['clean','--owner','owner','--repo','repo','--before','1']);
      process.stdout.write(JSON.stringify(result));
    `], { cwd: new URL('../../', import.meta.url), env: { ...process.env, [marker]: 'test' }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.exitCode, 3);
    assert.equal(JSON.parse(output.stderr).error.code, 'ACCESS_DENIED');
  }
});

test('B3 killed cross-database writer reconciles exact committed evidence bytes on restart', async t => {
  const f = fixture(t); f.store.append(f.owner, f.repo, 'committed');
  const child = fork(new URL('./fixtures/maintenance-worker.js', import.meta.url), [f.root, f.owner, f.repo, 'crash'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => child.kill()); await once(child, 'message');
  const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  const restarted = new ContextStore(f.root);
  try {
    const actual = Number(restarted.repoDatabase(f.owner, f.repo).prepare('SELECT sum(retained_bytes) AS n FROM evidence').get().n);
    assert.equal(actual, 9 + 15);
    assert.equal(restarted.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(f.repo).evidence_bytes, actual);
    assert.equal(restarted.reconcileQuota(), actual);
  } finally { restarted.close(); }
});

test('B3 reconciliation waits for a separate-process admission and retains sealed evidence totals', { timeout: 15000 }, async t => {
  const f = fixture(t);
  f.store.append(f.owner, f.repo, 'sealed');
  const owner = f.store.activateOwner('active'), repo = f.store.repository(owner, 'active');
  f.store.append(owner, repo, 'old');
  const child = fork(new URL('./fixtures/maintenance-worker.js', import.meta.url), [f.root, owner, repo, 'writer'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => child.kill());
  const exited = once(child, 'exit');
  await once(child, 'message'); // Child owns the admission lock with uncommitted evidence.
  assert.equal(f.store.reconcileQuota(), 6 + 3 + 20 * 6);
  const [code] = await exited;
  assert.equal(code, 0);
  assert.equal(f.store.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(repo).evidence_bytes, 123);
  assert.equal(f.store.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(f.repo).evidence_bytes, 6);
  assert.equal(f.store.repoDatabase(owner, repo).prepare('SELECT count(*) AS n FROM evidence').get().n, 21);
  const used = f.store.refreshAccounting();
  f.store.configureQuota({ device_bytes: used });
  assert.throws(() => f.store.append(owner, repo, 'overcommit'), /QUOTA_EXCEEDED/);
  assert.equal(f.store.reconcileQuota(), 129);
});

test('B1 migrated auto-vacuum NONE purge clears indexed payload bytes and logical quota without rebuilding', t => {
  const f = fixture(t);
  const path = join(f.root, 'context', 'owners', f.owner, 'repos', f.repo, 'repo.sqlite');
  mkdirSync(join(path, '..'), { recursive: true });
  const legacy = new DatabaseSync(path);
  createV2Repository(legacy);
  assert.equal(legacy.prepare('PRAGMA auto_vacuum').get().auto_vacuum, 0);
  legacy.close();
  const prefix = 'canarytokenprefix', suffixes = ['alphaunique', 'betaunique'];
  const payload = prefix + suffixes[0], sibling = prefix + suffixes[1];
  // Whole-token scans miss FTS5 leaf-page shared-prefix compression.
  const fragments = [prefix, ...suffixes, 'canarytoken', 'tokenprefix', 'alphauniq', 'betauniq', payload, sibling];
  const ref = f.store.append(f.owner, f.repo, `${payload} ${sibling} `.repeat(8000));
  new ContextService(f.store).sync(f.owner, f.repo);
  const db = f.store.repoDatabase(f.owner, f.repo);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
  assert.equal(db.prepare('PRAGMA auto_vacuum').get().auto_vacuum, 0);
  assert.equal(db.prepare('PRAGMA secure_delete').get().secure_delete, 1);
  assert.equal(db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get().busy, 0, 'positive-control checkpoint completed');
  t.diagnostic('C2-1 scanned fragment byte lengths: ' + fragments.map(fragment => `${fragment}:${Buffer.byteLength(fragment)}`).join(', '));
  for (const fragment of fragments) assert.ok(readFileSync(path).includes(Buffer.from(fragment)), `positive byte-scan control before purge: ${fragment}`);
  db.exec("CREATE VIRTUAL TABLE evidence_fts_vocab USING fts5vocab(evidence_fts, 'row')");
  for (const term of [payload, sibling]) assert.equal(db.prepare('SELECT * FROM evidence_fts_vocab WHERE term = ?').all(term).length, 1, 'positive vocabulary control');
  assert.equal(f.store.cleanup(f.owner, f.repo, { before: Date.now() + 1000, localAdmin: true }).purged, 1);
  assert.equal(db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get().busy, 0, 'post-purge truncate checkpoint completed');
  assert.equal(f.store.read(f.owner, f.repo, ref).text, '');
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence_fts').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM search_documents').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 1);
  assert.equal(db.prepare('PRAGMA auto_vacuum').get().auto_vacuum, 0);
  assert.ok(db.prepare('PRAGMA freelist_count').get().freelist_count > 0, 'legacy pages retained for reuse');
  assert.equal(f.store.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(f.repo).evidence_bytes, 0);
  assert.equal(fs.statSync(path + '-wal').size, 0, 'truncate leaves a zero-byte WAL');
  for (const canary of fragments) assert.equal(db.prepare('SELECT * FROM evidence_fts_vocab WHERE term = ?').all(canary).length, 0, 'deleted terms absent even with FTS prefix compression');
  for (const table of ['data', 'idx', 'content', 'docsize', 'config']) {
    for (const row of db.prepare(`SELECT * FROM evidence_fts_${table}`).all()) {
      for (const value of Object.values(row)) for (const term of fragments) assert.equal(Buffer.from(value instanceof Uint8Array ? value : String(value)).includes(Buffer.from(term)), false, `absent from FTS ${table}: ${term}`);
    }
  }
  // Close every SQLite handle before Windows raw-byte scans. Closing the last
  // connection may remove WAL/SHM; any surviving artifacts are scanned directly.
  f.store.close();
  f.store.close = () => {}; // Fixture teardown must not close the handles twice.
  for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) {
    const bytes = readFileSync(path + suffix);
    for (const canary of fragments) assert.equal(bytes.includes(Buffer.from(canary)), false, `absent from SQLite bytes ${suffix || 'main'}`);
  }
});

for (const [label, answer, expected, missingToken] of [
  ['rejects generic PURGE', 'PURGE', 3],
  ['rejects repository challenge with extra whitespace', 'PURGE repo ', 3],
  ['accepts exact repository challenge with one-time admin token', 'PURGE repo', 0],
  ['rejects PTY agent without admin token despite exact challenge', 'PURGE repo', 3, true],
]) {
  test(`B2 stripped agent markers in TTY-capable child ${label}`, { timeout: 10000 }, async t => {
    const f = fixture(t);
    const token = 'a'.repeat(64);
    writeFileSync(join(f.root, 'admin-clean-token'), JSON.stringify({ token, expires_at: Date.now() + 300000 }), { mode: 0o600 });
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import { runContextCli } from './dist/context/cli.js';
      for (const key of ['MCP_DEVICE_SESSION','MCP_RUNNER','MCP_DEVICE_REMOTE','PI_SESSION_ID','PI_AGENT','CODEX_THREAD_ID','CLAUDECODE']) delete process.env[key];
      Object.defineProperty(process.stdin, 'isTTY', { value: true });
      Object.defineProperty(process.stdout, 'isTTY', { value: true });
      const result = await runContextCli(['clean','--owner','${f.owner}','--repo','${f.repo}','--before','1'], { stateRoot: ${JSON.stringify(f.root)} });
      process.stdout.write(JSON.stringify(result));
    `], { cwd: new URL('../../', import.meta.url), env: { ...process.env, MCP_DEVICE_SESSION: 'process-tool', MCP_RUNNER: 'agent' }, stdio: ['pipe', 'pipe', 'pipe'] });
    t.after(() => child.kill());
    let output = '', prompt = '', sent = false, tokenSent = false;
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => {
      prompt += data;
      if (!tokenSent && prompt.includes('Admin token:')) {
        tokenSent = true;
        child.stdin.write((missingToken ? '0'.repeat(64) : token) + '\n');
      }
      if (!sent && prompt.includes('Type ')) {
        sent = true;
        child.stdin.write(answer.replace('repo', f.repo) + '\n');
      }
    });
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, prompt);
    assert.equal(sent, !missingToken, 'tokenless PTY is denied before prompt');
    if (!missingToken) assert.ok(prompt.includes(`Type PURGE ${f.repo}:`));
    assert.equal(JSON.parse(output).exitCode, expected);
    assert.equal(existsSync(join(f.root, 'admin-clean-token.used')), !missingToken, 'valid authorization is consumed even when confirmation fails');
  });
}

test('P2 argv admin token is rejected even with a local TTY', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { runContextCli } from './dist/context/cli.js';
    for (const key of ['MCP_DEVICE_SESSION','MCP_RUNNER','MCP_DEVICE_REMOTE','PI_SESSION_ID','PI_AGENT','CODEX_THREAD_ID','CLAUDECODE']) delete process.env[key];
    Object.defineProperty(process.stdin, 'isTTY', { value: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true });
    process.stdout.write(JSON.stringify(await runContextCli(['clean','--owner','owner','--repo','repo','--before','1','--admin-token','${'d'.repeat(64)}'])));
  `], { cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(JSON.parse(result.stdout).stderr).error.code, 'ACCESS_DENIED');
});

test('P2 admin token replay is rejected with TOKEN_ALREADY_USED', t => {
  const f = fixture(t), token = 'b'.repeat(64);
  writeFileSync(join(f.root, 'admin-clean-token'), JSON.stringify({ token, expires_at: Date.now() + 300000 }), { mode: 0o600 });
  consumeAdminToken(f.root, token);
  assert.throws(() => consumeAdminToken(f.root, token), /TOKEN_ALREADY_USED/);
});

test('P2 expired token is rejected with TOKEN_EXPIRED', t => {
  const f = fixture(t), token = 'c'.repeat(64);
  writeFileSync(join(f.root, 'admin-clean-token'), JSON.stringify({ token, expires_at: Date.now() - 1 }), { mode: 0o600 });
  assert.throws(() => consumeAdminToken(f.root, token), /TOKEN_EXPIRED/);
});

test('P2 token comparison uses constant-time crypto primitive and never argv', () => {
  const source = readFileSync(new URL('../../src/context/cli.ts', import.meta.url), 'utf8');
  assert.match(source, /timingSafeEqual\(expected, supplied\)/);
  assert.doesNotMatch(source, /argv\[8\]/);
});

test('P3 every production SQLite connection uses the hardened factory', t => {
  const f = fixture(t), path = join(f.root, 'factory.sqlite');
  for (const options of [{}, { readOnly: true }]) {
    const db = createContextDatabase(path, options);
    for (const [pragma, expected] of [['secure_delete', 1], ['busy_timeout', 5000], ['foreign_keys', 1], ['synchronous', 2]]) {
      assert.equal(Object.values(db.prepare(`PRAGMA ${pragma}`).get())[0], expected);
    }
    db.close();
  }
  const directory = new URL('../../src/context/', import.meta.url);
  const constructors = [];
  const inspect = url => {
    for (const entry of readdirSync(url, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url);
      if (entry.isDirectory()) inspect(child);
      else if (entry.name.endsWith('.ts')) {
        const source = readFileSync(child, 'utf8');
        for (const match of source.matchAll(/new DatabaseSync\(/g)) constructors.push(child.pathname);
      }
    }
  };
  inspect(directory);
  assert.equal(constructors.length, 1);
  assert.ok(constructors[0].endsWith('/store.ts'));
  const schema = f.store.repoDatabase(f.owner, f.repo).prepare("SELECT sql FROM sqlite_master WHERE name='evidence_fts'").get().sql;
  assert.doesNotMatch(schema, /content\s*=/i);
});

test('P3 blocked truncate checkpoint fails closed with PURGE_CHECKPOINT_BUSY', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  f.store.append(f.owner, f.repo, 'checkpointcanary');
  const path = join(f.root, 'context', 'owners', f.owner, 'repos', f.repo, 'repo.sqlite');
  const reader = new DatabaseSync(path);
  try {
    reader.exec('BEGIN'); reader.prepare('SELECT * FROM evidence').all();
    // Make the blocking snapshot older than the purge frames.
    db.exec('PRAGMA busy_timeout=20');
    assert.throws(() => f.store.cleanup(f.owner, f.repo, { before: Date.now() + 1000, localAdmin: true }), /PURGE_CHECKPOINT_BUSY/);
    assert.equal(f.store.registry.prepare('SELECT checkpoint_pending FROM purge_retries WHERE repo_uuid=?').get(f.repo).checkpoint_pending, 1);
  } finally { reader.exec('ROLLBACK'); reader.close(); }
  assert.equal(f.store.cleanup(f.owner, f.repo, { before: Date.now() + 1000, localAdmin: true }).purged, 0);
  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM purge_retries WHERE repo_uuid=?').get(f.repo).n, 0);
  assert.equal(db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get().busy, 0);
  assert.equal(f.store.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(f.repo).evidence_bytes, 0);
});

test('P4 expired reservation fences repository commit and rolls back evidence', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  assert.throws(() => f.store.quotaWrite(f.owner, f.repo, 100000, () => {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES('fenced','not committed','hash',13,13,'retained',0)").run();
      f.store.registry.prepare('UPDATE reservations SET expires_at=0').run();
      f.store.assertReservationLive();
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }), /RESERVATION_FENCED_OFF/);
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence WHERE ref='fenced'").get().n, 0);
});

test('P4 real append commit outliving lease is rejected before COMMIT', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    const statement = prepare(sql);
    if (sql.startsWith('INSERT INTO events')) {
      const run = statement.run.bind(statement);
      statement.run = (...args) => {
        const result = run(...args);
        f.store.registry.prepare('UPDATE reservations SET expires_at=0').run();
        return result;
      };
    }
    return statement;
  };
  assert.throws(() => f.store.append(f.owner, f.repo, 'lease expiration'), /RESERVATION_FENCED_OFF/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 0);
});

test('P4 EPERM preserves same-host lease and foreign host does not probe PID', t => {
  const f = fixture(t), kill = process.kill;
  const now = Date.now();
  f.store.registry.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?)').run('permission', f.repo, 123, 'foreign-host', now, now + 300000, 1, f.owner);
  let probes = 0;
  process.kill = () => { probes++; throw Object.assign(new Error('permission'), { code: 'EPERM' }); };
  try {
    f.store.reconcileQuota(); assert.equal(probes, 0);
    f.store.registry.prepare('UPDATE reservations SET host=?').run(hostname());
    f.store.reconcileQuota(); assert.equal(probes, 1);
    assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 1);
  } finally { process.kill = kill; }
});

test('C2-2 stale monotonic epoch rejects a still-live reservation before repo commit', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  f.store.append(f.owner, f.repo, 'first');
  const first = db.prepare('SELECT last_committed_epoch,reservation_id FROM repository_fence').get();
  assert.equal(first.last_committed_epoch, 1);
  assert.ok(first.reservation_id);
  assert.throws(() => f.store.quotaWrite(f.owner, f.repo, 100000, () => {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES('stale','stale','hash',5,5,'retained',0)").run();
      // Simulate a superseding admission while the old lease remains unexpired.
      db.prepare('UPDATE fencing_state SET authoritative_epoch=authoritative_epoch+1').run();
      f.store.commitRepository(db);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }), /RESERVATION_FENCED_OFF/);
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence WHERE ref='stale'").get().n, 0);
  assert.deepEqual(db.prepare('SELECT last_committed_epoch,reservation_id FROM repository_fence').get(), first);
  f.store.append(f.owner, f.repo, 'next');
  assert.ok(db.prepare('SELECT last_committed_epoch FROM repository_fence').get().last_committed_epoch > first.last_committed_epoch);
});

test('C2-2 repo fence rejects an epoch older than its committed watermark', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  f.store.append(f.owner, f.repo, 'first');
  assert.throws(() => f.store.quotaWrite(f.owner, f.repo, 100000, () => {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE repository_fence SET last_committed_epoch=100').run();
      f.store.commitRepository(db);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }), /RESERVATION_FENCED_OFF/);
  assert.equal(db.prepare('SELECT last_committed_epoch FROM repository_fence').get().last_committed_epoch, 1);
});

test('C2-3 continuing process explicitly recovers committed bytes and reaps abandoned leases', async t => {
  const f = fixture(t); f.store.append(f.owner, f.repo, 'committed');
  const child = fork(new URL('./fixtures/maintenance-worker.js', import.meta.url), [f.root, f.owner, f.repo, 'crash'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => child.kill()); await once(child, 'message');
  const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 1);
  // This is the same store/process, not constructor/startup recovery.
  assert.equal(f.store.reconcileQuota(), 24);
  const receipt = f.store.repoDatabase(f.owner, f.repo).prepare('SELECT last_committed_epoch,reservation_id FROM repository_fence').get();
  assert.equal(receipt.last_committed_epoch, 2, 'crashed writer committed its epoch with evidence');
  assert.ok(receipt.reservation_id);
  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0);
  const now = Date.now();
  f.store.registry.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?)').run('abandoned', f.repo, process.pid, hostname(), now - 1000, now - 1, 100000, f.owner);
  assert.equal(f.store.reconcileQuota(), 24);
  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0);
  assert.equal(f.store.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(f.repo).evidence_bytes, 24);
});

for (const fenceMode of ['reap', 'replace-token']) {
test(`B2 repo.sqlite async ${fenceMode} overlaps an in-flight worker`, async t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  f.store.append(f.owner, f.repo, 'first');
  const path = fs.realpathSync(f.store.databaseFiles().find(path => path.endsWith('repo.sqlite')));
  const release = join(f.root, 'release-worker');
  const worker = fork(new URL('./fixtures/fencing-overlap-worker.js', import.meta.url), [f.root, f.owner, f.repo, release], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  t.after(() => worker.kill());
  const workerExit = once(worker, 'exit');
  const [ready] = await once(worker, 'message');
  assert.equal(ready.file, path, 'worker opened the exact on-disk repository sqlite');
  assert.equal(worker.exitCode, null, 'worker remains in flight during reaping');
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { realpathSync } from 'node:fs';
    import { ContextStore } from './dist/context/store.js';
    const reaper = new ContextStore(${JSON.stringify(f.root)});
    try {
      const db = reaper.repoDatabase(${JSON.stringify(f.owner)}, ${JSON.stringify(f.repo)});
      const file = db.prepare('PRAGMA database_list').all().find(row => row.name === 'main').file;
      assert.equal(realpathSync(file), ${JSON.stringify(path)});
      if (${JSON.stringify(fenceMode)} === 'reap') {
        reaper.registry.prepare('UPDATE reservations SET expires_at=0').run();
        reaper.reconcileQuota();
      } else {
        db.prepare("UPDATE fencing_state SET active_reservation_id='other-token'").run();
      }
    } finally { reaper.close(); }
  `], { cwd: new URL('../../', import.meta.url), stdio: ['ignore', 'ignore', 'pipe'] });
  t.after(() => child.kill());
  let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, stderr);
  assert.equal(worker.exitCode, null, 'reaper completed while worker was still paused');
  assert.equal(db.prepare('SELECT authoritative_epoch FROM fencing_state').get().authoritative_epoch, ready.epoch + (fenceMode === 'reap' ? 1 : 0));
  writeFileSync(release, 'resume');
  const [workerCode] = await workerExit;
  assert.equal(workerCode, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 1);
});

}

test('B2 equal epoch with wrong reservation id is fenced off', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  assert.throws(() => f.store.quotaWrite(f.owner, f.repo, 100000, () => {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("UPDATE fencing_state SET active_reservation_id='other-token'").run();
      f.store.commitRepository(db);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }), /RESERVATION_FENCED_OFF/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 0);
});

test('B2 registry epoch cache cannot define repository authority', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  f.store.quotaWrite(f.owner, f.repo, 100000, () => {
    f.store.registry.prepare('UPDATE epoch_counter SET epoch=999 WHERE repo_uuid=?').run(f.repo);
    db.exec('BEGIN IMMEDIATE');
    f.store.commitRepository(db);
  });
  assert.equal(db.prepare('SELECT last_committed_epoch FROM repository_fence').get().last_committed_epoch, 1);
  assert.equal(db.prepare('SELECT authoritative_epoch FROM fencing_state').get().authoritative_epoch, 1);
});

function approvalFixture(t, patch = {}) {
  const f = fixture(t), configDirectory = join(f.root, 'config'); mkdirSync(configDirectory);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  // Isolated positive-control crypto substitution, no production key override.
  const original = crypto.createPublicKey;
  crypto.createPublicKey = () => publicKey;
  syncBuiltinESMExports();
  t.after(() => { crypto.createPublicKey = original; syncBuiltinESMExports(); });
  const payload = { expires_at: Date.now() + 60000, features: ['FEATURE_LIVE_CAPTURE'], schema_version: 1, ...patch };
  const artifact = { ...payload, signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64') };
  const path = join(configDirectory, 'soc-approval.json');
  writeFileSync(path, JSON.stringify(artifact));
  writeFileSync(join(configDirectory, 'revoked-approvals.json'), '[]');
  return { ...f, configDirectory, artifact, path };
}

function moduleConfig(t, configDirectory) {
  const installed = fileURLToPath(new URL('../../config/', import.meta.url));
  const originals = { statSync: fs.statSync, readFileSync: fs.readFileSync };
  for (const name of Object.keys(originals)) fs[name] = (path, ...args) => {
    const mapped = typeof path === 'string' && path.startsWith(installed) ? join(configDirectory, path.slice(installed.length)) : path;
    return originals[name](mapped, ...args);
  };
  syncBuiltinESMExports();
  t.after(() => { Object.assign(fs, originals); syncBuiltinESMExports(); });
}

for (const revoked of [{ revoked: true }, 'invalid', { schema_version: 1, revoked_digests: [] }]) {
  test(`C1 valid JSON non-array revocation source fails closed: ${JSON.stringify(revoked)}`, t => {
    const f = approvalFixture(t);
    moduleConfig(t, f.configDirectory);
    assert.equal(isFeatureAuthorized('FEATURE_LIVE_CAPTURE'), true, 'valid array control');
    writeFileSync(join(f.configDirectory, 'revoked-approvals.json'), JSON.stringify(revoked));
    assert.throws(() => requireFeatureAuthorized('FEATURE_LIVE_CAPTURE', f.configDirectory), /^Error: FEATURE_GATE_LOCKED: revocation list malformed$/);
  });
}

for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY']) {
  test(`C2 ContextService ignores caller-supplied configDirectory for ${feature}`, t => {
    const f = approvalFixture(t, { features: [feature] });
    assert.equal(isFeatureAuthorized(feature, f.configDirectory), false, 'caller directory cannot override the installed config');
    assert.throws(() => new ContextService(f.store, { configDirectory: f.configDirectory, [feature]: true }), /FEATURE_GATE_LOCKED/);
    const service = new ContextService(f.store, { configDirectory: f.configDirectory });
    assert.throws(() => service.executeFeature(feature, () => assert.fail('caller override ran')), /FEATURE_GATE_LOCKED/);
  });
}

test('R2 missing revocation file fails closed with FEATURE_GATE_LOCKED', t => {
  const f = approvalFixture(t);
  moduleConfig(t, f.configDirectory);
  writeFileSync(join(f.configDirectory, 'revoked-approvals.json'), '[]');
  assert.equal(isFeatureAuthorized('FEATURE_LIVE_CAPTURE', f.configDirectory), true);
  fs.unlinkSync(join(f.configDirectory, 'revoked-approvals.json'));
  assert.equal(isFeatureAuthorized('FEATURE_LIVE_CAPTURE', f.configDirectory), false);
  assert.throws(() => requireFeatureAuthorized('FEATURE_LIVE_CAPTURE', f.configDirectory), /^Error: FEATURE_GATE_LOCKED: revocation list missing or unreadable$/);
});

test('R2 different working directory still resolves the module config directory securely', t => {
  const f = approvalFixture(t);
  writeFileSync(join(f.configDirectory, 'revoked-approvals.json'), '[]');
  const cwd = process.cwd(), originalStat = fs.statSync, observed = [];
  fs.statSync = (...args) => { observed.push(args[0]); return originalStat(...args); };
  syncBuiltinESMExports();
  try {
    process.chdir(f.root);
    assert.equal(isFeatureAuthorized('FEATURE_LIVE_CAPTURE'), false, 'cwd approval cannot authorize the installed module');
    assert.equal(observed[0], fileURLToPath(new URL('../../config/soc-approval.json', import.meta.url)));
  } finally {
    process.chdir(cwd);
    fs.statSync = originalStat; syncBuiltinESMExports();
  }
});

for (const [module, entry] of [['capture', 'executeLiveCapture'], ['gateway', 'executePublicGateway']]) {
  test(`R2 public ${module} entry ignores caller-supplied config directory`, async t => {
    const f = approvalFixture(t, { features: ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'] });
    writeFileSync(join(f.configDirectory, 'revoked-approvals.json'), '[]');
    const api = await import(`../../dist/context/${module}.js`);
    assert.throws(() => api[entry](() => assert.fail('caller configuration authorized action'), f.configDirectory), /FEATURE_GATE_LOCKED/);
  });
}

test('R3 initialized service with enabled flags rejects execution after signed approval is removed', t => {
  const f = approvalFixture(t, { features: ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'] });
  writeFileSync(join(f.configDirectory, 'revoked-approvals.json'), '[]');
  moduleConfig(t, f.configDirectory);
  const service = new ContextService(f.store, { FEATURE_LIVE_CAPTURE: true, FEATURE_PUBLIC_GATEWAY: true });
  for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY']) assert.equal(service.executeFeature(feature, () => 'approved'), 'approved');
  fs.unlinkSync(f.path);
  for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY']) {
    assert.throws(() => service.executeFeature(feature, () => assert.fail('initialized but unauthorized action ran')), /FEATURE_GATE_LOCKED/);
  }
});

test('B3 tampered SOC signature is rejected', t => {
  const f = approvalFixture(t);
  moduleConfig(t, f.configDirectory);
  assert.equal(isFeatureAuthorized('FEATURE_LIVE_CAPTURE', f.configDirectory), true, 'valid control');
  writeFileSync(f.path, JSON.stringify({ ...f.artifact, signature: Buffer.alloc(64).toString('base64') }));
  assert.equal(isFeatureAuthorized('FEATURE_LIVE_CAPTURE', f.configDirectory), false);
});

test('B3 expired signed SOC artifact is rejected', t => {
  const f = approvalFixture(t, { expires_at: Date.now() - 1 });
  assert.equal(isFeatureAuthorized('FEATURE_LIVE_CAPTURE', f.configDirectory), false);
});

test('B3 Phase 7 approval cannot authorize Phase 8 gateway', t => {
  const f = approvalFixture(t);
  assert.equal(isFeatureAuthorized('FEATURE_PUBLIC_GATEWAY', f.configDirectory), false);
});

test('B3 forced env/config flag and caller key cannot bypass invalid approval', t => {
  const f = approvalFixture(t);
  writeFileSync(f.path, '{}');
  const previous = process.env.FEATURE_PUBLIC_GATEWAY;
  process.env.FEATURE_PUBLIC_GATEWAY = 'true';
  try {
    assert.throws(() => new ContextService(f.store, { configDirectory: f.configDirectory, FEATURE_PUBLIC_GATEWAY: true, socApprovalPublicKey: 'attacker' }), /FEATURE_GATE_LOCKED/);
  } finally { if (previous === undefined) delete process.env.FEATURE_PUBLIC_GATEWAY; else process.env.FEATURE_PUBLIC_GATEWAY = previous; }
});

for (const module of ['capture', 'gateway']) test(`B3 direct ${module} import is initialization-gated`, async () => {
  const api = await import(`../../dist/context/${module}.js`);
  assert.throws(() => api[module === 'capture' ? 'executeLiveCapture' : 'executePublicGateway'](() => assert.fail('unauthorized action')), /FEATURE_GATE_LOCKED/);
});

test('quota rejection bursts create one deduplicated gap per minute', t => {
  const f = fixture(t); f.store.configureQuota({ repo_bytes: 0 });
  for (let i = 0; i < 30; i++) assert.throws(() => f.store.append(f.owner, f.repo, 'rejected'), /QUOTA_EXCEEDED/);
  assert.equal(f.store.quotaGaps(f.owner), 1);
});

test('graph neighbor SQL fetch is bounded by remaining examined-edge budget plus one', () => {
  const source = readFileSync(new URL('../../src/context/graph.ts', import.meta.url), 'utf8');
  assert.match(source, /ORDER BY edge_id LIMIT \?/);
  assert.match(source, /statement\.all\(current\.node_id, '', edges - result\.examined_edges \+ 1\)/);
});

test('graph path cannot traverse a purged intermediate node', t => {
  const f = fixture(t), service = new ContextService(f.store);
  const refs = ['A', 'B', 'C'].map(x => f.store.append(f.owner, f.repo, x));
  service.sync(f.owner, f.repo);
  const db = f.store.repoDatabase(f.owner, f.repo);
  const nodes = refs.map(ref => db.prepare("SELECT node_id FROM activity_nodes WHERE kind='event' AND evidence_ref=?").get(ref).node_id);
  db.prepare('INSERT INTO activity_edges VALUES(?,?,?,?,?)').run('a'.repeat(48), nodes[0], nodes[1], 'mentions', refs[0]);
  db.prepare('INSERT INTO activity_edges VALUES(?,?,?,?,?)').run('b'.repeat(48), nodes[1], nodes[2], 'mentions', refs[2]);
  const options = { refs: [refs[0]], target: refs[2], action: 'path', direction: 'out', wall_ms: 100 };
  assert.equal(service.graph(f.owner, f.repo, options).path.length, 3);
  db.prepare("UPDATE evidence SET retention_state='expired',text='',retained_bytes=0 WHERE ref=?").run(refs[1]);
  assert.deepEqual(service.graph(f.owner, f.repo, options).path, []);
});
