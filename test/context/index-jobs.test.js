import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { temporary } from './helpers.js';

test('scoped foreground jobs reject overlap, cancel safely and keep sync idempotent', t => {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('jobs-owner'), repo = store.repository(owner, 'jobs-repo');
  const other = store.repository(owner, 'other-repo'), service = new ContextService(store);
  store.append(owner, repo, 'pending');
  const job = service.startJob(owner, repo, 'sync');
  assert.throws(() => service.sync(owner, repo), /BUSY/);
  assert.throws(() => service.cancel(owner, other, job), /ACCESS_DENIED/);
  assert.equal(service.cancel(owner, repo, job).state, 'cancelled');
  assert.equal(service.status(owner, repo).active_jobs.length, 0);
  assert.equal(service.sync(owner, repo).indexed, 1);
  const generation = service.status(owner, repo).index.generation;
  assert.equal(service.sync(owner, repo).indexed, 0);
  assert.equal(service.status(owner, repo).index.generation, generation);
  assert.throws(() => service.cancel(owner, repo, job), /ACCESS_DENIED/);
});

test('startup, read, search, graph, status and idle never materialize pending evidence', async t => {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('readonly-owner'), repo = store.repository(owner, 'readonly-repo');
  const service = new ContextService(store), ref = store.append(owner, repo, 'indexed');
  service.sync(owner, repo);
  store.append(owner, repo, 'pending');
  const db = store.repoDatabase(owner, repo);
  const before = db.prepare('SELECT count(*) AS n FROM activity_nodes').get().n;
  service.read(owner, repo, { refs: [ref] }); service.search(owner, repo, { query: 'indexed' });
  service.graph(owner, repo, { refs: [ref] }); service.status(owner, repo);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(db.prepare('SELECT count(*) AS n FROM activity_nodes').get().n, before);
  assert.equal(service.status(owner, repo).index.pending_events, 1);
});
