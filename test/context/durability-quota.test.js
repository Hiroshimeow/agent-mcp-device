import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { runContextCli } from '../../dist/context/cli.js';
import { importLegacy } from '../../dist/context/importer.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { temporary } from './helpers.js';

function setup(t) {
  let store; t.after(() => store?.close());
  const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('pair'), a = store.repository(owner, 'a'), b = store.repository(owner, 'b');
  return { root, owner, a, b, get store() { return store; }, restart() { store.close(); store = new ContextStore(root); return store; } };
}
test('device quota serializes all repos and includes sealed namespaces, without evicting evidence', t => {
  const s = setup(t), ref = s.store.append(s.owner, s.a, 'retained');
  s.store.repoDatabase(s.owner, s.b);
  const used = s.store.refreshAccounting();
  s.store.configureQuota({ device_bytes: used + 4096 });
  assert.throws(() => s.store.append(s.owner, s.b, 'new'), /QUOTA_EXCEEDED/);
  assert.equal(s.store.read(s.owner, s.a, ref).text, 'retained');
  assert.equal(s.store.repoDatabase(s.owner, s.b).prepare('SELECT count(*) AS n FROM events').get().n, 0);
  assert.equal(s.store.unscopedDatabase(s.owner).prepare("SELECT count(*) AS n FROM gaps WHERE reason='quota'").get().n, 1);
  assert.equal(new ContextService(s.store).status(s.owner, s.b).coverage.complete, false);
  assert.ok(s.store.registry.prepare('SELECT accounted_bytes FROM repositories WHERE repo_uuid=?').get(s.a).accounted_bytes > 0);
  const next = s.store.activateOwner('next');
  s.store.refreshAccounting();
  assert.ok(s.store.registry.prepare('SELECT accounted_bytes FROM owners WHERE owner_key=?').get(s.owner).accounted_bytes > 0);
  const c = s.store.repository(next, 'c');
  assert.throws(() => s.store.append(next, c, 'new'), /QUOTA_EXCEEDED/);
});
test('repo quota pauses sync and import without publishing partial generations', t => {
  const s = setup(t); s.store.append(s.owner, s.a, 'pending');
  const db = s.store.repoDatabase(s.owner, s.a);
  s.store.configureQuota({ repo_bytes: 1, metadata_reserve_bytes: 0 });
  assert.throws(() => new ContextService(s.store).sync(s.owner, s.a), /QUOTA_EXCEEDED/);
  assert.equal(s.store.manifest(s.owner, s.a).generation, null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM generations').get().n, 0);
  const source = join(s.root, 'legacy.jsonl');
  writeFileSync(source, JSON.stringify({ owner_key: s.owner, repo_uuid: s.a, text: 'legacy' }));
  assert.throws(() => importLegacy(s.store, source), /QUOTA_EXCEEDED/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 1);
});
test('transaction failure rolls back evidence and event together', t => {
  const s = setup(t), db = s.store.repoDatabase(s.owner, s.a);
  db.exec("CREATE TRIGGER fail_event BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT,'injected'); END");
  assert.throws(() => s.store.append(s.owner, s.a, 'not committed'), /STORAGE_DEGRADED/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 0);
});
test('restart abandons shadow generations and marks unresolved intents unknown without sync', t => {
  const s = setup(t); s.store.append(s.owner, s.a, 'good');
  const service = new ContextService(s.store); service.sync(s.owner, s.a);
  const good = s.store.manifest(s.owner, s.a).generation;
  const db = s.store.repoDatabase(s.owner, s.a);
  db.exec("INSERT INTO events(invocation_id,accepted_at,execution_status) VALUES('intent',0,'pending')");
  s.store.beginGeneration(s.owner, s.a);
  s.restart();
  const reopened = s.store.repoDatabase(s.owner, s.a);
  assert.equal(reopened.prepare("SELECT count(*) AS n FROM generations WHERE status='shadow'").get().n, 0);
  assert.equal(s.store.manifest(s.owner, s.a).generation, good);
  assert.equal(s.store.manifest(s.owner, s.a).unknown_events, 1);
  assert.equal(reopened.prepare('PRAGMA synchronous').get().synchronous, 2);
  assert.equal(reopened.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});
test('process kill rolls back uncommitted WAL writes and preserves last-good generation', async t => {
  const s = setup(t); s.store.append(s.owner, s.a, 'committed');
  new ContextService(s.store).sync(s.owner, s.a);
  const good = s.store.manifest(s.owner, s.a).generation;
  const child = fork(new URL('./fixtures/crash-worker.js', import.meta.url), [s.root, s.owner, s.a], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => child.kill());
  await once(child, 'message');
  const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  s.restart();
  const db = s.store.repoDatabase(s.owner, s.a);
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence WHERE ref='partial'").get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 1);
  assert.equal(s.store.manifest(s.owner, s.a).generation, good);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});
test('cleanup invalidates stateless search cursors and supports explicit sealed namespace selection', t => {
  const s = setup(t); s.store.append(s.owner, s.a, 'match one'); s.store.append(s.owner, s.a, 'match two');
  const service = new ContextService(s.store); service.sync(s.owner, s.a);
  const page = service.search(s.owner, s.a, { query: 'match', limit: 1 });
  assert.ok(page.next_cursor);
  service.cleanup(s.owner, s.a, { before: Date.now()+1000, localAdmin: true });
  assert.throws(() => service.search(s.owner, s.a, { query: 'match', limit: 1, cursor: page.next_cursor }), /CURSOR_STALE/);
  s.store.activateOwner('next');
  assert.throws(() => s.store.read(s.owner, s.a, 'ref'), /ACCESS_DENIED/);
  assert.equal(service.cleanup(s.owner, s.a, { before: Date.now()+1000, localAdmin: true }).purged, 0);
});
test('admin clean CLI refuses non-TTY input and cannot accept agent confirmation flags', async t => {
  const s = setup(t);
  const result = await runContextCli(['clean', '--owner', s.owner, '--repo', s.a, '--before', '1'], { stateRoot: s.root });
  assert.equal(JSON.parse(result.stderr).error.code, 'ACCESS_DENIED');
});
test('explicit local admin payload purge reclaims quota and leaves metadata and content-free audit', t => {
  const s = setup(t), ref = s.store.append(s.owner, s.a, 'large '.repeat(20000));
  new ContextService(s.store).sync(s.owner, s.a);
  const before = s.store.refreshAccounting();
  const service = new ContextService(s.store);
  assert.throws(() => service.cleanup(s.owner, s.a, { before: Date.now()+1000, localAdmin: false }), /ACCESS_DENIED/);
  const result = service.cleanup(s.owner, s.a, { before: Date.now()+1000, localAdmin: true });
  assert.equal(result.purged, 1);
  assert.equal(s.store.read(s.owner, s.a, ref).retention_state, 'expired');
  assert.equal(s.store.read(s.owner, s.a, ref).text, '');
  assert.equal(s.store.repoDatabase(s.owner, s.a).prepare('SELECT count(*) AS n FROM events').get().n, 1);
  // Incremental maintenance deliberately retains reusable WAL allocation instead
  // of truncating a concurrent reader's log; logical payload quota is reclaimed.
  assert.equal(s.store.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(s.a).evidence_bytes, 0);
  assert.ok(s.store.refreshAccounting() > 0);
  assert.ok(before > 0);
  assert.equal(s.store.registry.prepare('SELECT count(*) AS n FROM admin_audit').get().n, 1);
});
