import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const version = process.versions.node.split('.').map(Number);
assert.ok(version[0] > 22 || (version[0] === 22 && version[1] >= 13), 'Feature 002 requires Node >=22.13.0');

if (process.argv.includes('--probe')) {
  // Dynamic import keeps the SQLite ExperimentalWarning on stderr, never JSON stdout.
  const warnings = [];
  process.on('warning', warning => warnings.push(warning.name));
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:'); // No constructor timeout option (22.13 compatibility).
  try {
    db.exec('PRAGMA busy_timeout = 5');
    assert.equal(db.prepare('PRAGMA busy_timeout').get().timeout, 5);
    db.exec('CREATE VIRTUAL TABLE probe USING fts5(text)');
    db.prepare('INSERT INTO probe(text) VALUES (?)').run('context sqlite searchable');
    assert.equal(db.prepare('SELECT text FROM probe WHERE probe MATCH ?').get('searchable').text, 'context sqlite searchable');
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(warnings.every(name => name === 'ExperimentalWarning'), 'Unexpected runtime warning');
    console.log(JSON.stringify({ ok: true, platform: process.platform, arch: process.arch, node: process.versions.node, sqlite: process.versions.sqlite, constructor: 'PASS', busy_timeout_ms: 5, fts5: 'PASS', warnings }));
  } finally {
    db.close();
  }
} else {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--probe'], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, NODE_OPTIONS: '', NODE_NO_WARNINGS: '0' }
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout); // Also rejects stdout polluted by warnings/logs.
  assert.equal(result.ok, true);
  assert.equal(result.fts5, 'PASS');
  if (child.stderr) assert.match(child.stderr, /ExperimentalWarning: SQLite is an experimental feature/);
  if (result.warnings.includes('ExperimentalWarning')) assert.match(child.stderr, /ExperimentalWarning/);
  console.log(JSON.stringify({ ...result, json_stdout: 'PASS', warning_stderr: child.stderr.trim() || 'NONE' }));
}
