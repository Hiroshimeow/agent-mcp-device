import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  percentile,
  summarizeValues,
  responseBytes,
  consolidateRawFiles,
  summarizeRaw,
  createAssertionCollector,
} from '../lib/core.mjs';

assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
assert.equal(percentile([1, 2, 3, 4, 5], 0.95), 5);
assert.deepEqual(summarizeValues([4, 1, 3, 2]), {
  count: 4,
  min: 1,
  median: 2.5,
  p95: 4,
  max: 4,
});
assert.equal(
  responseBytes({ content: [{ type: 'text', text: 'abc' }] }),
  Buffer.byteLength(JSON.stringify({ content: [{ type: 'text', text: 'abc' }] }), 'utf8')
);

const checks = createAssertionCollector();
checks.equal('same', 2, 2);
checks.ok('truthy', true, { expected: true, actual: true });
assert.equal(checks.items.length, 2);
assert.throws(() => checks.equal('mismatch', 2, 3), /mismatch/);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-bench-core-'));
try {
  await fs.writeFile(path.join(temp, 'raw.standard.jsonl'), [
    JSON.stringify({ scenario: 'x', warmup: true, valid: true, elapsed_ms: 100, response_bytes: 10 }),
    JSON.stringify({ scenario: 'x', warmup: false, valid: true, elapsed_ms: 10, response_bytes: 20 }),
    JSON.stringify({ scenario: 'x', warmup: false, valid: true, elapsed_ms: 20, response_bytes: 30 }),
  ].join('\n') + '\n');
  await fs.writeFile(path.join(temp, 'raw.stress.jsonl'), [
    JSON.stringify({ scenario: 'x', warmup: false, valid: false, elapsed_ms: 999, response_bytes: 99, invalid_reason: 'expected' }),
    JSON.stringify({ scenario: 'y', warmup: false, valid: true, elapsed_ms: 7, response_bytes: 5, metrics: { first_ms: 3 } }),
  ].join('\n') + '\n');

  const rawPath = await consolidateRawFiles(temp);
  const raw = await fs.readFile(rawPath, 'utf8');
  assert.equal(raw.trim().split(/\r?\n/).length, 5);

  const summary = await summarizeRaw(rawPath);
  assert.equal(summary.scenarios.x.measured_count, 3);
  assert.equal(summary.scenarios.x.valid_count, 2);
  assert.equal(summary.scenarios.x.invalid_count, 1);
  assert.equal(summary.scenarios.x.elapsed_ms.median, 15);
  assert.equal(summary.scenarios.y.metrics.first_ms.median, 3);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}

console.log('bench core self-test passed');
