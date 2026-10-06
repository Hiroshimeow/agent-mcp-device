import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { resolveRepository } from '../../dist/context/repositories.js';
import { sync } from '../../dist/context/indexer.js';
import { CONTEXT_CLI_CONTRACT, runContextCli } from '../../dist/context/cli.js';
import { temporary, initGit } from './helpers.js';

const guard = async path => path;

async function fixture(t) {
  const stateRoot = temporary(t);
  const repoRoot = join(temporary(t), 'repo');
  mkdirSync(repoRoot, { recursive: true });
  initGit(repoRoot);
  const resolution = await resolveRepository(repoRoot, guard);
  assert.ok(resolution);
  const store = new ContextStore(stateRoot);
  const owner = store.activateOwner('cli-test-owner');
  const repo = store.repository(owner, resolution.identity);
  const ref = store.append(owner, repo, 'gateway reconnect evidence');
  sync(store, owner, repo);
  const service = new ContextService(store);
  const expectedSearch = service.search(owner, repo, { query: 'gateway reconnect' });
  const expectedRead = service.read(owner, repo, { refs: [ref] });
  const expectedStatus = service.status(owner, repo);
  store.close();
  return { stateRoot, repoRoot, expectedSearch, expectedRead, expectedStatus, ref };
}

test('CLI search/read/status preserve ContextService JSON semantics with gateway offline', async t => {
  const f = await fixture(t);
  process.env.MCP_GATEWAY_URL = 'http://127.0.0.1:1';
  t.after(() => delete process.env.MCP_GATEWAY_URL);

  const search = await runContextCli(
    ['search', '--cwd', f.repoRoot, '--query', 'gateway reconnect', '--json'],
    { stateRoot: f.stateRoot, pathGuard: guard },
  );
  assert.equal(search.exitCode, 0);
  assert.equal(search.stderr, '');
  assert.deepEqual(JSON.parse(search.stdout), f.expectedSearch);

  const read = await runContextCli(
    ['read', '--cwd', f.repoRoot, '--ref', f.ref, '--json'],
    { stateRoot: f.stateRoot, pathGuard: guard },
  );
  assert.equal(read.exitCode, 0);
  assert.equal(read.stderr, '');
  assert.deepEqual(JSON.parse(read.stdout), f.expectedRead);

  const status = await runContextCli(
    ['status', '--cwd', f.repoRoot, '--json'],
    { stateRoot: f.stateRoot, pathGuard: guard },
  );
  assert.equal(status.exitCode, 0);
  assert.equal(status.stderr, '');
  assert.deepEqual(JSON.parse(status.stdout), f.expectedStatus);
});

test('CLI keeps inaccessible local state typed and redacted without remote bypass', async t => {
  const repoRoot = join(temporary(t), 'repo');
  mkdirSync(repoRoot, { recursive: true });
  initGit(repoRoot);
  const blocked = join(temporary(t), 'state-is-a-file');
  writeFileSync(blocked, 'not a directory');

  const result = await runContextCli(
    ['status', '--cwd', repoRoot, '--json'],
    { stateRoot: blocked, pathGuard: guard },
  );
  assert.equal(result.exitCode, 3);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), { ok: false, error: { code: 'LOCAL_STATE_UNAVAILABLE' } });
  assert.ok(!result.stderr.includes(blocked));

  const source = readFileSync(new URL('../../src/context/cli.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"].*(?:gateway|remote)|fetch\(/i);
});

test('CLI ACCESS_DENIED remains local and uses the stable access exit code', async t => {
  const f = await fixture(t);
  const result = await runContextCli(
    ['status', '--cwd', f.repoRoot, '--json'],
    { stateRoot: f.stateRoot, pathGuard: async () => { throw new Error('ACCESS_DENIED'); } },
  );
  assert.equal(result.exitCode, 3);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), { ok: false, error: { code: 'ACCESS_DENIED' } });
});

test('CLI executable emits JSON, human output, and safe usage errors', async t => {
  const f = await fixture(t);
  const run = args => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/mcp-device.js', 'context', ...args], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8', env: { ...process.env, MCP_DEVICE_CONFIG_DIR: f.stateRoot },
  });
  const status = run(['status', '--cwd', f.repoRoot, '--json']);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(status.stderr, '');
  assert.deepEqual(JSON.parse(status.stdout), f.expectedStatus);
  const human = run(['status', '--cwd', f.repoRoot]);
  assert.equal(human.status, 0);
  assert.match(human.stdout, /Repository:/);
  for (const args of [['search', '--query'], ['status', '--cwd', f.repoRoot, '--cwd', f.repoRoot], ['search', '--cwd', f.repoRoot, '--query', 'x', '--limit', 'NaN']]) {
    const invalid = run(args);
    assert.notEqual(invalid.status, 0);
    assert.equal(invalid.stdout, '');
    assert.ok(JSON.parse(invalid.stderr).error.code);
  }
});

test('CLI paginates search and read and explicitly syncs/rebuilds without source mutation', async t => {
  const f = await fixture(t);
  const store = new ContextStore(f.stateRoot);
  const resolution = await resolveRepository(f.repoRoot, guard);
  const owner = store.activeOwner(), repo = store.findRepository(owner, resolution.identity);
  const longRef = store.append(owner, repo, 'gateway reconnect '.repeat(1000));
  const before = store.repoDatabase(owner, repo).prepare('SELECT count(*) AS n FROM events').get().n;
  store.close();
  const run = args => runContextCli([...args, '--cwd', f.repoRoot, '--json'], { stateRoot: f.stateRoot, pathGuard: guard });
  const synced = await run(['sync']);
  assert.equal(synced.exitCode, 0, synced.stderr);
  assert.equal(JSON.parse(synced.stdout).index.pending_events, 0);
  const page1 = JSON.parse((await run(['search', '--query', 'gateway reconnect', '--limit', '1'])).stdout);
  assert.ok(page1.next_cursor);
  const page2 = JSON.parse((await run(['search', '--query', 'gateway reconnect', '--limit', '1', '--cursor', page1.next_cursor])).stdout);
  assert.notEqual(page1.items[0].ref, page2.items[0].ref);
  const read1 = JSON.parse((await run(['read', '--ref', longRef, '--max-bytes', '2048'])).stdout);
  assert.ok(read1.next_cursor);
  const read2 = JSON.parse((await run(['read', '--ref', longRef, '--max-bytes', '2048', '--cursor', read1.next_cursor])).stdout);
  assert.equal(read2.items[0].captured_range.start, read1.items[0].captured_range.end);
  const rebuilt = await run(['rebuild']);
  assert.equal(rebuilt.exitCode, 0, rebuilt.stderr);
  const check = new ContextStore(f.stateRoot);
  assert.equal(check.repoDatabase(owner, repo).prepare('SELECT count(*) AS n FROM events').get().n, before);
  check.close();
});

test('read-only CLI leaves persisted databases unchanged and reports safe accounting', async t => {
  const f = await fixture(t);
  const store = new ContextStore(f.stateRoot);
  const files = store.databaseFiles().filter(file => file.endsWith('.sqlite'));
  store.close();
  const before = files.map(file => readFileSync(file));
  const result = await runContextCli(['status', '--cwd', f.repoRoot, '--json'], { stateRoot: f.stateRoot });
  assert.equal(result.exitCode, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.storage.available, true);
  assert.ok(Number.isInteger(body.storage.accounted_bytes));
  assert.ok(body.index.fts_documents >= 1);
  assert.doesNotMatch(result.stdout, /registry\.sqlite|context\.sqlite/);
  files.forEach((file, i) => assert.deepEqual(readFileSync(file), before[i]));
});

test('CLI scope failure and sealed namespace cannot fall back', async t => {
  const f = await fixture(t);
  const nonRepo = await runContextCli(['status', '--cwd', temporary(t), '--json'], { stateRoot: f.stateRoot });
  assert.equal(JSON.parse(nonRepo.stderr).error.code, 'REPOSITORY_NOT_FOUND');
  const store = new ContextStore(f.stateRoot);
  store.activateOwner('new-owner'); store.close();
  const result = await runContextCli(['search', '--cwd', f.repoRoot, '--query', 'gateway', '--json'], { stateRoot: f.stateRoot });
  assert.equal(result.exitCode, 4);
  assert.equal(result.stdout, '');
});

test('CLI rejects caller-controlled device/account/store selectors and exposes only contracted commands', async () => {
  for (const flag of ['--device-id', '--owner', '--account-id', '--state-root', '--db']) {
    const result = await runContextCli(['status', flag, 'forbidden', '--json']);
    assert.equal(result.exitCode, 2);
    assert.deepEqual(JSON.parse(result.stderr), { ok: false, error: { code: 'ACTION_UNSUPPORTED' } });
  }
  assert.deepEqual(
    CONTEXT_CLI_CONTRACT.commands.map(command => command.name),
    ['status', 'search', 'read', 'graph', 'sync', 'checkpoint', 'rebuild', 'cancel'],
  );
  assert.ok(CONTEXT_CLI_CONTRACT.globalFlags.includes('--cwd'));
  assert.ok(CONTEXT_CLI_CONTRACT.globalFlags.includes('--json'));
});
