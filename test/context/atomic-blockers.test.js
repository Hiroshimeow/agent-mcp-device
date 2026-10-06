import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContextStore } from '../../dist/context/store.js';
import { consumeAdminToken } from '../../dist/context/cli.js';
import { temporary } from './helpers.js';

function fixture(t) {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('atomic'), repo = store.repository(owner, 'atomic');
  return { store, root, owner, repo };
}

test('B2 registry lock spans repository COMMIT through quota finalization even when lease expires after commit', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  const exec = db.exec.bind(db), registryExec = f.store.registry.exec.bind(f.store.registry);
  let committed = false, intermediateCommits = 0;
  f.store.registry.exec = sql => {
    if (sql === 'COMMIT' && committed) {
      intermediateCommits++;
      assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0, 'lease finalized before registry unlock');
      assert.equal(f.store.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(f.repo).evidence_bytes, 6);
    }
    registryExec(sql);
  };
  db.exec = sql => {
    exec(sql);
    if (sql === 'COMMIT' && db.prepare('SELECT count(*) AS n FROM evidence').get().n > 0) {
      committed = true;
      f.store.registry.prepare('UPDATE reservations SET expires_at=0').run();
    }
  };
  f.store.append(f.owner, f.repo, 'atomic');
  assert.equal(intermediateCommits, 1);
  assert.equal(f.store.reconcileQuota(), 6);
});

test('B2 store commit gate rejects a stale reservation token before repository COMMIT', t => {
  const f = fixture(t), db = f.store.repoDatabase(f.owner, f.repo);
  assert.throws(() => f.store.quotaWrite(f.owner, f.repo, 100000, () => {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES('stale','stale','hash',5,5,'retained',0)").run();
      f.store.commitRepository(db, 'stale-token');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }), /RESERVATION_FENCED_OFF/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence').get().n, 0);
});

test('B3 crash between evidence commit and quota finalization heals quota at startup', async t => {
  const f = fixture(t);
  const child = fork(new URL('./fixtures/maintenance-worker.js', import.meta.url), [f.root, f.owner, f.repo, 'crash'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => child.kill());
  const [message] = await once(child, 'message');
  assert.equal(message, 'committed-before-registry');
  const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  const restarted = new ContextStore(f.root);
  try {
    assert.equal(restarted.registry.prepare('SELECT evidence_bytes FROM quota_usage WHERE repo_uuid=?').get(f.repo).evidence_bytes, 15);
    assert.equal(restarted.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0);
  } finally { restarted.close(); }
});

test('P2 malformed token suffix cannot be truncated by hex buffer conversion', t => {
  const f = fixture(t), token = 'a'.repeat(64);
  writeFileSync(join(f.root, 'admin-clean-token'), JSON.stringify({ token, expires_at: Date.now() + 300000 }), { mode: 0o600 });
  for (const invalid of [token + 'zz', token.toUpperCase(), token.slice(1), '$ADMIN_TOKEN', '%ADMIN_TOKEN%']) {
    assert.throws(() => consumeAdminToken(f.root, invalid), /ACCESS_DENIED/);
  }
  consumeAdminToken(f.root, token);
});

for (const variant of ['--admin-token=' + 'a'.repeat(64), 'environment']) {
  test(`P2 clean rejects token transport ${variant === 'environment' ? 'environment variables' : '--admin-token=value'}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { runContextCli } from './dist/context/cli.js';
      for (const key of ['MCP_DEVICE_SESSION','MCP_RUNNER','MCP_DEVICE_REMOTE','PI_SESSION_ID','PI_AGENT','CODEX_THREAD_ID','CLAUDECODE']) delete process.env[key];
      Object.defineProperty(process.stdin, 'isTTY', { value: true });
      Object.defineProperty(process.stdout, 'isTTY', { value: true });
      ${variant === 'environment' ? "process.env.MCP_DEVICE_ADMIN_TOKEN_FILE = 'operator-token.json';" : ''}
      process.stdout.write(JSON.stringify(await runContextCli(['clean','--owner','owner','--repo','repo','--before','1'${variant === 'environment' ? '' : ',' + JSON.stringify(variant)}])));
    `], { cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(JSON.parse(result.stdout).stderr).error.code, 'ACCESS_DENIED');
  });
}

test('P2 concurrent clean calls sharing one token consume exactly once under exclusive lock', async t => {
  const f = fixture(t), token = 'b'.repeat(64);
  writeFileSync(join(f.root, 'admin-clean-token'), JSON.stringify({ token, expires_at: Date.now() + 300000 }), { mode: 0o600 });
  const children = [0, 1].map(() => fork(new URL('./fixtures/token-worker.js', import.meta.url), [f.root, token, f.owner, f.repo], { stdio: ['pipe', 'ignore', 'ignore', 'ipc'] }));
  t.after(() => children.forEach(child => child.kill()));
  await Promise.all(children.map(child => once(child, 'message')));
  const results = children.map(child => once(child, 'message'));
  const exits = children.map(child => once(child, 'exit'));
  children.forEach(child => child.send('go'));
  const outcomes = (await Promise.all(results)).map(([message]) => message);
  await Promise.all(exits);
  assert.equal(outcomes.filter(x => x === 'consumed').length, 1);
  assert.ok(outcomes.some(x => ['TOKEN_ALREADY_USED', 'ACCESS_DENIED'].includes(x)));
  assert.equal(readFileSync(join(f.root, 'admin-clean-token.used'), 'utf8').trim().split('\n').length, 1);
});
