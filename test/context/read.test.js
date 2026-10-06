import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { temporary } from './helpers.js';

test('Vietnamese and emoji byte-budget pages preserve code points and byte offsets', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const owner = store.activateOwner('a'), repo = store.repository(owner, 'r'), service = new ContextService(store);
  const text = 'đường dẫn 🧭😀 tiếng Việt '.repeat(100), ref = store.append(owner, repo, text);
  let cursor, rebuilt = '', offset = 0, pages = 0;
  do {
    const page = service.read(owner, repo, { refs: [ref], max_bytes: 1000, cursor });
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 1000);
    const item = page.items[0];
    assert.ok(!item.content.includes('\uFFFD'));
    assert.equal(item.content, Buffer.from(item.content).toString('utf8'));
    assert.equal(item.captured_range.start, offset);
    offset += Buffer.byteLength(item.content);
    assert.equal(item.captured_range.end, offset);
    rebuilt += item.content; cursor = page.next_cursor; pages++;
    assert.ok(pages < 100);
  } while (cursor);
  assert.ok(pages > 1); assert.equal(rebuilt, text); assert.equal(offset, Buffer.byteLength(text));
  for (const cap of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const clipped = store.append(owner, repo, 'đ😀ẫ', { maxBytes: cap });
    const content = store.read(owner, repo, clipped).text;
    assert.ok(Buffer.byteLength(content) <= cap);
    assert.ok(!content.includes('\uFFFD')); assert.equal(content, Buffer.from(content).toString('utf8'));
  }
});

test('evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const owner = store.activateOwner('a'), repo = store.repository(owner, 'r'), service = new ContextService(store);
  const first = store.append(owner, repo, 'Tiếng Việt '.repeat(300) + 'api_key=READ_SECRET_CANARY');
  const second = store.append(owner, repo, 'second retained');
  const partial = store.append(owner, repo, 'bộ nhớ dài', { maxBytes: 8 });
  const before = store.databaseFiles().filter(path => !path.endsWith('-shm')).map(path => [path, readFileSync(path)]);
  const page = service.read(owner, repo, { refs: [first, second], max_bytes: 1500 });
  assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 1500); assert.ok(page.partial); assert.ok(page.next_cursor);
  assert.ok(!page.items[0].content.includes('\uFFFD')); assert.equal(page.items[0].redaction_state, 'redacted');
  let text = page.items.map(item => item.content ?? '').join(''), cursor = page.next_cursor;
  while (cursor) {
    const more = service.read(owner, repo, { refs: [first, second], max_bytes: 1500, cursor });
    assert.ok(Buffer.byteLength(JSON.stringify(more)) <= 1500);
    text += more.items.map(item => item.content ?? '').join(''); cursor = more.next_cursor;
  }
  assert.equal(text, store.read(owner, repo, first).text + 'second retained');
  for (const [path, bytes] of before) assert.deepEqual(readFileSync(path), bytes);
  assert.equal(service.read(owner, repo, { refs: [partial] }).items[0].retention_state, 'partial');
  store.repoDatabase(owner, repo).prepare("UPDATE evidence SET retention_state='expired' WHERE ref=?").run(second);
  const result = service.read(owner, repo, { refs: ['missing', second, first] });
  assert.deepEqual(result.items.map(item => item.ref), ['missing', second, first]);
  assert.equal(result.items[0].error, 'REF_NOT_FOUND'); assert.equal(result.items[1].error, 'EVIDENCE_EXPIRED');
  assert.ok(!JSON.stringify(result).includes('READ_SECRET_CANARY'));
  assert.throws(() => service.read(owner, repo, { refs: [second], cursor: page.next_cursor }), /CURSOR_INVALID/);
  const other = store.repository(owner, 'other'); store.append(owner, other, 'other');
  assert.equal(service.read(owner, other, { refs: [first] }).items[0].error, 'REF_NOT_FOUND');
  assert.throws(() => service.read(owner, repo, { refs: [first], max_bytes: 1 }), /BUDGET_EXCEEDED/);
});
