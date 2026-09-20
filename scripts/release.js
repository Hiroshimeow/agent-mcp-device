import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_RELEASE_TYPES = new Set(['patch', 'minor', 'major']);

function commandString(command, args) {
  return [command, ...args].join(' ');
}

function run(command, args, { cwd = process.cwd(), inherit = false, shell = false, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: inherit ? undefined : 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    shell,
    env
  });
  return {
    status: result.status ?? 1,
    stdout: inherit ? '' : String(result.stdout || '').trim(),
    stderr: inherit ? '' : String(result.stderr || '').trim(),
    error: result.error || null
  };
}

function npmInvocation(args) {
  const npmExecPath = String(process.env.npm_execpath || '').trim();
  if (npmExecPath) return { command: process.execPath, args: [npmExecPath, ...args], shell: false };
  if (process.platform === 'win32') return { command: 'npm.cmd', args, shell: true };
  return { command: 'npm', args, shell: false };
}

function runNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  return run(invocation.command, invocation.args, { ...options, shell: invocation.shell });
}

function fail(message) {
  console.error(message);
  return 1;
}

export function validateReleaseType(type) {
  return VALID_RELEASE_TYPES.has(type);
}

export function runRelease(type = 'patch', { cwd = process.cwd() } = {}) {
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
  if (branch.status !== 0) return fail(branch.stderr || 'Unable to determine the current Git branch.');
  if (branch.stdout !== 'main') return fail(`Release aborted: current branch is "${branch.stdout || 'unknown'}"; expected exactly "main".`);

  const worktree = run('git', ['status', '--porcelain'], { cwd });
  if (worktree.status !== 0) return fail(worktree.stderr || 'Unable to inspect Git working tree state.');
  if (worktree.stdout) return fail('Release aborted: working tree is not clean. Commit or remove local changes before releasing.');

  if (!validateReleaseType(type)) {
    return fail(`Release aborted: invalid release type "${type}". Use patch, minor, or major.`);
  }

  console.log(`Running tests before ${type} release...`);
  const tests = runNpm(['test'], { cwd, inherit: true });
  if (tests.status !== 0) {
    return fail('Release aborted: npm test failed. No version bump, release commit, or tag was created.');
  }

  const versionResult = runNpm(['version', type], {
    cwd,
    inherit: true,
    env: { ...process.env, npm_config_message: 'release: v%s' }
  });
  if (versionResult.status !== 0) {
    return fail('Release aborted: npm version failed. Inspect the local repository before retrying.');
  }

  let version;
  try {
    version = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).version;
  } catch (error) {
    return fail(`Release created locally, but package.json could not be read: ${error.message}`);
  }

  const tag = `v${version}`;
  const tagRef = run('git', ['rev-parse', '--verify', `refs/tags/${tag}^{}`], { cwd });
  if (tagRef.status !== 0) return fail(`Release created locally, but expected tag ${tag} was not found.`);

  const headRef = run('git', ['rev-parse', 'HEAD'], { cwd });
  if (headRef.status !== 0 || tagRef.stdout !== headRef.stdout) {
    return fail(`Release created locally, but tag ${tag} does not point at the current release commit.`);
  }

  const pushArgs = ['push', '--atomic', 'origin', 'main', tag];
  console.log(`Pushing main and ${tag} atomically...`);
  const pushed = run('git', pushArgs, { cwd, inherit: true });
  if (pushed.status !== 0) {
    console.error(`Push failed. The local release commit and tag ${tag} already exist.`);
    console.error('No reset, tag deletion, recreation, or force-push was attempted.');
    console.error(`Safe retry: ${commandString('git', pushArgs)}`);
    return 1;
  }

  console.log(`Release ${tag} pushed successfully.`);
  console.log(`GitHub Actions will publish @hcu-lab.me/mcp-device@${version}.`);
  return 0;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  process.exitCode = runRelease(process.argv[2] || 'patch');
}
