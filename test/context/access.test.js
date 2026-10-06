import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextStore } from '../../dist/context/store.js';
import { resolveRepository } from '../../dist/context/repositories.js';
import { temporary } from './helpers.js';
test('re-pair seals old namespace; refs and cursors never authorize another scope', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const owner = store.activateOwner('owner-a'), repo = store.repository(owner, 'repo-a');
  const ref = store.append(owner, repo, 'old evidence'), cursor = store.cursor(owner, repo, 'query', 0);
  const other = store.repository(owner, 'repo-b');
  assert.throws(() => store.read(owner, other, ref), /REF_NOT_FOUND/);
  assert.throws(() => store.validateCursor(owner, other, cursor, 'query'), /CURSOR_INVALID/);
  const next = store.activateOwner('owner-b'); assert.notEqual(next, owner);
  assert.equal(store.registry.prepare('SELECT status FROM owners WHERE owner_key=?').get(owner).status, 'sealed');
  for (const run of [() => store.read(owner, repo, ref), () => store.repository(owner, 'new'), () => store.validateCursor(owner, repo, cursor, 'query'), () => store.repoDatabase(next, repo)]) assert.throws(run, /ACCESS_DENIED/);
  const returning = store.activateOwner('owner-a');
  assert.notEqual(returning, next);
  assert.notEqual(store.activeOwner(), owner); // even returning pairing does not adopt a sealed namespace
});
test('read cursor binds repository scope and sealed state', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const owner = store.activateOwner('a'), repo = store.repository(owner, 'a'), other = store.repository(owner, 'b');
  const state = { generation: null, key: 'query-hash', position: 0, offset: 0, expires_at: Date.now() + 10000 };
  const token = store.signReadCursor(owner, repo, state);
  assert.equal(store.parseReadCursor(owner, repo, token).sealed, false);
  assert.throws(() => store.parseReadCursor(owner, other, token), /CURSOR_INVALID/);
  const [body, signature] = token.split('.');
  const changed = { ...JSON.parse(Buffer.from(body, 'base64url').toString()), sealed: true };
  assert.throws(() => store.parseReadCursor(owner, repo, `${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`), /CURSOR_INVALID/);
});

test('durable cursor signature protects generation, query, expiry and position', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const owner = store.activateOwner('a'), repo = store.repository(owner, 'a');
  const token = store.cursor(owner, repo, 'query', 0);
  store.repoDatabase(owner, repo).prepare('UPDATE cursors SET position=99 WHERE token_id=?').run(token.split('.')[0]);
  assert.throws(() => store.validateCursor(owner, repo, token, 'query'), /CURSOR_INVALID/);
});

test('sandbox denial is propagated once, without Git or alternate-path fallback', async t => {
  let calls = 0;
  await assert.rejects(resolveRepository(temporary(t), () => { calls++; throw new Error('ACCESS_DENIED'); }), /ACCESS_DENIED/);
  assert.equal(calls, 1);
});
