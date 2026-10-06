import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalFixture } from './fixtures/capture-approval.js';
import { sync } from '../../dist/context/indexer.js';

test('finalized per-ref byte ranges preserve order, Unicode, cursor binding and aggregate budget', t => {
  const f = approvalFixture(t);
  const ref = f.store.append(f.owner, f.repo, 'before 😀 after '.repeat(1000));
  sync(f.store, f.owner, f.repo);
  const input = { refs: [ref], ranges: [{ ref, start: 7, end: 11 }] };
  const result = f.service.read(f.owner, f.repo, input);
  assert.equal(result.items[0].content, '😀');
  assert.deepEqual(result.items[0].captured_range, { start: 7, end: 11 });
  assert.equal(result.next_cursor, null);
  const first = f.service.read(f.owner, f.repo, { refs: [ref], ranges: [{ ref, start: 7, end: 3000 }], max_bytes: 2048 });
  assert.ok(first.next_cursor);
  const next = f.service.read(f.owner, f.repo, { refs: [ref], ranges: [{ ref, start: 7, end: 3000 }], max_bytes: 2048, cursor: first.next_cursor });
  assert.equal(next.items[0].captured_range.start, first.items[0].captured_range.end);
  assert.throws(() => f.service.read(f.owner, f.repo, { refs: [ref], ranges: [{ ref, start: 0, end: 3000 }], cursor: first.next_cursor }), /CURSOR_INVALID/);
  for (const range of [{ ref, start: 8 }, { ref, start: 11, end: 8 }, { ref: 'other', start: 0 }]) {
    assert.throws(() => f.service.read(f.owner, f.repo, { refs: [ref], ranges: [range] }), /ACTION_UNSUPPORTED/);
  }
});
