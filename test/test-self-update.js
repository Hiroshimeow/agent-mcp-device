import assert from 'assert';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { deviceStatePaths } from '../dist/device/device-state.js';
import {
  MCP_DEVICE_PACKAGE,
  assertDeviceStartupAllowedDuringUpdate,
  launchDeviceUpdateHelper,
  normalizeUpdateVersion,
  prepareDevicePackageUpdate,
  readDeviceUpdateState,
  reconcileDeviceUpdateAfterStart,
  resolveNpmCliPath,
  retireDeviceUpdateState,
  signalDeviceUpdateHandoff
} from '../dist/device/self-update.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_HELPER = path.resolve(__dirname, '../src/device/update-helper.cjs');

assert.equal(normalizeUpdateVersion('1.0.6'), '1.0.6');
for (const invalid of ['latest', '1.0', 'v1.0.6', '1.0.6-beta.1', '1.0.6;rm -rf /']) {
  assert.throws(() => normalizeUpdateVersion(invalid), /exact stable semantic version/i);
}

async function makePackage(prefix, version, globalRoot = path.join(prefix, 'node_modules')) {
  const packageRoot = path.join(globalRoot, '@hcu-lab.me', 'mcp-device');
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: MCP_DEVICE_PACKAGE,
    version
  }, null, 2));
  await fs.writeFile(path.join(packageRoot, 'sentinel.txt'), 'working-package');
  return packageRoot;
}

async function testUnixNpmCliSymlinkResolution() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-npm-cli-'));
  const realNpmCli = path.join(home, 'npm-cli.js');
  await fs.writeFile(realNpmCli, '// fake distro npm cli\n');

  const resolved = await resolveNpmCliPath({
    platform: 'linux',
    nodePath: path.join(home, 'node'),
    npmExecPath: path.join(home, 'missing-explicit.js'),
    execFile: async (file, args) => {
      assert.equal(file, 'which');
      assert.deepEqual(args, ['npm']);
      return { stdout: realNpmCli + '\n', stderr: '' };
    }
  });

  assert.equal(
    (await fs.realpath(resolved)).toLowerCase(),
    (await fs.realpath(realNpmCli)).toLowerCase(),
    'Unix npm resolver must accept a which/npm realpath that is npm-cli.js itself'
  );
  await fs.rm(home, { recursive: true, force: true });
}

async function testPreparedUpdateContract() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-update-contract-'));
  const paths = deviceStatePaths(home);
  const prefix = path.join(home, 'npm-prefix');
  // Exercise the common Unix npm layout: <prefix>/lib/node_modules.
  const globalRoot = path.join(prefix, 'lib', 'node_modules');
  const packageRoot = await makePackage(prefix, '1.0.5', globalRoot);
  const nodePath = process.execPath;
  const npmCliPath = path.join(home, 'npm-cli.js');
  await fs.writeFile(npmCliPath, '// fake npm cli path for injected execFile\n');

  const calls = [];
  const execFile = async (file, args) => {
    calls.push({ file, args: [...args] });
    assert.equal(file, nodePath, 'npm must execute through an absolute Node binary');
    assert.equal(args[0], npmCliPath, 'npm must execute through an absolute npm-cli.js path');

    if (args[1] === 'pack') {
      const destination = args[args.indexOf('--pack-destination') + 1];
      await fs.mkdir(destination, { recursive: true });
      await fs.writeFile(path.join(destination, 'target.tgz'), 'fake tarball');
      return { stdout: JSON.stringify([{ filename: 'target.tgz' }]), stderr: '' };
    }

    if (args[1] === 'install') {
      const verifyPrefix = args[args.indexOf('--prefix') + 1];
      const target = path.join(verifyPrefix, 'node_modules', '@hcu-lab.me', 'mcp-device');
      await fs.mkdir(target, { recursive: true });
      await fs.writeFile(path.join(target, 'package.json'), JSON.stringify({
        name: MCP_DEVICE_PACKAGE,
        version: '1.0.6'
      }));
      return { stdout: 'verified', stderr: '' };
    }

    throw new Error('Unexpected fake npm invocation: ' + args.join(' '));
  };

  const prepared = await prepareDevicePackageUpdate({
    targetVersion: '1.0.6',
    requestId: 'request-contract',
    deviceId: 'device-contract',
    childPid: 4242,
    fromVersion: '1.0.5',
    platform: 'linux',
    paths,
    nodePath,
    npmCliPath,
    packageRoot,
    globalPrefix: prefix,
    globalRoot,
    helperSourcePath: SOURCE_HELPER,
    managerOverride: { managerKind: 'pm2', pm2Path: '/usr/bin/pm2', pm2Name: 'mcp-device' },
    execFile
  });

  assert.equal(prepared.state.state, 'prepared');
  assert.equal(prepared.state.fromVersion, '1.0.5');
  assert.equal(prepared.state.targetVersion, '1.0.6');
  assert.equal(prepared.state.childPid, 4242);
  assert.equal(prepared.state.packageRoot, packageRoot);
  assert.equal(prepared.state.globalPrefix, prefix);
  assert.ok(prepared.state.helperPath.startsWith(paths.update), 'helper must live outside the package tree');
  assert.ok(prepared.state.rollbackSnapshot.startsWith(paths.update), 'offline rollback snapshot must live outside package tree');
  assert.equal(
    JSON.parse(await fs.readFile(path.join(prepared.state.rollbackSnapshot, 'package.json'), 'utf8')).version,
    '1.0.5'
  );
  assert.equal(await fs.readFile(path.join(packageRoot, 'sentinel.txt'), 'utf8'), 'working-package',
    'prepare must not mutate the running package');
  assert.deepEqual(calls.map(call => call.args[1]), ['pack', 'install'],
    'pre-stage must pack target and verify an isolated install before handoff');

  let unrefCalled = false;
  let spawnCall = null;
  await launchDeviceUpdateHelper(prepared, {
    platform: 'linux',
    paths,
    spawn: (file, args, options) => {
      spawnCall = { file, args, options };
      return { unref() { unrefCalled = true; } };
    }
  });
  assert.equal(spawnCall.file, nodePath);
  assert.deepEqual(spawnCall.args, [prepared.state.helperPath, prepared.statePath]);
  assert.equal(spawnCall.options.detached, true);
  assert.equal(unrefCalled, true);
  assert.equal((await readDeviceUpdateState(paths)).state, 'helper_started');

  await signalDeviceUpdateHandoff({ childPid: 5252 }, paths);
  const handoffState = await readDeviceUpdateState(paths);
  assert.equal(handoffState.state, 'handoff_ready');
  assert.equal(handoffState.childPid, 5252, 'handoff must persist the last observed child PID');

  const statePath = path.join(paths.update, 'update-state.json');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.state = 'installed_waiting_reconnect';
  state.completedAt = Date.now();
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));

  const reconciliation = await reconcileDeviceUpdateAfterStart('1.0.6', paths);
  assert.equal(reconciliation.action, 'success');
  assert.equal(reconciliation.state.requestId, 'request-contract');

  await retireDeviceUpdateState(reconciliation.state, paths);
  await assert.rejects(() => fs.access(paths.update), /ENOENT/);
  await fs.rm(home, { recursive: true, force: true });
}

async function runHelperCase({ failInstall, stripPath = false }) {
  const suffix = failInstall ? 'fail' : (stripPath ? 'stripped-path' : 'ok');
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-helper-' + suffix + '-'));
  const updateRoot = path.join(home, '.mcp-device', 'update');
  const prefix = path.join(home, 'prefix');
  const packageRoot = await makePackage(prefix, '1.0.5');
  const rollbackSnapshot = path.join(updateRoot, 'rollback-package');
  const helperPath = path.join(updateRoot, 'update-helper.cjs');
  const handoffPath = path.join(updateRoot, 'handoff.ready');
  const statePath = path.join(updateRoot, 'update-state.json');
  const rollbackPath = path.join(prefix, 'node_modules', '@hcu-lab.me', '.mcp-device-rollback-test');
  const fakeNpm = path.join(home, 'fake-npm.cjs');
  const runner = path.join(home, 'run-device.ps1');
  const cacheDir = path.join(updateRoot, 'npm-cache');
  const targetTarball = path.join(updateRoot, 'target.tgz');
  const powershell = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'
  );

  await fs.mkdir(updateRoot, { recursive: true });
  await fs.cp(packageRoot, rollbackSnapshot, { recursive: true, force: true });
  await fs.copyFile(SOURCE_HELPER, helperPath);
  await fs.writeFile(handoffPath, 'ready\n');
  await fs.writeFile(targetTarball, 'fake');
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(runner, 'exit 0\r\n');

  await fs.writeFile(fakeNpm, [
    "const fs = require('fs');",
    "const path = require('path');",
    "if (process.env.FAKE_NPM_FAIL === '1') process.exit(23);",
    "const root = process.env.FAKE_PACKAGE_ROOT;",
    "fs.mkdirSync(root, { recursive: true });",
    "fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({",
    "  name: '@hcu-lab.me/mcp-device',",
    "  version: process.env.FAKE_TARGET_VERSION",
    "}));",
    "fs.writeFileSync(path.join(root, 'new-version.txt'), 'installed');",
    "process.exit(0);",
    ""
  ].join('\n'));

  const state = {
    schema: 1,
    requestId: failInstall ? 'helper-fail' : 'helper-ok',
    fromVersion: '1.0.5',
    targetVersion: '1.0.6',
    state: 'handoff_ready',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    errorCode: null,
    message: null,
    deviceId: 'device-helper',
    managerKind: 'windows-manual',
    parentPid: 99999999,
    childPid: null,
    packageRoot,
    globalPrefix: prefix,
    nodePath: process.execPath,
    npmCliPath: fakeNpm,
    targetTarball,
    cacheDir,
    rollbackSnapshot,
    rollbackPath,
    helperPath,
    handoffPath,
    runtimeOwnerControlPath: path.join(home, '.mcp-device', 'runtime-control.json'),
    windowsRunnerPath: runner,
    powershellPath: powershell
  };
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [helperPath, statePath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(stripPath ? { PATH: '', Path: '' } : {}),
        FAKE_PACKAGE_ROOT: packageRoot,
        FAKE_TARGET_VERSION: '1.0.6',
        FAKE_NPM_FAIL: failInstall ? '1' : '0'
      }
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', code => {
      if (code !== (failInstall ? 1 : 0) && stderr) console.error(stderr);
      resolve(code);
    });
  });

  const finalState = JSON.parse(await fs.readFile(statePath, 'utf8'));
  const finalPackage = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));

  if (failInstall) {
    assert.equal(exitCode, 1);
    assert.equal(finalState.state, 'failed');
    assert.equal(finalPackage.version, '1.0.5', 'failed install must restore old package offline');
  } else {
    assert.equal(exitCode, 0);
    assert.equal(finalState.state, 'installed_waiting_reconnect');
    assert.equal(finalPackage.version, '1.0.6');
    assert.equal(
      JSON.parse(await fs.readFile(path.join(rollbackPath, 'package.json'), 'utf8')).version,
      '1.0.5',
      'successful install must keep rollback package until reconnect confirmation'
    );
  }

  await fs.rm(home, { recursive: true, force: true });
}

async function testLifecycleScopedLaunchers() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-launchers-'));
  const paths = deviceStatePaths(home);
  await fs.mkdir(paths.update, { recursive: true });

  const baseState = {
    schema: 1,
    requestId: 'launcher-test',
    fromVersion: '1.0.6',
    targetVersion: '1.0.7',
    state: 'prepared',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    errorCode: null,
    message: null,
    deviceId: 'launcher-device',
    parentPid: 123,
    childPid: 456,
    packageRoot: 'C:\\fake\\package',
    globalPrefix: 'C:\\fake',
    nodePath: process.execPath,
    npmCliPath: 'C:\\fake\\npm-cli.js',
    targetTarball: path.join(paths.update, 'target.tgz'),
    cacheDir: path.join(paths.update, 'cache'),
    rollbackSnapshot: path.join(paths.update, 'rollback'),
    rollbackPath: 'C:\\fake\\rollback',
    helperPath: path.join(paths.update, 'update-helper.cjs'),
    handoffPath: path.join(paths.update, 'handoff.ready'),
    runtimeOwnerControlPath: path.join(paths.root, 'runtime-control.json')
  };

  const statePath = path.join(paths.update, 'update-state.json');

  const windowsState = {
    ...baseState,
    managerKind: 'windows-task',
    powershellPath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    schtasksPath: 'C:\\Windows\\System32\\schtasks.exe',
    windowsTaskName: 'MCP-Device-launcher-device',
    windowsUpdateTaskName: 'MCP-Device-Update-launcher-test'
  };
  const windowsRunner = path.join(paths.update, 'run-update.ps1');
  await fs.writeFile(statePath, JSON.stringify(windowsState, null, 2));
  await fs.writeFile(windowsRunner, 'exit 0');
  const windowsCalls = [];
  await launchDeviceUpdateHelper(
    { state: windowsState, statePath, helperRunnerPath: windowsRunner },
    {
      platform: 'win32',
      paths,
      execFile: async (file, args) => {
        windowsCalls.push({ file, args });
        return { stdout: '', stderr: '' };
      }
    }
  );
  assert.equal(windowsCalls.length, 1);
  assert.equal(windowsCalls[0].file, windowsState.powershellPath);
  const windowsCommand = windowsCalls[0].args.join(' ');
  assert.match(windowsCommand, /Register-ScheduledTask/);
  assert.match(windowsCommand, /Start-ScheduledTask/);
  assert.match(windowsCommand, /MCP-Device-Update-launcher-test/);
  assert.match(windowsCommand, /AllowStartIfOnBatteries/);
  assert.match(windowsCommand, /DontStopIfGoingOnBatteries/);
  assert.match(windowsCommand, /MultipleInstances IgnoreNew/);
  assert.doesNotMatch(windowsCommand, /New-ScheduledTaskTrigger/,
    'demand-start update helper must not retain a future replay trigger');

  const systemdState = {
    ...baseState,
    managerKind: 'systemd',
    systemdRunPath: '/usr/bin/systemd-run',
    systemctlPath: '/usr/bin/systemctl',
    systemdUnit: 'mcp-device.service',
    systemdUpdateUnit: 'mcp-device-update-launcher-test'
  };
  await fs.writeFile(statePath, JSON.stringify(systemdState, null, 2));
  const systemdCalls = [];
  await launchDeviceUpdateHelper(
    { state: systemdState, statePath },
    {
      platform: 'linux',
      paths,
      execFile: async (file, args) => {
        systemdCalls.push({ file, args });
        return { stdout: '', stderr: '' };
      }
    }
  );
  assert.deepEqual(systemdCalls, [{
    file: '/usr/bin/systemd-run',
    args: [
      '--user',
      '--collect',
      '--unit=mcp-device-update-launcher-test',
      process.execPath,
      systemdState.helperPath,
      statePath
    ]
  }]);

  await fs.rm(home, { recursive: true, force: true });
}

async function testPersistedUpdateStateRecovery() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-update-state-recovery-'));
  const paths = deviceStatePaths(home);
  await fs.mkdir(paths.update, { recursive: true });
  const statePath = path.join(paths.update, 'update-state.json');

  const baseState = {
    schema: 1,
    requestId: 'recovery-test',
    fromVersion: '1.0.6',
    targetVersion: '1.0.7',
    state: 'installing',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    errorCode: null,
    message: null,
    deviceId: 'recovery-device',
    managerKind: 'windows-manual',
    parentPid: 111,
    childPid: 222,
    packageRoot: path.join(home, 'package'),
    globalPrefix: home,
    nodePath: process.execPath,
    npmCliPath: path.join(home, 'npm-cli.js'),
    targetTarball: path.join(paths.update, 'target.tgz'),
    cacheDir: path.join(paths.update, 'cache'),
    rollbackSnapshot: path.join(paths.update, 'rollback-snapshot'),
    rollbackPath: path.join(home, 'rollback-package'),
    helperPath: path.join(paths.update, 'update-helper.cjs'),
    handoffPath: path.join(paths.update, 'handoff.ready'),
    runtimeOwnerControlPath: path.join(paths.root, 'runtime-control.json'),
    windowsRunnerPath: path.join(paths.root, 'run-device.ps1'),
    powershellPath: 'powershell.exe'
  };

  const writeState = async patch => {
    await fs.mkdir(paths.update, { recursive: true });
    await fs.writeFile(statePath, JSON.stringify({ ...baseState, ...patch }, null, 2));
  };

  await writeState({ state: 'installing', targetVersion: '1.0.7', updatedAt: Date.now() });
  await assert.rejects(
    () => assertDeviceStartupAllowedDuringUpdate('1.0.6', paths),
    error => error?.code === 'DEVICE_UPDATE_RECOVERY_IN_PROGRESS'
  );

  await writeState({
    state: 'installing',
    targetVersion: '1.0.7',
    updatedAt: Date.now() - (16 * 60 * 1000)
  });
  await assertDeviceStartupAllowedDuringUpdate('1.0.6', paths);
  let recovered = await readDeviceUpdateState(paths);
  assert.equal(recovered.state, 'failed');
  assert.equal(recovered.errorCode, 'DEVICE_UPDATE_INTERRUPTED');

  await writeState({ state: 'prepared', targetVersion: '1.0.7', updatedAt: Date.now() });
  await assertDeviceStartupAllowedDuringUpdate('1.0.6', paths);
  recovered = await readDeviceUpdateState(paths);
  assert.equal(recovered.state, 'failed');
  assert.equal(recovered.errorCode, 'DEVICE_UPDATE_INTERRUPTED');

  await writeState({ state: 'installing', targetVersion: '1.0.6', updatedAt: Date.now() });
  await assertDeviceStartupAllowedDuringUpdate('1.0.6', paths);
  const success = await reconcileDeviceUpdateAfterStart('1.0.6', paths);
  assert.equal(success.action, 'success',
    'target-version reconnect must recover success even if helper final-state write was missed');

  await writeState({
    state: 'installed_waiting_reconnect',
    targetVersion: '1.0.7',
    updatedAt: Date.now()
  });
  await assertDeviceStartupAllowedDuringUpdate('1.0.6', paths);
  recovered = await readDeviceUpdateState(paths);
  assert.equal(recovered.state, 'failed');
  assert.equal(recovered.errorCode, 'DEVICE_UPDATE_VERSION_MISMATCH');

  await fs.rm(home, { recursive: true, force: true });
}

await testUnixNpmCliSymlinkResolution();
await testPreparedUpdateContract();
await testLifecycleScopedLaunchers();
await testPersistedUpdateStateRecovery();
await runHelperCase({ failInstall: false });
await runHelperCase({ failInstall: false, stripPath: true });
await runHelperCase({ failInstall: true });

console.log('✓ Self-update pre-stage, lifecycle-isolated launchers, reconnect reconciliation, and offline rollback tests passed');
