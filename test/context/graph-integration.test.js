import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { resolveRepository } from '../../dist/context/repositories.js';
import { runContextCli } from '../../dist/context/cli.js';
import { temporary, initGit } from './helpers.js';

test('graph CLI is read-only domain parity and search optionally returns bounded related refs', async t => {
  const root = temporary(t), repoRoot = join(temporary(t), 'repo'); mkdirSync(repoRoot); initGit(repoRoot);
  const resolution = await resolveRepository(repoRoot, async path => path);
  const store = new ContextStore(root);
  try {
    const owner = store.activateOwner('integration-owner'), repo = store.repository(owner, resolution.identity), service = new ContextService(store);
    const ref = store.append(owner, repo, JSON.stringify({ toolName: 'read_file', arguments: { path: 'file.ts' }, text: 'unique-marker' }));
    const related = store.append(owner, repo, JSON.stringify({ toolName: 'edit_file', arguments: { path: 'file.ts' }, status: 'succeeded' }));
    service.sync(owner, repo);
    const expected = service.graph(owner, repo, { refs: [ref], wall_ms: 100 });
    const cli = await runContextCli(['graph', '--cwd', repoRoot, '--ref', ref, '--wall-ms', '100', '--json'], { stateRoot: root });
    assert.equal(cli.exitCode, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), expected);
    const hit = service.search(owner, repo, { query: 'unique-marker', include_related: true }).items[0];
    assert.ok(hit.related_refs.includes(related));
    assert.ok(!service.search(owner, repo, { query: 'unique-marker' }).items[0].related_refs);
    const generation = service.status(owner, repo).index.generation;
    assert.equal(generation, expected.index.generation);
  } finally { store.close(); }
});
