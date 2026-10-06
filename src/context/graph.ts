import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { DatabaseSync } from 'node:sqlite';
import { ContextStore } from './store.js';

export type ActivityKind = 'event' | 'file' | 'session' | 'process' | 'command' | 'test_run' | 'error_signature' | 'checkpoint' | 'revision';
export type ActivityRelation = 'read_from' | 'edit_succeeded' | 'write_succeeded' | 'attempted' | 'started_process' | 'observed_output' | 'mentions' | 'recorded_in' | 'checkpoint_of';
export interface ActivityNode { node_id: string; kind: ActivityKind; evidence_ref: string; depth: number; evidence_class: 'parsed' | 'reported' }
export interface ActivityEdge { edge_id: string; source: string; target: string; relation: ActivityRelation; evidence_ref: string }
export interface GraphOptions {
  refs: string[]; action?: 'neighbors' | 'path' | 'timeline' | 'related'; target?: string;
  direction?: 'out' | 'in' | 'both'; relations?: ActivityRelation[];
  max_hops?: number; max_nodes?: number; max_edges?: number; max_visited?: number; max_bytes?: number; wall_ms?: number; generation?: number;
}
const relations: ActivityRelation[] = ['read_from', 'edit_succeeded', 'write_succeeded', 'attempted', 'started_process', 'observed_output', 'mentions', 'recorded_in', 'checkpoint_of'];
const id = (...values: string[]) => createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 48);
const scalar = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 4096;

/** Only retained redacted evidence is parsed. No temporal or exit-code causal inference. */
export function materializeActivity(db: DatabaseSync, ref: string, text: string): void {
  const node = (kind: ActivityKind, key: string) => {
    const nodeId = id(kind, key);
    db.prepare('INSERT OR IGNORE INTO activity_nodes(node_id,kind,evidence_ref) VALUES(?,?,?)').run(nodeId, kind, ref);
    return nodeId;
  };
  const source = node('event', ref);
  const link = (kind: ActivityKind, key: unknown, relation: ActivityRelation) => {
    if (!scalar(key)) return;
    const target = node(kind, key);
    db.prepare('INSERT OR IGNORE INTO activity_edges(edge_id,source,target,relation,evidence_ref) VALUES(?,?,?,?,?)')
      .run(id(source, target, relation, ref), source, target, relation, ref);
  };
  let data: Record<string, unknown>;
  try { const parsed: unknown = JSON.parse(text); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return; data = parsed as Record<string, unknown>; }
  catch { return; }
  const args = data.arguments && typeof data.arguments === 'object' && !Array.isArray(data.arguments) ? data.arguments as Record<string, unknown> : {};
  const tool = typeof data.toolName === 'string' ? data.toolName : '';
  // Success must be explicit. Unknown outcomes and dry-runs never become successful edits.
  const success = data.status === 'succeeded' && data.dry_run !== true && args.dry_run !== true;
  let fileRelation: ActivityRelation = 'mentions';
  if (tool === 'read_file') fileRelation = 'read_from';
  if (tool === 'edit_file') fileRelation = success ? 'edit_succeeded' : 'attempted';
  if (tool === 'write_file') fileRelation = success ? 'write_succeeded' : 'attempted';
  link('file', args.path, fileRelation);
  link('session', data.session_ref, 'recorded_in');
  link('command', args.command, tool === 'test_run' ? 'mentions' : 'attempted');
  // Durable execution refs only: a PID alone is never process identity.
  let processRelation: ActivityRelation = 'mentions';
  if (tool === 'start_process' && success) processRelation = 'started_process';
  if (tool === 'read_process_output') processRelation = 'observed_output';
  link('process', data.process_ref, processRelation);
  link('revision', data.revision, 'recorded_in');
  link('error_signature', data.error_signature, 'mentions');
  if (tool === 'test_run') link('test_run', ref, 'mentions');
  if (data.observed && data.reported && typeof data.reported === 'object') {
    link('checkpoint', ref, 'checkpoint_of');
    const reported = data.reported as Record<string, unknown>;
    if (Array.isArray(reported.evidence_refs)) for (const other of reported.evidence_refs.slice(0, 20)) {
      if (scalar(other) && db.prepare("SELECT 1 FROM evidence WHERE ref=? AND retention_state='available'").get(other)) link('event', other, 'mentions');
    }
  }
}

function bound(value: number | undefined, fallback: number, maximum: number, minimum = 1): number {
  const n = value ?? fallback;
  if (!Number.isSafeInteger(n) || n < minimum || n > maximum) throw new Error('BUDGET_EXCEEDED');
  return n;
}

/** Deterministic BFS, with limits enforced before each adjacency fetch, not after recursion. */
export function queryActivityGraph(store: ContextStore, owner: string, repo: string, input: GraphOptions) {
  store.authorize(owner, repo);
  if (!Array.isArray(input.refs) || !input.refs.length || input.refs.length > 20 || input.refs.some(ref => !/^[a-f0-9]{48}$/.test(ref))) throw new Error('BUDGET_EXCEEDED');
  const action = input.action ?? 'neighbors', direction = input.direction ?? 'both';
  if (!['neighbors', 'path', 'timeline', 'related'].includes(action) || !['out', 'in', 'both'].includes(direction) || input.relations?.some(r => !relations.includes(r))) throw new Error('ACTION_UNSUPPORTED');
  if (action === 'path' && (!input.target || !/^[a-f0-9]{48}$/.test(input.target))) throw new Error('BUDGET_EXCEEDED');
  const hops = bound(input.max_hops, 2, 3, 0), nodes = bound(input.max_nodes, 50, 100), edges = bound(input.max_edges, 500, 2000);
  const visitedCap = bound(input.max_visited, 200, 1000), cap = bound(input.max_bytes, 65536, 131072), wall = bound(input.wall_ms, 25, 100);
  const manifest = store.inspectManifest(owner, repo);
  if (manifest.generation === null) throw new Error('INDEX_MISSING');
  const generation = input.generation ?? manifest.generation;
  if (!Number.isSafeInteger(generation) || generation < 1 || generation > manifest.generation) throw new Error('INDEX_INCOMPATIBLE');
  return store.withReadDatabase(owner, repo, db => {
    if (!db.prepare("SELECT 1 FROM generations WHERE generation_id=? AND status='published'").get(generation)) throw new Error('INDEX_INCOMPATIBLE');
    const start = performance.now();
    const result = { schema_version: 1, ok: true, scope: { repository_ref: repo },
      index: { ...manifest, generation }, coverage: { complete: manifest.unknown_events === 0, reasons: manifest.unknown_events ? ['unknown_after_restart'] : [] },
      nodes: [] as ActivityNode[], edges: [] as ActivityEdge[], partial: false, next_cursor: null,
      visited_nodes: 0, examined_edges: 0, returned_nodes: 0, truncated_by: [] as string[], path: [] as string[] };
    const stop = (reason: string) => { result.partial = true; if (!result.truncated_by.includes(reason)) result.truncated_by.push(reason); };
    const visible = db.prepare(`SELECT 1 FROM evidence p JOIN search_documents d ON d.ref=p.ref WHERE p.ref=? AND p.retention_state='available'
      AND d.first_indexed_generation<=? AND (d.deleted_generation IS NULL OR d.deleted_generation>?)`);
    const get = db.prepare('SELECT node_id,kind,evidence_ref FROM activity_nodes WHERE node_id=?');
    const resolve = (ref: string): ActivityNode | undefined => {
      const row = get.get(ref) ?? get.get(id('event', ref));
      if (!row || !visible.get(row.evidence_ref, generation, generation)) return undefined;
      return { node_id: String(row.node_id), kind: row.kind as ActivityKind, evidence_ref: String(row.evidence_ref), depth: 0,
        evidence_class: row.kind === 'checkpoint' ? 'reported' : 'parsed' };
    };
    const target = input.target ? resolve(input.target)?.node_id : undefined;
    if (input.target && !target) throw new Error('REF_NOT_FOUND');
    const seen = new Set<string>(), seenEdges = new Set<string>(), parents = new Map<string, string>();
    const queue: ActivityNode[] = [];
    const add = (node: ActivityNode) => {
      if (seen.has(node.node_id)) return true;
      if (seen.size >= visitedCap) { stop('visited_nodes'); return false; }
      if (result.nodes.length >= nodes) { stop('returned_nodes'); return false; }
      result.nodes.push(node); result.returned_nodes = result.nodes.length; result.visited_nodes = seen.size + 1;
      if (Buffer.byteLength(JSON.stringify(result)) + 256 > cap) { result.nodes.pop(); result.returned_nodes--; result.visited_nodes--; stop('response_bytes'); return false; }
      seen.add(node.node_id); queue.push(node); return true;
    };
    for (const ref of input.refs) { const seed = resolve(ref); if (!seed) throw new Error('REF_NOT_FOUND'); if (!add(seed)) break; }
    const columns = direction === 'out' ? ['source'] : direction === 'in' ? ['target'] : ['source', 'target'];
    const statements = columns.map(column => db.prepare(`SELECT * FROM activity_edges WHERE ${column}=? AND edge_id>? ORDER BY edge_id LIMIT ?`));
    let found = false;
    traversal: for (let index = 0; index < queue.length && !result.partial; index++) {
      const current = queue[index];
      if (current.node_id === target) { found = true; break; }
      if (current.depth >= hops) continue;
      for (const statement of statements) {
        if (performance.now() - start >= wall) { stop('wall_time'); break traversal; }
        // SQL bounds the fetch to the remaining examination budget plus one
        // sentinel; the sentinel is never examined or returned.
        const rows = statement.all(current.node_id, '', edges - result.examined_edges + 1);
        for (const row of rows) {
          if (performance.now() - start >= wall) { stop('wall_time'); break traversal; }
          if (result.examined_edges >= edges) { stop('examined_edges'); break traversal; }
          const after = String(row.edge_id); result.examined_edges++;
          if (seenEdges.has(after) || (input.relations && !input.relations.includes(row.relation as ActivityRelation)) || !visible.get(row.evidence_ref, generation, generation)) continue;
          const nextId = String(row.source === current.node_id ? row.target : row.source);
          const next = resolve(nextId);
          if (!next) continue;
          next.depth = current.depth + 1;
          if (!seen.has(nextId)) parents.set(nextId, current.node_id);
          if (!add(next)) break traversal;
          const edge: ActivityEdge = { edge_id: after, source: String(row.source), target: String(row.target), relation: row.relation as ActivityRelation, evidence_ref: String(row.evidence_ref) };
          result.edges.push(edge);
          if (Buffer.byteLength(JSON.stringify(result)) + 256 > cap) { result.edges.pop(); stop('response_bytes'); break traversal; }
          seenEdges.add(after);
        }
      }
    }
    if (action === 'path' && found && target) {
      let node: string | undefined = target;
      while (node) { result.path.unshift(node); node = parents.get(node); }
    }
    if (action === 'timeline') {
      const timestamp = db.prepare('SELECT timestamp FROM search_documents WHERE ref=?');
      result.nodes.sort((a, b) => Number(timestamp.get(a.evidence_ref)?.timestamp) - Number(timestamp.get(b.evidence_ref)?.timestamp) || a.node_id.localeCompare(b.node_id));
    }
    if (Buffer.byteLength(JSON.stringify(result)) > cap) throw new Error('BUDGET_EXCEEDED');
    return result;
  });
}
