import test from 'node:test';
import assert from 'node:assert/strict';
import { hostname } from 'node:os';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { ContextStore } from '../../dist/context/store.js';
import { temporary } from './helpers.js';

test('R2 reconciliation preserves living leases and removes dead or expired leases', t => {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('lease'), repo = store.repository(owner, 'lease');
  const insert = store.registry.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?)');
  const now = Date.now();
  insert.run('living', repo, process.pid, hostname(), now, now + 60000, 100, owner);
  insert.run('dead', repo, 2147483647, hostname(), now, now + 60000, 100, owner);
  insert.run('expired', repo, process.pid, hostname(), now - 60000, now - 1, 100, owner);
  store.reconcileQuota();
  assert.deepEqual(store.registry.prepare('SELECT reservation_id FROM reservations').all().map(x => x.reservation_id), ['living']);
});

test('R2 commit-to-registry worker keeps registry lock until finalization or PID death', async t => {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('window'), repo = store.repository(owner, 'window');
  const worker = fork(new URL('./fixtures/maintenance-worker.js', import.meta.url), [root, owner, repo, 'lease-window'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => worker.kill());
  await once(worker, 'message');
  store.registry.exec('PRAGMA busy_timeout=20');
  assert.throws(() => store.reconcileQuota(), /locked/);
  const exited = once(worker, 'exit'); worker.kill('SIGKILL'); await exited;
  assert.equal(store.reconcileQuota(), 12);
  assert.equal(store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0);
});

test('B1 secure_delete is enabled on writable, read, registry, unscoped and CLI-style connections', t => {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('secure'), repo = store.repository(owner, 'secure');
  const check = db => assert.equal(db.prepare('PRAGMA secure_delete').get().secure_delete, 1);
  check(store.registry); check(store.repoDatabase(owner, repo)); check(store.unscopedDatabase(owner));
  store.withReadDatabase(owner, repo, check);
  const reader = new ContextStore(root, { readOnly: true });
  try { check(reader.registry); reader.withReadDatabase(owner, repo, check); } finally { reader.close(); }
});
