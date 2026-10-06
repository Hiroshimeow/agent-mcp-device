import test from 'node:test';
import assert from 'node:assert/strict';
import { runContextBenchmarks } from '../scenarios/context.mjs';

test('context benchmarks verify nonzero work for all five workloads', async () => {
  const rows = await runContextBenchmarks({ samples: 1, count: 12 });
  assert.deepEqual(rows.map(row => row.scenario), ['context.capture', 'context.sync', 'context.search', 'context.activity', 'context.contention']);
  for (const row of rows) {
    assert.equal(row.valid, true, row.error);
    assert.ok(row.assertions.length > 0);
    assert.ok(row.hostname && row.node_version && row.harness_commit);
    assert.ok(Object.values(row.metrics).some(value => value > 0));
  }
  assert.ok(rows.find(row => row.scenario === 'context.activity').metrics.examined_edges > 0);
  assert.equal(rows.find(row => row.scenario === 'context.contention').metrics.executions, 1);
});
