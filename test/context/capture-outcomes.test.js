import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanonicalObserver, setLiveCaptureObserver, observePublicInvocation } from '../../dist/context/capture.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { approvalFixture } from './fixtures/capture-approval.js';

for (const failure of ['revocation', 'expiry']) {
for (const event of ['beginIntent', 'completeOutcome', 'excluded', 'duplicate', 'invalid-token']) {
  test(`capture ${event} revalidates ${failure} and detaches the active observer`, async t => {
    const f = approvalFixture(t);
    t.after(() => setLiveCaptureObserver(undefined));
    setLiveCaptureObserver(f.observer);
    const token = await f.observer.beginIntent({ tool: 'read_file' });
    if (event === 'duplicate') await f.observer.completeOutcome(token, { status: 'succeeded', result: 'before revocation' });
    const db = f.store.repoDatabase(f.owner, f.repo);
    const before = db.prepare('SELECT * FROM events').all();
    const evidence = db.prepare('SELECT * FROM evidence').all();
    const digest = createHash('sha256').update(readFileSync(f.path)).digest('hex');
    if (failure === 'revocation') writeFileSync(join(f.path, '..', 'revoked-approvals.json'), JSON.stringify([digest]));
    else {
      const now = Date.now;
      Date.now = () => JSON.parse(readFileSync(f.path, 'utf8')).expires_at + 1;
      t.after(() => { Date.now = now; });
    }
    const attempt = event === 'beginIntent' || event === 'excluded'
      ? () => f.observer.beginIntent({ tool: event === 'excluded' ? 'local_status' : 'read_file' })
      : () => f.observer.completeOutcome(event === 'invalid-token' ? { tool: 'read_file', ok: false, invocationId: 'invalid' } : token, { status: 'succeeded', result: 'must not persist' });
    await assert.rejects(attempt(), /FEATURE_GATE_LOCKED/);
    assert.deepEqual(db.prepare('SELECT * FROM events').all(), before);
    assert.deepEqual(db.prepare('SELECT * FROM evidence').all(), evidence);
    assert.equal(await observePublicInvocation({ tool: 'read_file' }, () => 'observer detached'), 'observer detached');
    assert.deepEqual(db.prepare('SELECT * FROM events').all(), before);
  });
}
}

test('T047 completed durable intent remains idempotent across observer recreation', async t => {
  const f = approvalFixture(t);
  const token = await f.observer.beginIntent({ tool: 'read_file' });
  await f.observer.completeOutcome(token, { result: 'first outcome', status: 'succeeded' });
  const replacement = createCanonicalObserver(f.service, f.store, f.owner, f.repo);
  await replacement.completeOutcome(token, { result: 'retry outcome', status: 'succeeded' });
  const db = f.store.repoDatabase(f.owner, f.repo);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 1);
  const row = db.prepare('SELECT payload_ref FROM events').get();
  assert.equal(JSON.parse(f.store.read(f.owner, f.repo, row.payload_ref).text).result, 'first outcome');
});

test('captured evidence uses 48-hex refs accepted by store read and activity graph', async t => {
  const f = approvalFixture(t);
  const outcome = await f.observer.recordInvocation({ tool: 'read_file', result: 'captured evidence', status: 'succeeded' });
  assert.equal(outcome.recorded, true);
  const row = f.store.repoDatabase(f.owner, f.repo).prepare('SELECT payload_ref FROM events WHERE event_id=?').get(outcome.eventId);
  assert.match(row.payload_ref, /^[a-f0-9]{48}$/);
  assert.equal(JSON.parse(f.store.read(f.owner, f.repo, row.payload_ref).text).result, 'captured evidence');
  f.service.sync(f.owner, f.repo);
  const graph = f.service.graph(f.owner, f.repo, { refs: [row.payload_ref] });
  assert.equal(graph.ok, true);
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0].kind, 'event');
  assert.equal(graph.nodes[0].evidence_ref, row.payload_ref);
});

test('T047 captured payload is bounded, redacted and original thrown error is preserved', async t => {
  const f = approvalFixture(t);
  await f.observer.recordInvocation({ tool: 'read_file', result: 'x'.repeat(200000), status: 'succeeded' });
  const row = f.store.repoDatabase(f.owner, f.repo).prepare('SELECT * FROM evidence').get();
  assert.ok(row.retained_bytes <= 65536);
  assert.equal(row.partial, 1);
  const failure = new Error('tool failure');
  await assert.rejects(f.observer.execute({ tool: 'write_file' }, () => { throw failure; }), error => error === failure);
  assert.equal(f.store.repoDatabase(f.owner, f.repo).prepare("SELECT count(*) AS n FROM events WHERE execution_status='failed'").get().n, 1);
});
