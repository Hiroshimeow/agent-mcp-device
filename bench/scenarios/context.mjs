import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { approvalFixture } from '../../test/context/fixtures/capture-approval.js';
import { captureEnvironment, runMeasuredSample, writeJsonl, summarizeRaw } from '../../.archive-worktrees-docs/wt-mcp-device-110-bench/bench/lib/core.mjs';

// Reuse the accepted correctness collector, sample format and environment identity.
// Authorization uses an isolated throwaway test key; no installed approval is changed.
export async function runContextBenchmarks({ samples = 3, count = 40 } = {}) {
  if (!Number.isInteger(samples) || samples < 1 || samples > 20 || !Number.isInteger(count) || count < 2 || count > 200) throw new Error('Invalid benchmark bounds');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const environment = await captureEnvironment(root, 'context-local');
  const rows = [];
  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
    const cleanup = [];
    const f = approvalFixture({ after: fn => cleanup.push(fn) });
    const refs = [];
    const measure = async (name, fn) => {
      const cpu = process.cpuUsage(), rss = process.memoryUsage().rss;
      const row = await runMeasuredSample({ environment, profile: 'context', scenario: `context.${name}`,
        parameters: { count, authorization: 'isolated-test-fixture' }, warmup: false, sampleIndex, fn });
      const used = process.cpuUsage(cpu);
      Object.assign(row, { cpu_user_us: used.user, cpu_system_us: used.system,
        rss_before_bytes: rss, rss_after_bytes: process.memoryUsage().rss,
        rss_peak_bytes: process.resourceUsage().maxRSS * 1024, resource_pid: process.pid,
        instrumented: true, resource_attribution: 'same-process CPU delta; process-lifetime RSS high-water mark, not per-scenario peak' });
      rows.push(row);
    };
    try {
      await measure('capture', async ({ assertions: a }) => {
        let executions = 0;
        for (let i = 0; i < count; i++) await f.observer.execute({ tool: 'read_file', args: { path: 'hub.ts' } }, () => {
          executions++; return `benchmarkmarker item ${i}`;
        });
        const events = f.store.repoDatabase(f.owner, f.repo).prepare('SELECT * FROM events').all();
        refs.push(...events.map(event => event.payload_ref));
        a.equal('side effects execute exactly once', executions, count);
        a.equal('one durable outcome per invocation', events.filter(event => event.execution_status === 'succeeded' && event.payload_ref).length, count);
        return { metrics: { executions, durable_events: events.length } };
      });
      await measure('sync', ({ assertions: a }) => {
        const result = f.service.sync(f.owner, f.repo);
        a.equal('all captured events indexed', result.indexed, count);
        a.equal('no pending events', result.index.pending_events, 0);
        a.equal('incremental no-op does no indexing', f.service.sync(f.owner, f.repo).indexed, 0);
        return { metrics: { indexed_events: result.indexed, fts_documents: result.index.fts_documents } };
      });
      await measure('search', ({ assertions: a }) => {
        const result = f.service.search(f.owner, f.repo, { query: 'benchmarkmarker', limit: 50 });
        a.equal('expected result count', result.items.length, Math.min(count, 50));
        a.ok('all returned refs are captured evidence', result.items.every(item => refs.includes(item.ref)));
        const other = f.store.repository(f.owner, 'other-scope');
        f.store.append(f.owner, other, 'benchmarkmarker unauthorized-canary'); f.service.sync(f.owner, other);
        a.ok('cross-scope canary excluded', f.service.search(f.owner, f.repo, { query: 'unauthorized-canary' }).items.length === 0);
        return { response_bytes: Buffer.byteLength(JSON.stringify(result)), metrics: { queries: 2, returned_hits: result.items.length, corpus_events: count } };
      });
      await measure('activity', ({ assertions: a }) => {
        // Imported activity refs use the graph's 48-hex contract. Captured UUID
        // payload refs are measured above, not silently coerced into graph refs.
        const activityRefs = Array.from({ length: count }, (_, i) => f.store.append(f.owner, f.repo,
          JSON.stringify({ toolName: 'read_file', arguments: { path: 'activity-hub.ts' }, session_ref: `bench-${i}` })));
        f.service.sync(f.owner, f.repo);
        const result = f.service.graph(f.owner, f.repo, { refs: [activityRefs[0]], max_hops: 2, wall_ms: 100 });
        a.ok('representative nonzero-degree traversal', result.examined_edges > 0 && result.edges.length > 0);
        a.ok('edge evidence belongs to captured corpus', result.edges.every(edge => activityRefs.includes(edge.evidence_ref)));
        a.ok('bounded examined and visited work', result.examined_edges <= 500 && result.visited_nodes <= 200);
        return { response_bytes: Buffer.byteLength(JSON.stringify(result)), metrics: { examined_edges: result.examined_edges, visited_nodes: result.visited_nodes, returned_edges: result.edges.length } };
      });
      await measure('contention', async ({ assertions: a }) => {
        const lock = new DatabaseSync(join(f.root, 'context', 'owners', f.owner, 'repos', f.repo, 'repo.sqlite'));
        let executions = 0;
        try {
          lock.exec('BEGIN IMMEDIATE');
          const before = f.service.status(f.owner, f.repo).capture_health.in_memory_gaps;
          const result = await f.observer.execute({ tool: 'write_file', args: {} }, () => { executions++; return 'done'; });
          a.equal('execution is not replayed under lock', executions, 1);
          a.equal('side-effect result preserved', result, 'done');
          a.equal('capture gap visible', f.service.status(f.owner, f.repo).capture_health.in_memory_gaps, before + 1);
          return { metrics: { executions, locked_writes: 1, capture_gaps: 1 } };
        } finally { if (lock.isTransaction) lock.exec('ROLLBACK'); lock.close(); }
      });
    } finally { for (const fn of cleanup) fn(); }
  }
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output) throw new Error('Usage: node bench/scenarios/context.mjs <new-output.jsonl>');
  const { existsSync, writeFileSync } = await import('node:fs');
  if (existsSync(output)) throw new Error('Refusing to overwrite raw evidence');
  const rows = await runContextBenchmarks();
  await writeJsonl(output, rows);
  writeFileSync(`${output}.summary.json`, JSON.stringify(await summarizeRaw(output), null, 2) + '\n');
  if (rows.some(row => !row.valid)) process.exitCode = 1;
}
