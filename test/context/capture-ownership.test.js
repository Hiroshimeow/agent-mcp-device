import test from 'node:test';
import assert from 'node:assert/strict';
import { observePublicInvocation, setLiveCaptureObserver } from '../../dist/context/capture.js';
import { approvalFixture } from './fixtures/capture-approval.js';

test('T049 outer observer owns nested dispatch once and legacy tool history does not double write', async t => {
  const f = approvalFixture(t);
  setLiveCaptureObserver(f.observer);
  t.after(() => setLiveCaptureObserver(undefined));
  const { dispatchToolCall } = await import('../../dist/tool-dispatcher.js');
  const { toolHistory } = await import('../../dist/utils/toolHistory.js');
  const original = toolHistory.addCall;
  let legacyWrites = 0;
  toolHistory.addCall = () => { legacyWrites++; };
  t.after(() => { toolHistory.addCall = original; });
  const result = await observePublicInvocation({ tool: 'public_outer' }, () => dispatchToolCall('unknown-test-route', {}));
  assert.equal(result.isError, true);
  assert.equal(legacyWrites, 0);
  const db = f.store.repoDatabase(f.owner, f.repo);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 1);
  const row = db.prepare('SELECT payload_ref FROM events').get();
  assert.equal(JSON.parse(f.store.read(f.owner, f.repo, row.payload_ref).text).tool, 'public_outer');
  setLiveCaptureObserver(undefined);
  await dispatchToolCall('unknown-test-route', {});
  assert.equal(legacyWrites, 1, 'disabled capture preserves legacy behavior and migration compatibility');
});
