import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { resolveRepository } from '../../dist/context/repositories.js';
import { sync } from '../../dist/context/indexer.js';
import { temporary, initGit, git } from './helpers.js';

const guard = async path => path;

async function setup(t) {
  const cleanup = [];
  const resources = { after: fn => cleanup.push(fn) };
  const stateRoot = temporary(resources);
  const repoRoot = join(temporary(resources), 'repo');
  mkdirSync(repoRoot, { recursive: true });
  initGit(repoRoot);
  writeFileSync(join(repoRoot, 'changed.txt'), 'working tree change');
  const resolution = await resolveRepository(repoRoot, guard);
  assert.ok(resolution);
  const store = new ContextStore(stateRoot);
  t.after(() => { store.close(); for (const dispose of cleanup) dispose(); });
  const owner = store.activateOwner('checkpoint-owner');
  const repo = store.repository(owner, resolution.identity);
  const evidenceRef = store.append(owner, repo, 'captured test evidence');
  const service = new ContextService(store);
  return { store, service, owner, repo, repoRoot, resolution, evidenceRef };
}

test('checkpoint separates observed Git metadata from reported summary and refs', async t => {
  const f = await setup(t);
  const summary = 'npm test passed; shell command succeeded (reported claim only)';
  const result = f.service.checkpoint(f.owner, f.repo, {
    repository_root: f.repoRoot,
    worktree_ref: f.resolution.worktree,
    summary,
    evidence_refs: [f.evidenceRef],
  });

  assert.equal(result.ok, true);
  assert.equal(result.scope.repository_ref, f.repo);
  assert.equal(result.checkpoint.observed.head, git(f.repoRoot, 'rev-parse', 'HEAD'));
  assert.equal(result.checkpoint.observed.worktree_ref, f.resolution.worktree);
  assert.equal(result.checkpoint.observed.dirty, true);
  assert.ok(result.checkpoint.observed.changed_paths.includes('changed.txt'));
  assert.equal(result.checkpoint.reported.summary, summary);
  assert.deepEqual(result.checkpoint.reported.evidence_refs, [f.evidenceRef]);
  assert.equal('tests' in result.checkpoint.observed, false);
  assert.equal('commands' in result.checkpoint.observed, false);

  const persisted = JSON.parse(f.store.read(f.owner, f.repo, result.checkpoint.ref).text);
  assert.equal(persisted.reported.summary, summary);
  assert.deepEqual(persisted.reported.evidence_refs, [f.evidenceRef]);

  const db = f.store.repoDatabase(f.owner, f.repo);
  assert.equal(db.prepare("SELECT count(*) AS n FROM activity_nodes WHERE kind IN ('command','test_run')").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM activity_nodes WHERE kind='checkpoint' AND evidence_ref=?").get(result.checkpoint.ref).n, 1);
});

test('checkpoint claims remain reported after indexing and search', async t => {
  const f = await setup(t);
  const result = f.service.checkpoint(f.owner, f.repo, {
    repository_root: f.repoRoot,
    worktree_ref: f.resolution.worktree,
    summary: 'unsupported native test claim passed',
    evidence_refs: [f.evidenceRef],
  });
  sync(f.store, f.owner, f.repo);
  const found = f.service.search(f.owner, f.repo, {
    query: 'unsupported native test claim',
    source_types: ['checkpoint'],
  });
  assert.equal(found.items[0].ref, result.checkpoint.ref);
  assert.equal(found.items[0].source_kind, 'checkpoint');
  assert.equal(found.items[0].evidence_class, 'reported');
  const read = f.service.read(f.owner, f.repo, { refs: [result.checkpoint.ref] });
  assert.equal(read.items[0].source_kind, 'checkpoint');
  assert.equal(read.items[0].evidence_class, 'reported');
});

test('checkpoint redacts reported secrets without breaking structured evidence', async t => {
  const f = await setup(t);
  const result = f.service.checkpoint(f.owner, f.repo, {
    repository_root: f.repoRoot, worktree_ref: f.resolution.worktree,
    summary: 'password=canary-super-secret',
  });
  assert.doesNotMatch(JSON.stringify(result), /canary-super-secret/);
  assert.match(result.checkpoint.reported.summary, /REDACTED/);
  assert.doesNotMatch(String(f.store.read(f.owner, f.repo, result.checkpoint.ref).text), /canary-super-secret/);
});

test('checkpoint rejects unknown evidence refs without fabricating checkpoint evidence', async t => {
  const f = await setup(t);
  const before = f.store.repoDatabase(f.owner, f.repo)
    .prepare("SELECT count(*) AS n FROM activity_nodes WHERE kind='checkpoint'").get().n;
  assert.throws(() => f.service.checkpoint(f.owner, f.repo, {
    repository_root: f.repoRoot,
    worktree_ref: f.resolution.worktree,
    summary: 'claim',
    evidence_refs: ['0'.repeat(48)],
  }), /REF_NOT_FOUND/);
  const after = f.store.repoDatabase(f.owner, f.repo)
    .prepare("SELECT count(*) AS n FROM activity_nodes WHERE kind='checkpoint'").get().n;
  assert.equal(after, before);
});
