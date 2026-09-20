import assert from 'assert';

import {
  MCP_DEVICE_PACKAGE,
  buildWindowsRestartHelper,
  installDevicePackageUpdate,
  normalizeUpdateVersion,
  scheduleDeviceRuntimeRestart
} from '../dist/device/self-update.js';

assert.equal(normalizeUpdateVersion('1.0.5'), '1.0.5');
for (const invalid of ['latest', '1.0', 'v1.0.5', '1.0.5-beta.1', '1.0.5;rm -rf /']) {
  assert.throws(() => normalizeUpdateVersion(invalid), /exact stable semantic version/i);
}

{
  const calls = [];
  const execFile = async (file, args) => {
    calls.push({ file, args });
    if (args[0] === 'install') return { stdout: 'installed' };
    return { stdout: JSON.stringify({ dependencies: { [MCP_DEVICE_PACKAGE]: { version: '1.0.5' } } }) };
  };
  const version = await installDevicePackageUpdate('1.0.5', { platform: 'linux', execFile, npmPath: '/opt/npm' });
  assert.equal(version, '1.0.5');
  assert.deepEqual(calls[0], {
    file: '/opt/npm',
    args: ['install', '-g', '@hcu-lab.me/mcp-device@1.0.5', '--no-audit', '--no-fund']
  });
  assert.deepEqual(calls[1], {
    file: '/opt/npm',
    args: ['list', '-g', '@hcu-lab.me/mcp-device', '--depth=0', '--json']
  });
}

await assert.rejects(
  () => installDevicePackageUpdate('1.0.5', {
    platform: 'linux',
    execFile: async (_file, args) => args[0] === 'install'
      ? { stdout: '' }
      : { stdout: JSON.stringify({ dependencies: { [MCP_DEVICE_PACKAGE]: { version: '1.0.4' } } }) }
  }),
  /verification failed/i
);

assert.match(buildWindowsRestartHelper('g6-device', 1234), /MCP-Device-g6-device/);
assert.match(buildWindowsRestartHelper('g6-device', 1234), /Get-Process -Id \$oldPid/);

{
  let exitCode = null;
  scheduleDeviceRuntimeRestart({
    deviceId: 'g8',
    platform: 'linux',
    argv: ['node', 'mcp-device', '--service', '--manager=systemd'],
    delayMs: 100,
    exit: code => { exitCode = code; }
  });
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(exitCode, 75);
}

{
  let spawnCall = null;
  let unrefCalled = false;
  let exitCode = null;
  scheduleDeviceRuntimeRestart({
    deviceId: 'g6-device',
    platform: 'win32',
    argv: ['node', 'mcp-device', '--service'],
    delayMs: 100,
    spawn: (file, args, options) => {
      spawnCall = { file, args, options };
      return { unref() { unrefCalled = true; } };
    },
    exit: code => { exitCode = code; }
  });
  assert.equal(spawnCall.file, 'powershell.exe');
  assert(spawnCall.args.includes('-Command'));
  assert.equal(spawnCall.options.detached, true);
  assert.equal(unrefCalled, true);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(exitCode, 0);
}

assert.throws(
  () => scheduleDeviceRuntimeRestart({ deviceId: 'foreground', platform: 'linux', argv: ['node', 'mcp-device'] }),
  /installed background/i
);

console.log('✅ Self-update install verification and managed restart tests passed');
