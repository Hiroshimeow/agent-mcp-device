import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { approvalFixture } from './fixtures/capture-approval.js';
import { callContextTool } from '../../dist/context/gateway.js';

const files = root => readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(root, entry.name)) : [join(root, entry.name)]);
test('gateway success/error/truncation/debug/metrics never persist or log context canaries', async t => {
  const f = approvalFixture(t, ['FEATURE_PUBLIC_GATEWAY']);
  const marker = 'CTX_CONTENT_CANARY_7f28e1';
  const logs = [], metrics = [];
  const originals = Object.fromEntries(['log', 'debug', 'info', 'warn', 'error'].map(key => [key, console[key]]));
  for (const key of Object.keys(originals)) console[key] = (...args) => logs.push(args);
  t.after(() => Object.assign(console, originals));
  const before = new Map(files(f.root).map(path => [path, readFileSync(path)]));
  let response;
  const route = { resolveDevice: async () => ({ owned: true, online: true, capabilities: ['local_search'], context_version: 1 }),
    forward: async () => { if (response instanceof Error) throw response; return response; }, telemetry: event => metrics.push(event) };
  for (response of [{ ok: true, items: [{ content: marker }] }, { ok: false, error: { code: 'CURSOR_INVALID' } }, { ok: true, partial: true, next_cursor: marker, coverage: { complete: false, reasons: ['bytes'] } }, new Error(marker)]) {
    const result = await callContextTool('local_search', { device_id: 'd', cwd: '/repo', query: marker }, route, 'read');
    if (response instanceof Error) assert.deepEqual(result, { ok: false, error: { code: 'INTERNAL_ERROR' } });
    else assert.deepEqual(result, response);
  }
  assert.equal(logs.length, 0);
  assert.equal(metrics.length, 4);
  assert.ok(!JSON.stringify(metrics).includes(marker));
  assert.deepEqual(files(f.root), [...before.keys()]);
  for (const [path, bytes] of before) assert.deepEqual(readFileSync(path), bytes);
  const source = readFileSync(new URL('../../src/context/gateway.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"].*(?:store|search|service|sqlite|fs)|new Map|writeFile|console\./);
});
