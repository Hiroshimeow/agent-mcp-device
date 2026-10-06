import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = fileURLToPath(new URL('./', import.meta.url));
const runs = JSON.parse(fs.readFileSync(`${dir}phase9-h1-xfinal-runs.json`, 'utf8'));
function run(label, command, basename) {
  const started_at = new Date().toISOString();
  const args = ['--distribution', 'Ubuntu-22.04', '--exec', 'sh', '-lc', `cd /mnt/e/git-project/wt-mcp-device-111-context && unset GIT_DIR GIT_WORK_TREE && export CONTEXT_RECORD_ACCEPTANCE=0 NO_COLOR=1 FORCE_COLOR=0 && ${command}`];
  const result = spawnSync('wsl.exe', args, { cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(`${dir}${basename}`, result.stdout || '');
  fs.writeFileSync(`${dir}${basename}.stderr.txt`, (result.stderr || '') + (result.error ? String(result.error) : ''));
  runs.push({ label, executable: 'wsl.exe', args, started_at, finished_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, stdout: `evidence/context/${basename}`, stderr: `evidence/context/${basename}.stderr.txt` });
  fs.writeFileSync(`${dir}phase9-h1-xfinal-runs.json`, JSON.stringify(runs, null, 2) + '\n');
  console.log(`${label}: exit ${result.status}`);
}
run('WSL2 corrected full suite (no inherited Git overrides)', 'node --test --test-reporter=tap "test/context/*.test.js"', 'phase9-linux-context-xfinal-verified.tap');
run('WSL2 benchmark corrected HEAD identity', 'GIT_DIR=/mnt/e/git-project/agent-mcp-device/.git/worktrees/wt-mcp-device-111-context GIT_WORK_TREE=$PWD node bench/scenarios/context.mjs evidence/context/phase9-linux-benchmark-xfinal-verified.jsonl', 'phase9-linux-benchmark-xfinal-verified.stdout.txt');
