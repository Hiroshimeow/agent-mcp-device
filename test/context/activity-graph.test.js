import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { temporary } from './helpers.js';

export function fixture(t) {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('graph-owner'), repo = store.repository(owner, 'graph-repo');
  return { store, owner, repo, service: new ContextService(store) };
}
export function record(f, toolName, extra = {}) {
  return f.store.append(f.owner, f.repo, JSON.stringify({ toolName, arguments: { path: 'src/a.ts' }, status: 'succeeded', session_ref: 'session-a', ...extra }));
}

test('explicit sync constructs directed evidence-backed relations without causal inference', t => {
  const f = fixture(t);
  const refs = ['read_file', 'edit_file', 'edit_file', 'edit_file', 'start_process', 'read_process_output', 'test_run', 'checkpoint'].map((tool, i) => record(f, tool, {
    ...(i === 2 ? { status: 'failed' } : {}), ...(i === 3 ? { dry_run: true } : {}),
    ...(i === 4 || i === 5 ? { process_ref: 'execution-uuid' } : {}),
    ...(i === 6 ? { arguments: { command: 'node --test' } } : {}),
  }));
  assert.equal(f.store.repoDatabase(f.owner, f.repo).prepare('SELECT count(*) AS n FROM activity_edges').get().n, 0);
  f.service.sync(f.owner, f.repo);
  const edges = f.store.repoDatabase(f.owner, f.repo).prepare('SELECT * FROM activity_edges').all();
  for (const [i, relation] of [[0, 'read_from'], [1, 'edit_succeeded'], [2, 'attempted'], [3, 'attempted'], [4, 'started_process'], [5, 'observed_output']]) {
    assert.ok(edges.some(e => e.evidence_ref === refs[i] && e.relation === relation));
  }
  assert.ok(!edges.some(e => ['caused_by', 'fixes'].includes(e.relation)));
  assert.ok(!edges.some(e => refs.slice(2, 4).includes(e.evidence_ref) && e.relation === 'edit_succeeded'));
  const count = edges.length;
  f.service.sync(f.owner, f.repo); f.service.rebuild(f.owner, f.repo);
  assert.equal(f.store.repoDatabase(f.owner, f.repo).prepare('SELECT count(*) AS n FROM activity_edges').get().n, count);
  const graph = f.service.graph(f.owner, f.repo, { refs: [refs[0]], max_hops: 2 });
  assert.ok(graph.edges.length > 0);
  assert.ok(graph.nodes.every(n => n.depth <= 2));
  assert.ok(graph.edges.every(e => refs.includes(e.evidence_ref)));
});

test('graph shares opaque entity identities but never persists metadata secrets', t => {
  const f = fixture(t);
  const ref = record(f, 'read_file');
  record(f, 'read_file', { arguments: { path: 'src/a.ts', password: 'graph-secret-canary' } });
  record(f, 'edit_file'); f.service.sync(f.owner, f.repo);
  const graph = f.service.graph(f.owner, f.repo, { refs: [ref] });
  assert.equal(graph.nodes.filter(n => n.kind === 'file').length, 1);
  assert.doesNotMatch(JSON.stringify(graph), /graph-secret-canary|session-a|src\/a.ts/);
  assert.ok(f.store.accountedBytes() > 0);
  f.store.configureQuota({ repo_bytes: 1, metadata_reserve_bytes: 0 });
  // Query-only operations remain available at quota saturation.
  assert.ok(f.service.graph(f.owner, f.repo, { refs: [ref] }).nodes.length);
  assert.throws(() => f.service.rebuild(f.owner, f.repo), /QUOTA_EXCEEDED/);
});
