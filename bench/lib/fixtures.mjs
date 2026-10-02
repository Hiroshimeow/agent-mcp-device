import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FIXTURE_SEED, sha256 } from './core.mjs';

function ownedProcessPids(root) {
  try {
    if (process.platform === 'win32') {
      const script = '$n=$env:MCP_BENCH_FIXTURE_ROOT; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like (\'*\'+$n+\'*\') } | ForEach-Object { $_.ProcessId }';
      const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf8',
        env: { ...process.env, MCP_BENCH_FIXTURE_ROOT: root },
      });
      return output.split(/\r?\n/).map(Number).filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
    }
    const output = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
    return output.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes(root))
      .map((line) => Number(line.split(/\s+/, 1)[0]))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

function cleanupOwnedProcesses(root) {
  const pids = ownedProcessPids(root);
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Process may have exited between discovery and cleanup.
    }
  }
  return pids;
}

function repeatedText(targetBytes, prefix) {
  const line = `${prefix}|${FIXTURE_SEED}|abcdefghijklmnopqrstuvwxyz0123456789\n`;
  return line.repeat(Math.ceil(targetBytes / Buffer.byteLength(line))).slice(0, targetBytes);
}

export async function createFixtures() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-bench-fixtures-'));
  const filesDir = path.join(root, 'files');
  const searchDir = path.join(root, 'search');
  await fs.mkdir(filesDir, { recursive: true });
  await fs.mkdir(searchDir, { recursive: true });

  const files = {};
  for (const [name, size] of [['small.txt', 4 * 1024], ['medium.txt', 1024 * 1024], ['large.txt', 16 * 1024 * 1024]]) {
    const value = repeatedText(size, `FILE:${name}`);
    const file = path.join(filesDir, name);
    await fs.writeFile(file, value);
    files[name] = { path: file, bytes: Buffer.byteLength(value), hash: sha256(value), content: value };
  }

  const fanoutSmall = [];
  const fanoutMedium = [];
  for (let i = 0; i < 32; i++) {
    const value = repeatedText(4096, `FANOUT-SMALL-${i}`);
    const file = path.join(filesDir, `fanout-small-${String(i).padStart(2, '0')}.txt`);
    await fs.writeFile(file, value);
    fanoutSmall.push({ path: file, hash: sha256(value), content: value });
  }
  for (let i = 0; i < 16; i++) {
    const value = repeatedText(256 * 1024, `FANOUT-MEDIUM-${i}`);
    const file = path.join(filesDir, `fanout-medium-${String(i).padStart(2, '0')}.txt`);
    await fs.writeFile(file, value);
    fanoutMedium.push({ path: file, hash: sha256(value), content: value });
  }

  let expectedSparse = 0;
  let expectedDense = 0;
  for (let dir = 0; dir < 20; dir++) {
    const sub = path.join(searchDir, `d${String(dir).padStart(2, '0')}`);
    await fs.mkdir(sub, { recursive: true });
    for (let fileIndex = 0; fileIndex < 20; fileIndex++) {
      const hitSparse = (dir * 20 + fileIndex) % 53 === 0;
      const denseCount = (dir + fileIndex) % 5 === 0 ? 3 : 0;
      if (hitSparse) expectedSparse++;
      expectedDense += denseCount;
      const lines = [
        `fixture ${dir}/${fileIndex}`,
        hitSparse ? 'NEEDLE_SPARSE_918273' : 'ordinary content',
        ...Array.from({ length: denseCount }, (_, i) => `NEEDLE_DENSE_445566 hit ${i}`),
      ];
      await fs.writeFile(path.join(sub, `entry-${String(fileIndex).padStart(2, '0')}.txt`), lines.join('\n') + '\n');
    }
  }
  await fs.writeFile(path.join(searchDir, 'unique-target-file.bench'), 'filename marker\n');

  const editBase = [
    'HEADER',
    'alpha ORIGINAL_TOKEN omega',
    repeatedText(512 * 1024, 'EDIT-BODY'),
    'tail ORIGINAL_TOKEN done',
  ].join('\n');
  const editFile = path.join(root, 'edit-base.txt');
  await fs.writeFile(editFile, editBase);

  const procHelper = path.join(root, 'process-helper.mjs');
  await fs.writeFile(procHelper, [
    "const [mode, ...args] = process.argv.slice(2);",
    "if (mode === 'short') { console.log(args[0]); }",
    "else if (mode === 'incremental') { const markers = args; let i = 0; const t = setInterval(() => { console.log(markers[i++]); if (i === markers.length) { clearInterval(t); setTimeout(() => process.exit(0), 80); } }, 120); }",
    "else if (mode === 'lines') { for (const marker of args) console.log(marker); }",
    "else if (mode === 'large') { const lines = Number(args[0]); for (let i = 0; i < lines; i++) { const stream = i % 2 === 0 ? process.stdout : process.stderr; stream.write((i % 2 === 0 ? 'OUT_' : 'ERR_') + String(i).padStart(6, '0') + '_' + 'x'.repeat(64) + '\\n'); } }",
    "else if (mode === 'background') { console.log(args[0] || 'BG_READY'); setInterval(() => {}, 1000); }",
    "else { console.error('unknown mode', mode); process.exit(2); }",
  ].join('\n') + '\n');

  return {
    root,
    procHelper,
    files,
    fanoutSmall,
    fanoutMedium,
    searchDir,
    expectedSparse,
    expectedDense,
    editBase,
    editFile,
    ownedProcessPids: () => ownedProcessPids(root),
    cleanupOwnedProcesses: () => cleanupOwnedProcesses(root),
    async freshEditCopy(label) {
      const destination = path.join(root, `edit-${label}.txt`);
      await fs.writeFile(destination, editBase);
      return destination;
    },
    async cleanup() {
      cleanupOwnedProcesses(root);
      let lastError = null;
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          await fs.rm(root, { recursive: true, force: true });
          return;
        } catch (error) {
          lastError = error;
          cleanupOwnedProcesses(root);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      throw lastError;
    },
  };
}
