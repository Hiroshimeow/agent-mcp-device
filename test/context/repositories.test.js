import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveRepository } from '../../dist/context/repositories.js';
import { temporary, git, initGit } from './helpers.js';
const allow = p => p;
test('Git roots, worktrees, separate clones and nested repositories', async t => {
  const root = temporary(t), repo = join(root, 'repo'); mkdirSync(repo); initGit(repo);
  mkdirSync(join(repo, 'sub'));
  const a = await resolveRepository(join(repo, 'sub'), allow);
  assert.equal(a.root.replaceAll('\\', '/'), repo.replaceAll('\\', '/'));
  git(repo, 'worktree', 'add', join(root, 'worktree'));
  const w = await resolveRepository(join(root, 'worktree'), allow);
  assert.equal(w.identity, a.identity); assert.notEqual(w.worktree, a.worktree);
  git(root, 'clone', repo, join(root, 'clone'));
  assert.notEqual((await resolveRepository(join(root, 'clone'), allow)).identity, a.identity);
  const nested = join(repo, 'nested'); mkdirSync(nested); initGit(nested);
  assert.notEqual((await resolveRepository(nested, allow)).identity, a.identity);
});
test('non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved', async t => {
  const root = temporary(t);
  assert.equal(await resolveRepository(root, allow), null);
  await assert.rejects(resolveRepository(undefined, allow), /SCOPE_REQUIRED/);
  await assert.rejects(resolveRepository([root, root], allow), /SCOPE_AMBIGUOUS/);
  await assert.rejects(resolveRepository(join(root, 'missing'), allow), /REPOSITORY_NOT_FOUND/);
  await assert.rejects(resolveRepository(root + '/../escape', allow), /ACCESS_DENIED/);
});
