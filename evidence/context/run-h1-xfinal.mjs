import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = fileURLToPath(new URL('./', import.meta.url));
const prefix = 'phase9-h1-xfinal';
if (fs.existsSync(`${dir}${prefix}-runs.json`)) throw new Error('Refusing to overwrite completed run');
const sha = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const tracked = git('ls-files', 'src', 'test/context', 'bench/scenarios/context.mjs', '.archive-worktrees-docs/wt-mcp-device-110-bench/bench/lib/core.mjs', 'scripts/check-context-acceptance.mjs', 'package.json', 'package-lock.json', 'tsconfig.json').split('\n');
const sources = Object.fromEntries(tracked.map(path => [path, sha(`${root}${path}`)]));
const identity = { recorded_at: new Date().toISOString(), head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), status_before: git('status', '--porcelain', '--untracked-files=all'), source_sha256: sources, windows: { node: process.version, sqlite: process.versions.sqlite, platform: process.platform, arch: process.arch }, linux_boundary: 'Ubuntu-22.04 WSL2 on same physical Windows host; same /mnt/e worktree and Windows-built dist; native /usr/bin/node. Git worktree has Windows absolute .git pointer; set GIT_DIR and GIT_WORK_TREE only in Linux shell so benchmark captures actual HEAD. No Linux install/build or independent host/Node-floor run claimed.' };
fs.writeFileSync(`${dir}${prefix}-source-identity.json`, JSON.stringify(identity, null, 2) + '\n');
const runs = [];
function run(label, executable, args, output, stderrOutput) {
  const started_at = new Date().toISOString();
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, CONTEXT_RECORD_ACCEPTANCE: '0', NO_COLOR: '1', FORCE_COLOR: '0' } });
  fs.writeFileSync(`${dir}${output}`, result.stdout || '');
  fs.writeFileSync(`${dir}${stderrOutput}`, (result.stderr || '') + (result.error ? `\n${result.error.stack}\n` : ''));
  runs.push({ label, executable, args, started_at, finished_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, error: result.error?.message ?? null, stdout: `evidence/context/${output}`, stderr: `evidence/context/${stderrOutput}` });
  fs.writeFileSync(`${dir}${prefix}-runs.json`, JSON.stringify(runs, null, 2) + '\n');
  console.log(`${label}: exit ${result.status}; ${output}`);
  if (result.status !== 0) process.exitCode = 1;
  return result.status === 0;
}
const wslRoot = '/mnt/e/git-project/wt-mcp-device-111-context';
const linux = command => ['--distribution', 'Ubuntu-22.04', '--exec', 'sh', '-lc', `cd ${wslRoot} && export GIT_DIR=/mnt/e/git-project/agent-mcp-device/.git/worktrees/wt-mcp-device-111-context GIT_WORK_TREE=$PWD CONTEXT_RECORD_ACCEPTANCE=0 NO_COLOR=1 FORCE_COLOR=0 && ${command}`];
run('WSL2 environment', 'wsl.exe', linux('uname -a; command -v node; node --version; npm --version; git rev-parse HEAD; node -p "JSON.stringify({platform:process.platform,arch:process.arch,sqlite:process.versions.sqlite})"'), `${prefix}-linux-environment.txt`, `${prefix}-linux-environment.stderr.txt`);
const built = run('Windows build', 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'], 'checkpoint3-build-xfinal.txt', 'checkpoint3-build-xfinal.stderr.txt');
if (built) {
  run('Windows full context suite', process.execPath, ['--test', '--test-reporter=tap', 'test/context/*.test.js'], 'phase9-windows-context-xfinal.tap', 'phase9-windows-context-xfinal.stderr.txt');
  run('Windows benchmark', process.execPath, ['bench/scenarios/context.mjs', 'evidence/context/phase9-windows-benchmark-xfinal.jsonl'], 'phase9-windows-benchmark-xfinal.stdout.txt', 'phase9-windows-benchmark-xfinal.stderr.txt');
  run('WSL2 full context suite', 'wsl.exe', linux('node --test --test-reporter=tap "test/context/*.test.js"'), 'phase9-linux-context-xfinal.tap', 'phase9-linux-context-xfinal.stderr.txt');
  run('WSL2 benchmark', 'wsl.exe', linux('node bench/scenarios/context.mjs evidence/context/phase9-linux-benchmark-xfinal.jsonl'), 'phase9-linux-benchmark-xfinal.stdout.txt', 'phase9-linux-benchmark-xfinal.stderr.txt');
}
run('Context acceptance consistency', process.execPath, ['scripts/check-context-acceptance.mjs'], 'phase9-speckit-consistency-xfinal.json', 'phase9-speckit-consistency-xfinal.stderr.txt');
const changed = tracked.filter(path => sources[path] !== sha(`${root}${path}`));
identity.source_unchanged_after_runs = changed.length === 0;
identity.changed_source_paths = changed;
identity.status_after_runs = git('status', '--porcelain', '--untracked-files=all');
fs.writeFileSync(`${dir}${prefix}-source-identity.json`, JSON.stringify(identity, null, 2) + '\n');
if (changed.length) throw new Error(`Source changed: ${changed.join(', ')}`);
console.log(`Source identity unchanged: ${tracked.length} tracked files`);
