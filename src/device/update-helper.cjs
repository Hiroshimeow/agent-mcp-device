'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { execFile } = require('child_process');

const statePath = process.argv[2];
const HANDOFF_WAIT_MS = 120000;
const PID_WAIT_MS = 30000;
const PACKAGE_UNLOCK_WAIT_MS = 20000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function run(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

async function exists(filePath) {
  try { await fsp.access(filePath); return true; } catch { return false; }
}

async function readState() {
  return JSON.parse(await fsp.readFile(statePath, 'utf8'));
}

async function writeState(patch) {
  const current = await readState();
  const next = Object.assign({}, current, patch, { updatedAt: Date.now() });
  const tmp =
    statePath + '.' + process.pid + '.' + Date.now() + '.' +
    crypto.randomBytes(6).toString('hex') + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await fsp.rename(tmp, statePath);
  try { await fsp.chmod(statePath, 0o600); } catch {}
  return next;
}

function isAlive(pid) {
  if (!pid || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await exists(filePath)) return true;
    await sleep(100);
  }
  return await exists(filePath);
}

async function waitForPids(pids, timeoutMs) {
  const filtered = pids.filter(pid => Number.isInteger(pid) && pid > 0);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (filtered.every(pid => !isAlive(pid))) return true;
    await sleep(100);
  }
  return filtered.every(pid => !isAlive(pid));
}

async function stopManager(state) {
  if (state.managerKind === 'windows-task') {
    // The update helper runs in a separate task, so ending the original device
    // task cannot terminate the helper itself. "not running" is harmless.
    await run(state.schtasksPath, ['/End', '/TN', state.windowsTaskName]).catch(() => {});
  } else if (state.managerKind === 'systemd') {
    await run(state.systemctlPath, ['--user', 'stop', state.systemdUnit]);
  } else if (state.managerKind === 'pm2') {
    await run(state.pm2Path, ['stop', state.pm2Name]);
  }
}

async function startWindowsRunner(state) {
  if (state.managerKind === 'windows-task') {
    await run(state.schtasksPath, ['/Run', '/TN', state.windowsTaskName]);
    return;
  }

  const escapePs = value => "'" + String(value).replace(/'/g, "''") + "'";
  const command =
    'Start-Process -FilePath ' + escapePs(state.powershellPath) +
    " -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File'," +
    escapePs(state.windowsRunnerPath) + ') -WindowStyle Hidden';
  await run(state.powershellPath, ['-NoProfile', '-NonInteractive', '-Command', command]);
}

async function startManager(state) {
  if (String(state.managerKind).startsWith('windows-')) {
    await startWindowsRunner(state);
    return;
  }
  if (state.managerKind === 'systemd') {
    await run(state.systemctlPath, ['--user', 'start', state.systemdUnit]);
    return;
  }
  if (state.managerKind === 'pm2') {
    await run(state.pm2Path, ['restart', state.pm2Name]);
    await run(state.pm2Path, ['save']);
    return;
  }
  throw new Error('Unsupported manager kind: ' + state.managerKind);
}

async function renameWithRetry(source, target, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      await fsp.rename(source, target);
      return;
    } catch (error) {
      lastError = error;
      const code = String(error && error.code || '');
      if (!['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(code)) throw error;
      await sleep(150);
    }
  }
  throw lastError || new Error('Timed out waiting for package directory to unlock.');
}

async function packageVersion(packageRoot) {
  try {
    const manifest = JSON.parse(await fsp.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    return String(manifest.version || '');
  } catch {
    return '';
  }
}

async function assertRuntimeOwnerReleased(state) {
  const controlPath = String(state.runtimeOwnerControlPath || '');
  if (!controlPath) {
    const failure = new Error('Runtime owner control path is missing from update state.');
    failure.code = 'DEVICE_UPDATE_RUNTIME_OWNER_UNVERIFIED';
    throw failure;
  }
  let control;
  try {
    control = JSON.parse(await fsp.readFile(controlPath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    const failure = new Error('Unable to verify MCP Device runtime ownership release.');
    failure.code = 'DEVICE_UPDATE_RUNTIME_OWNER_UNVERIFIED';
    throw failure;
  }

  const endpoint = String(control && control.endpoint || '');
  if (!endpoint) {
    const failure = new Error('Runtime owner control state has no endpoint; refusing package replacement.');
    failure.code = 'DEVICE_UPDATE_RUNTIME_OWNER_UNVERIFIED';
    throw failure;
  }

  const active = await new Promise(resolve => {
    const socket = net.createConnection(endpoint);
    let data = '';
    let settled = false;
    let connected = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setEncoding('utf8');
    socket.setTimeout(800, () => finish(connected));
    socket.once('error', () => finish(false));
    socket.on('data', chunk => { data += chunk; });
    socket.once('end', () => {
      try {
        const parsed = JSON.parse(data);
        finish(parsed && parsed.ok === true && parsed.status && parsed.status.product === 'MCP Device');
      } catch {
        // A live endpoint with an unreadable response is not safe to replace.
        finish(true);
      }
    });
    socket.once('connect', () => {
      connected = true;
      socket.write(JSON.stringify({ action: 'status' }) + '\n');
    });
  });

  if (active) {
    const failure = new Error('A live MCP Device runtime owner still exists; refusing package replacement.');
    failure.code = 'DEVICE_UPDATE_RUNTIME_OWNER_ACTIVE';
    throw failure;
  }

  // A stale control file is harmless. Do not delete it here: a new owner could
  // have acquired the endpoint between checks, and RuntimeOwner owns cleanup.
}

async function restoreRollback(state) {
  if (await exists(state.rollbackPath)) {
    await fsp.rm(state.packageRoot, { recursive: true, force: true }).catch(() => {});
    await fsp.rename(state.rollbackPath, state.packageRoot);
  } else {
    const current = await packageVersion(state.packageRoot);
    if (current === state.fromVersion) return;
    if (!await exists(state.rollbackSnapshot)) {
      throw new Error('Offline rollback package is unavailable.');
    }
    await fsp.rm(state.packageRoot, { recursive: true, force: true }).catch(() => {});
    await fsp.cp(state.rollbackSnapshot, state.packageRoot, {
      recursive: true,
      force: true,
      preserveTimestamps: true
    });
  }

  const restored = await packageVersion(state.packageRoot);
  if (restored !== state.fromVersion) {
    throw new Error('Rollback package verification failed: expected ' + state.fromVersion + ', got ' + (restored || 'unknown') + '.');
  }
}

async function cleanupWindowsUpdateTask(state) {
  if (!state.windowsUpdateTaskName || !state.schtasksPath) return;
  await run(state.schtasksPath, ['/Delete', '/F', '/TN', state.windowsUpdateTaskName]).catch(() => {});
}

async function main() {
  let state = await readState();

  try {
    if (!await waitForFile(state.handoffPath, HANDOFF_WAIT_MS)) {
      const error = new Error('Timed out waiting for MCP Device update handoff.');
      error.code = 'DEVICE_UPDATE_HANDOFF_TIMEOUT';
      throw error;
    }

    state = await writeState({ state: 'quiescing' });
    await stopManager(state);

    if (!await waitForPids([state.parentPid, state.childPid], PID_WAIT_MS)) {
      const error = new Error('MCP Device parent/child did not exit before update.');
      error.code = 'DEVICE_UPDATE_RUNTIME_STILL_ALIVE';
      throw error;
    }

    await assertRuntimeOwnerReleased(state);

    if (await exists(state.rollbackPath)) {
      const error = new Error('Rollback path already exists; refusing to overwrite recovery evidence.');
      error.code = 'DEVICE_UPDATE_ROLLBACK_PRESENT';
      throw error;
    }

    await renameWithRetry(state.packageRoot, state.rollbackPath, PACKAGE_UNLOCK_WAIT_MS);
    state = await writeState({ state: 'installing' });

    await run(state.nodePath, [
      state.npmCliPath,
      'install',
      '-g',
      state.targetTarball,
      '--offline',
      '--cache', state.cacheDir,
      '--prefix', state.globalPrefix,
      '--no-audit',
      '--no-fund'
    ]);

    const actual = await packageVersion(state.packageRoot);
    if (actual !== state.targetVersion) {
      const error = new Error('Installed target verification failed: expected ' + state.targetVersion + ', got ' + (actual || 'unknown') + '.');
      error.code = 'DEVICE_UPDATE_VERIFY_FAILED';
      throw error;
    }

    state = await writeState({
      state: 'installed_waiting_reconnect',
      completedAt: Date.now(),
      errorCode: null,
      message: null
    });

    await startManager(state);
    await cleanupWindowsUpdateTask(state);
    process.exit(0);
  } catch (error) {
    const code = String(error && error.code || 'DEVICE_UPDATE_FAILED').slice(0, 64);
    const message = String(error && error.message || error).slice(0, 240);

    try {
      state = await writeState({ state: 'rollback', errorCode: code, message });
      await restoreRollback(state);
      state = await writeState({
        state: 'failed',
        completedAt: Date.now(),
        errorCode: code,
        message
      });

      // Never create a second runtime while any tracked process or owner is
      // still alive. If quiescence failed, preserve bounded failure evidence
      // and leave the original runtime as the only authority.
      const trackedRuntimeAlive = [state.parentPid, state.childPid]
        .filter(pid => Number.isInteger(pid) && pid > 0)
        .some(isAlive);
      if (!trackedRuntimeAlive) {
        try {
          await assertRuntimeOwnerReleased(state);
          await startManager(state);
        } catch {
          // Failure state remains durable for the next safe/manual recovery.
        }
      }
    } catch (rollbackError) {
      await writeState({
        state: 'failed',
        completedAt: Date.now(),
        errorCode: 'DEVICE_UPDATE_ROLLBACK_FAILED',
        message: String(rollbackError && rollbackError.message || rollbackError).slice(0, 240)
      }).catch(() => {});
    }

    await cleanupWindowsUpdateTask(state).catch(() => {});
    process.exit(1);
  }
}

main().catch(() => process.exit(1));
