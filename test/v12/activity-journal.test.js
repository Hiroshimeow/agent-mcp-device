import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ActivityJournal } from '../../dist/platform/activity-journal.js';

test('actual outcomes remain distinct from claimed success, with bounded private metadata', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v12-activity-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const journal = new ActivityJournal(root, 'test-device', 'test-runtime');
  journal.record('shell_execute', { command: 'private command', success: true }, { exitCode: 7, stdout: 'private output', success: true });
  journal.record('start_process', {}, { sessionId: 'running', exitCode: null });
  journal.record('read_file', { path: '/fixture/file', content: 'private source' }, { content: [{ type: 'text', text: 'private contents' }] });
  journal.record('knowledge.search', { query: 'private query' }, {});
  await journal.close();
  const files = await fs.readdir(path.join(root, 'logs')); assert.equal(files.length, 1); assert.match(files[0], /^device-activity-.*\.jsonl$/);
  const raw = await fs.readFile(path.join(root, 'logs', files[0]), 'utf8'), rows = raw.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 3); assert.equal(rows[0].status, 'failed'); assert.equal(rows[1].status, 'running'); assert.equal(rows[2].status, 'completed');
  assert.equal(rows[0].exit_code, 7); assert.deepEqual(rows[2].arguments, { path: '/fixture/file' });
  assert.equal(raw.includes('private '), false);
});

test('journal rotation bounds storage independently of plugin availability', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v12-activity-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const journal = new ActivityJournal(root, 'test-device', 'test-runtime', 1024);
  for (let i = 0; i < 60; i++) journal.record('write_file', { path: '/fixture/' + i }, {});
  await journal.close();
  const files = await fs.readdir(path.join(root, 'logs')); assert.ok(files.length <= 4);
  for (const file of files) { assert.match(file, /^device-activity-.*\.jsonl$/); assert.ok((await fs.stat(path.join(root, 'logs', file))).size <= 1024); }
});
