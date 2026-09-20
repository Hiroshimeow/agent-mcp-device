import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseScript = path.join(repoRoot, 'scripts', 'release.js');
const syncVersionScript = path.join(repoRoot, 'scripts', 'sync-version.js');

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false
  });
}

function git(cwd, ...args) {
  const result = run('git', args, cwd);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function readPackage(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

function createFixture({ testsPass = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-device-release-test-'));
  const repo = path.join(root, 'repo');
  const remote = path.join(root, 'remote.git');
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });

  fs.copyFileSync(syncVersionScript, path.join(repo, 'scripts', 'sync-version.js'));
  fs.writeFileSync(path.join(repo, 'test-script.js'), testsPass ? '' : 'process.exit(7);\n');
  writeJson(path.join(repo, 'package.json'), {
    name: '@hcu-lab.me/mcp-device-test',
    version: '1.2.3',
    private: true,
    type: 'module',
    scripts: {
      test: 'node test-script.js',
      version: 'node scripts/sync-version.js && git add server.json src/version.ts package-lock.json'
    }
  });
  writeJson(path.join(repo, 'package-lock.json'), {
    name: '@hcu-lab.me/mcp-device-test',
    version: '1.2.3',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: '@hcu-lab.me/mcp-device-test',
        version: '1.2.3'
      }
    }
  });
  writeJson(path.join(repo, 'server.json'), {
    name: 'mcp-device-test',
    version: '1.2.3',
    packages: []
  });
  fs.writeFileSync(path.join(repo, 'src', 'version.ts'), "export const VERSION = '1.2.3';\n");

  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'release-test@example.invalid');
  git(repo, 'config', 'user.name', 'Release Test');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'initial');

  git(root, 'init', '--bare', remote);
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-u', 'origin', 'main');

  return {
    root,
    repo,
    remote,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

function runRelease(dir, type) {
  return run(process.execPath, [releaseScript, type], dir);
}

function assertVersionUnchanged(dir) {
  assert.equal(readPackage(dir).version, '1.2.3');
  assert.equal(git(dir, 'tag', '--list'), '');
}

{
  const f = createFixture();
  try {
    git(f.repo, 'checkout', '-b', 'feature-test');
    const result = runRelease(f.repo, 'patch');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected exactly "main"/i);
    assertVersionUnchanged(f.repo);
  } finally { f.cleanup(); }
}

{
  const f = createFixture();
  try {
    fs.appendFileSync(path.join(f.repo, 'test-script.js'), '// dirty\n');
    const result = runRelease(f.repo, 'patch');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /working tree is not clean/i);
    assertVersionUnchanged(f.repo);
  } finally { f.cleanup(); }
}

{
  const f = createFixture();
  try {
    const result = runRelease(f.repo, 'banana');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid release type/i);
    assertVersionUnchanged(f.repo);
  } finally { f.cleanup(); }
}

{
  const f = createFixture({ testsPass: false });
  try {
    const result = runRelease(f.repo, 'patch');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /npm test failed/i);
    assertVersionUnchanged(f.repo);
  } finally { f.cleanup(); }
}

{
  const f = createFixture();
  try {
    const result = runRelease(f.repo, 'patch');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Release v1\.2\.4 pushed successfully/);

    const pkg = readPackage(f.repo);
    const lock = JSON.parse(fs.readFileSync(path.join(f.repo, 'package-lock.json'), 'utf8'));
    const server = JSON.parse(fs.readFileSync(path.join(f.repo, 'server.json'), 'utf8'));
    const versionTs = fs.readFileSync(path.join(f.repo, 'src', 'version.ts'), 'utf8');

    assert.equal(pkg.version, '1.2.4');
    assert.equal(lock.version, '1.2.4');
    assert.equal(lock.packages[''].version, '1.2.4');
    assert.equal(server.version, '1.2.4');
    assert.match(versionTs, /VERSION = '1\.2\.4'/);
    assert.equal(git(f.repo, 'log', '-1', '--pretty=%s'), 'release: v1.2.4');
    assert.equal(git(f.repo, 'tag', '--points-at', 'HEAD'), 'v1.2.4');
    assert.match(git(f.repo, 'ls-remote', '--tags', 'origin', 'refs/tags/v1.2.4'), /refs\/tags\/v1\.2\.4/);
    assert.match(git(f.repo, 'ls-remote', 'origin', 'refs/heads/main'), /refs\/heads\/main/);
  } finally { f.cleanup(); }
}

{
  const f = createFixture();
  try {
    const missingRemote = path.join(f.root, 'missing-remote.git');
    git(f.repo, 'remote', 'set-url', 'origin', missingRemote);
    const result = runRelease(f.repo, 'patch');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /local release commit and tag v1\.2\.4 already exist/i);
    assert.match(result.stderr, /git push --atomic origin main v1\.2\.4/);
    assert.equal(readPackage(f.repo).version, '1.2.4');
    assert.equal(git(f.repo, 'log', '-1', '--pretty=%s'), 'release: v1.2.4');
    assert.equal(git(f.repo, 'tag', '--points-at', 'HEAD'), 'v1.2.4');
  } finally { f.cleanup(); }
}

{
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'publish.yml'), 'utf8');
  assert.match(workflow, /push:\s*\n\s*tags:\s*\n\s*- ['"]v\*['"]/);
  assert.doesNotMatch(workflow, /branches:/);
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /npm publish --access public/);
}

console.log('One-command release flow tests passed');
