import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { resolveRepository } from '../../dist/context/repositories.js';
import { temporary, initGit } from './helpers.js';

test('fresh status creates no repo database; unknown intent and wrong job scope are visible', t => {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('pair'), repo = store.repository(owner, 'repo');
  const service = new ContextService(store);
  const path = join(root, 'context', 'owners', owner, 'repos', repo, 'context.sqlite');
  assert.equal(existsSync(path), false); service.status(owner, repo); assert.equal(existsSync(path), false);
  store.repoDatabase(owner, repo).prepare("INSERT INTO events(invocation_id,accepted_at,execution_status) VALUES('intent',0,'unknown_after_restart')").run();
  assert.equal(service.status(owner, repo).capture_health.unknown_after_restart, 1);
  assert.equal(service.status(owner, repo).coverage.complete, false);
  const job = service.startJob(owner, repo, 'sync');
  const other = store.repository(owner, 'other');
  assert.throws(() => service.finishJob(owner, other, job), /ACCESS_DENIED/);
  assert.throws(() => store.repoDatabase(owner, '../outside'), /ACCESS_DENIED/);
  for (let i = 2; i < 256; i++) store.repository(owner, `repo-${i}`);
  assert.throws(() => store.repository(owner, 'overflow'), /BUDGET_EXCEEDED/);
  assert.equal(store.repository(owner, 'repo'), repo);
});
test('migration rejects a newer schema without replacing it and publication rejects invalid watermarks', t => {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('pair'), repo = store.repository(owner, 'repo');
  const shadow = store.beginGeneration(owner, repo);
  assert.throws(() => store.publishGeneration(owner, repo, shadow, 999, 'hash'), /INDEX_INCOMPATIBLE/);
  assert.equal(store.manifest(owner, repo).generation, null);
  store.repoDatabase(owner, repo).exec('PRAGMA user_version=99');
  store.close(); store = undefined;
  store = new ContextStore(root);
  assert.throws(() => store.repoDatabase(owner, repo), /INDEX_INCOMPATIBLE/);
});
test('symlink sandbox escape is denied on its canonical target', async t => {
  const root = temporary(t), safe = join(root, 'safe'), outside = join(root, 'outside');
  mkdirSync(safe); mkdirSync(outside); initGit(outside);
  const link = join(safe, 'link'); symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(resolveRepository(link, p => {
    if (!resolve(p).startsWith(resolve(safe))) throw new Error('ACCESS_DENIED'); return p;
  }), /ACCESS_DENIED/);
});
