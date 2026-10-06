import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { executeLiveCapture, EXCLUDED_LOCAL_TOOLS } from '../../dist/context/capture.js';
import { approvalFixture } from './fixtures/capture-approval.js';

test('T045 live capture requires signed feature authorization', () => {
  assert.throws(() => executeLiveCapture(() => assert.fail('must not run')), /FEATURE_GATE_LOCKED/);
});

test('T045 public gateway routes file/edit/shell/process/project/image/errors through exactly one observer', async t => {
  const f = approvalFixture(t);
  const source = readFileSync(new URL('../../src/device/gateway-tool-adapter.ts', import.meta.url), 'utf8');
  assert.match(source, /observePublicInvocation/);
  // Exercise the actual adapter boundary and dispatch path without filesystem/tool mocks.
  const { GatewayToolAdapter } = await import('../../dist/device/gateway-tool-adapter.js');
  const adapter = new GatewayToolAdapter(undefined, { observer: f.observer, pathValidator: async path => path });
  const file = join(f.root, 'data.txt');
  writeFileSync(file, 'hello');
  const sharp = (await import('sharp')).default;
  const image = join(f.root, 'pixel.png');
  await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toFile(image);
  for (const [tool, args] of [
    ['read_text_file', { path: file }],
    ['edit_file', { path: file, old_text: 'hello', new_text: 'world' }],
    ['shell_execute', { working_directory: f.root, command: 'echo capture-route' }],
    ['project_inspect', { path: f.root, view: 'summary' }],
    ['image_preview', { path: image, includeImage: false }],
    ['read_process_output', { session_id: 'invalid' }],
    ['start_process', { command: `"${process.execPath}" -e "console.log('route-process')"`, working_directory: f.root, timeout_ms: 1000 }],
  ]) {
    try { await adapter.call(tool, args); } catch { /* failure is also an execution outcome */ }
  }
  const db = f.store.repoDatabase(f.owner, f.repo);
  const rows = db.prepare('SELECT * FROM events ORDER BY event_id').all();
  assert.equal(rows.length, 7);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 7);
  assert.ok(rows.some(row => row.execution_status === 'failed'));
  assert.ok(rows.every(row => row.execution_status !== 'pending'));
  assert.equal(readFileSync(file, 'utf8'), 'world');
  assert.equal(rows[0].execution_status, 'succeeded');
  assert.equal(rows[1].execution_status, 'succeeded');
  assert.equal(rows[2].execution_status, 'succeeded');
  assert.equal(rows[4].execution_status, 'succeeded');
  assert.equal(rows[5].execution_status, 'failed');
  assert.equal(rows[6].execution_status, 'succeeded');
});

test('T045 local_* and history/UI observers never ingest their own responses', async t => {
  const f = approvalFixture(t);
  for (const tool of [...EXCLUDED_LOCAL_TOOLS, 'local_future_maintenance']) {
    const outcome = await f.observer.recordInvocation({ tool, result: 'secret recursive body', status: 'succeeded' });
    assert.deepEqual(outcome, { recorded: false, excluded: true });
    assert.equal(await f.observer.execute({ tool }, () => 'excluded result'), 'excluded result');
  }
  assert.equal(f.store.repoDatabase(f.owner, f.repo).prepare('SELECT count(*) AS n FROM events').get().n, 0);
});

test('T047 outcome retries never create a second event or payload', async t => {
  const f = approvalFixture(t);
  const token = await f.observer.beginIntent({ tool: 'read_file' });
  await f.observer.completeOutcome(token, { result: 'payload', status: 'succeeded' });
  await f.observer.completeOutcome(token, { result: 'payload', status: 'succeeded' });
  const db = f.store.repoDatabase(f.owner, f.repo);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 1);
});
