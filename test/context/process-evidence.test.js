import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalFixture } from './fixtures/capture-approval.js';

test('T048 canonical process identity/ranges survive capture and repeated polling reuses payload', async t => {
  const f = approvalFixture(t);
  const process = { execution_id: 'execution-uuid', runtime_generation: 'runtime-uuid', pid: 123,
    read_from: 5, read_count: 2, evicted_lines: 0, is_complete: false };
  const result = { content: [{ type: 'text', text: 'bounded output' }], _meta: { process } };
  for (let i = 0; i < 2; i++) await f.observer.recordInvocation({ tool: 'read_process_output', args: { session_id: '123', offset: 5, length: 2 }, result, status: 'succeeded', durationMs: i });
  const db = f.store.repoDatabase(f.owner, f.repo);
  const rows = db.prepare('SELECT payload_ref FROM events').all();
  assert.equal(rows.length, 2, 'polls are distinct invocations');
  assert.equal(rows[0].payload_ref, rows[1].payload_ref, 'same canonical range does not duplicate corpus bytes');
  assert.deepEqual(JSON.parse(f.store.read(f.owner, f.repo, rows[0].payload_ref).text).result._meta.process, process);
  await f.observer.recordInvocation({ tool: 'read_process_output', result: { ...result, _meta: { process: { ...process, execution_id: 'new-execution-same-pid' } } }, status: 'succeeded' });
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 2, 'PID reuse is not conflated');
});

test('T048 live process adapter exposes runtime/execution identity and bounded range metadata', async () => {
  const { terminalManager } = await import('../../dist/terminal-manager.js');
  const result = await terminalManager.executeCommand(`"${globalThis.process.execPath}" -e "console.log('process-evidence')"`, 1000);
  assert.ok(result.pid > 0);
  const identity = terminalManager.processIdentity(result.pid);
  assert.match(identity.execution_id, /^[a-f0-9-]{36}$/);
  assert.match(identity.runtime_generation, /^[a-f0-9-]{36}$/);
  assert.equal(identity.pid, result.pid);
  const { readProcessOutput } = await import('../../dist/tools/improved-process-tools.js');
  const read = await readProcessOutput({ pid: result.pid, offset: 1, length: 1, timeout_ms: 1 });
  assert.equal(read._meta.process.execution_id, identity.execution_id);
  assert.ok(read._meta.process.read_count <= 1);
  assert.equal(typeof read._meta.process.is_complete, 'boolean');
});
