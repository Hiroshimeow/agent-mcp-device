import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { temporary } from './helpers.js';

function fixture(t, count = 6) {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('query-owner'), repo = store.repository(owner, 'query-repo');
  const service = new ContextService(store);
  const refs = Array.from({ length: count }, (_, i) => store.append(owner, repo, JSON.stringify({ toolName: 'read_file', arguments: { path: 'hub.ts' }, session_ref: `session-${i}` })));
  service.sync(owner, repo);
  return { store, owner, repo, service, refs };
}

test('high-degree traversal enforces examined, visited, node, depth and aggregate byte caps', t => {
  const f = fixture(t, 40);
  for (const options of [{ max_edges: 3 }, { max_nodes: 2 }, { max_visited: 2 }, { max_bytes: 2048 }]) {
    const result = f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], wall_ms: 100, ...options });
    assert.equal(result.partial, true);
    assert.ok(result.examined_edges <= (options.max_edges ?? 500));
    assert.ok(result.nodes.length <= (options.max_nodes ?? 50));
    assert.ok(result.visited_nodes <= (options.max_visited ?? 200));
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= (options.max_bytes ?? 65536));
    assert.ok(result.truncated_by.length);
  }
  for (const max_hops of [0, 1, 2, 3]) {
    const result = f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], max_hops, wall_ms: 100 });
    assert.ok(result.nodes.every(n => n.depth <= max_hops));
    assert.equal(new Set(result.nodes.map(n => n.node_id)).size, result.nodes.length);
    assert.ok(result.examined_edges <= 500);
  }
  for (const options of [{ max_hops: 4 }, { max_nodes: 101 }, { max_edges: 2001 }, { wall_ms: 101 }, { max_bytes: 131073 }]) {
    assert.throws(() => f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], ...options }), /BUDGET_EXCEEDED/);
  }
});

test('cycles terminate and path, direction, relation filtering and timeline are deterministic', t => {
  const f = fixture(t);
  const first = f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], wall_ms: 100 });
  const eventNodes = first.nodes.filter(n => n.kind === 'event');
  assert.ok(eventNodes.length > 1);
  const db = f.store.repoDatabase(f.owner, f.repo);
  db.prepare('INSERT INTO activity_edges VALUES(?,?,?,?,?)').run('f'.repeat(48), eventNodes[1].node_id, eventNodes[0].node_id, 'mentions', f.refs[1]);
  const cycle = f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], max_hops: 3, wall_ms: 100 });
  assert.equal(new Set(cycle.nodes.map(n => n.node_id)).size, cycle.nodes.length);
  assert.ok(cycle.examined_edges < 100);
  const path = f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], action: 'path', target: f.refs[1], wall_ms: 100 });
  assert.equal(path.path[0], eventNodes[0].node_id);
  assert.ok(path.path.length >= 2);
  const out = f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], direction: 'out', relations: ['read_from'], wall_ms: 100 });
  assert.equal(out.edges.length, 1);
  assert.equal(out.edges[0].relation, 'read_from');
  const timeline = () => f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], action: 'timeline', wall_ms: 100 });
  assert.deepEqual(timeline(), timeline());
});

test('generation, retention, repository and sealed-owner boundaries are enforced before graph lookup', t => {
  const f = fixture(t, 2);
  const generation = f.service.status(f.owner, f.repo).index.generation;
  const late = f.store.append(f.owner, f.repo, JSON.stringify({ toolName: 'edit_file', arguments: { path: 'hub.ts' }, status: 'succeeded' }));
  assert.throws(() => f.service.graph(f.owner, f.repo, { refs: [late] }), /REF_NOT_FOUND/);
  f.service.sync(f.owner, f.repo);
  const pinned = f.service.graph(f.owner, f.repo, { refs: [f.refs[0]], generation, wall_ms: 100 });
  assert.ok(!pinned.edges.some(e => e.evidence_ref === late));
  const other = f.store.repository(f.owner, 'another-repo');
  f.store.append(f.owner, other, 'other scope'); f.service.sync(f.owner, other);
  assert.throws(() => f.service.graph(f.owner, other, { refs: [f.refs[0]] }), /REF_NOT_FOUND/);
  f.store.repoDatabase(f.owner, f.repo).prepare("UPDATE evidence SET retention_state='purged',text='' WHERE ref=?").run(f.refs[0]);
  assert.throws(() => f.service.graph(f.owner, f.repo, { refs: [f.refs[0]] }), /REF_NOT_FOUND/);
  const retained = f.service.graph(f.owner, f.repo, { refs: [late], wall_ms: 100 });
  assert.ok(!retained.edges.some(e => e.evidence_ref === f.refs[0]));
  f.store.activateOwner('repaired');
  assert.throws(() => f.service.graph(f.owner, f.repo, { refs: [late] }), /ACCESS_DENIED/);
});
