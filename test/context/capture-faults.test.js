import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { ContextService } from '../../dist/context/service.js';
import { approvalFixture } from './fixtures/capture-approval.js';

for (const failure of ['busy', 'storage', 'quota']) test(`T046 pre-intent ${failure} fails open and never replays execution`, async t => {
  const f = approvalFixture(t);
  const db = f.store.repoDatabase(f.owner, f.repo);
  let lock;
  if (failure === 'busy') {
    lock = new DatabaseSync(join(f.root, 'context', 'owners', f.owner, 'repos', f.repo, 'repo.sqlite'));
    lock.exec('BEGIN IMMEDIATE');
  } else if (failure === 'quota') f.store.configureQuota({ repo_bytes: 0 });
  else f.store.repoDatabase = () => { throw new Error('disk unavailable'); };
  let calls = 0;
  const started = Date.now();
  const result = await f.observer.execute({ tool: 'write_file', args: {} }, () => { calls++; return 'done'; });
  assert.equal(result, 'done');
  assert.equal(calls, 1);
  assert.ok(Date.now() - started < 1000, 'capture contention has a short bounded budget');
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 0);
  assert.equal(f.service.status(f.owner, f.repo).capture_health.in_memory_gaps, 1);
  if (lock) { lock.exec('ROLLBACK'); lock.close(); }
});

test('T046 crash after durable intent yields unknown_after_restart without replay', async t => {
  const f = approvalFixture(t);
  const token = await f.observer.beginIntent({ tool: 'write_file' });
  assert.equal(token.ok, true);
  f.restart();
  f.store.repoDatabase(f.owner, f.repo);
  const status = new ContextService(f.store).status(f.owner, f.repo);
  assert.equal(status.capture_health.unknown_after_restart, 1);
  assert.equal(status.coverage.complete, false);
});

test('T046 failed outcome write retains execution status, reports gap, and does not replay', async t => {
  const f = approvalFixture(t);
  const db = f.store.repoDatabase(f.owner, f.repo);
  db.exec("CREATE TRIGGER fail_payload BEFORE INSERT ON evidence BEGIN SELECT RAISE(FAIL,'disk full'); END");
  let calls = 0;
  assert.equal(await f.observer.execute({ tool: 'edit_file' }, () => { calls++; return 'edited'; }), 'edited');
  assert.equal(calls, 1);
  const row = db.prepare('SELECT execution_status,recording_status,payload_ref FROM events').get();
  assert.equal(row.execution_status, 'succeeded');
  assert.equal(row.recording_status, 'degraded');
  assert.equal(row.payload_ref, null);
  assert.equal(f.service.status(f.owner, f.repo).capture_health.in_memory_gaps, 1);
});

test('T046 transport failure after outcome preserves exactly one event and execution', async t => {
  const f = approvalFixture(t);
  let calls = 0;
  await assert.rejects(async () => {
    const result = await f.observer.execute({ tool: 'write_file' }, () => { calls++; return 'written'; });
    assert.equal(result, 'written');
    throw new Error('transport disconnected');
  }, /transport disconnected/);
  assert.equal(calls, 1);
  assert.equal(f.store.repoDatabase(f.owner, f.repo).prepare('SELECT count(*) AS n FROM events').get().n, 1);
});

test('T047 authorization is revalidated before dispatch; revocation during execution never hides its result', async t => {
  const f = approvalFixture(t);
  assert.equal(await f.observer.execute({ tool: 'write_file' }, () => {
    writeFileSync(f.path, '{}'); return 'written';
  }), 'written');
  assert.equal(f.service.status(f.owner, f.repo).capture_health.in_memory_gaps, 1);
  let calls = 0;
  await assert.rejects(f.observer.execute({ tool: 'write_file' }, () => { calls++; }), /FEATURE_GATE_LOCKED/);
  assert.equal(calls, 0);
});
