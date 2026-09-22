import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  Pm2DeviceService,
  SystemdUserDeviceService,
  chooseLinuxManager
} from '../dist/device/linux-service.js';

async function testManagerChoicePromptsEveryInstall() {
  let asks = 0;
  const ask = async () => {
    asks += 1;
    return asks === 1 ? '' : 'pm2';
  };
  assert.equal(await chooseLinuxManager({ ask }), 'systemd');
  assert.equal(await chooseLinuxManager({ ask }), 'pm2');
  assert.equal(asks, 2);
}

async function testSystemdUserLifecycleUsesOwnedUnitWithoutSecrets() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-systemd-'));
  const unitPath = path.join(root, 'mcp-device.service');
  const calls = [];
  let enabled = false;
  let active = false;
  const execFile = async (file, args) => {
    calls.push({ file, args });
    const joined = args.join(' ');
    if (joined.includes('enable --now')) { enabled = true; active = true; }
    if (joined.includes('--user stop mcp-device.service')) active = false;
    if (joined.includes('disable --now')) { enabled = false; active = false; }
    if (joined.includes('is-enabled')) return { stdout: enabled ? 'enabled\n' : 'disabled\n', stderr: '' };
    if (joined.includes('is-active')) return { stdout: active ? 'active\n' : 'inactive\n', stderr: '' };
    return { stdout: '', stderr: '' };
  };
  const service = new SystemdUserDeviceService({
    platform: 'linux',
    execFile,
    unitPath,
    nodePath: '/usr/bin/node',
    entrypoint: '/opt/mcp-device/dist/mcp-device.js',
    pathValue: '/usr/local/bin:/usr/bin:/bin',
    runtimeDir: path.join(root, 'runtime')
  });
  try {
    await service.install();
    const unit = await fs.readFile(unitPath, 'utf8');
    assert.match(unit, /ExecStart=\/usr\/bin\/node \/opt\/mcp-device\/dist\/mcp-device\.js --service --manager=systemd/);
    assert.match(unit, /Environment="PATH=\/usr\/local\/bin:\/usr\/bin:\/bin"/);
    assert.match(unit, new RegExp(`WorkingDirectory=${path.join(root, 'runtime').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.doesNotMatch(unit, /proxy|bearer|token|private.?key/i);
    assert(calls.some(call => call.args.join(' ').includes('--user daemon-reload')));
    assert(calls.some(call => call.args.join(' ').includes('--user enable --now mcp-device.service')));
    assert.deepEqual(await service.status(), { installed: true, running: true, autostart: true, manager: 'systemd' });
    await service.stop();
    assert.deepEqual(await service.status(), { installed: true, running: false, autostart: true, manager: 'systemd' });
    await service.uninstall();
    await assert.rejects(fs.readFile(unitPath, 'utf8'), /ENOENT/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testSystemdLeavesLookalikeUnitUntouched() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-systemd-lookalike-'));
  const unitPath = path.join(root, 'mcp-device.service');
  const calls = [];
  const unrelated = '[Unit]\nDescription=Unrelated\n[Service]\nExecStart=/bin/echo unrelated\n';
  await fs.writeFile(unitPath, unrelated);
  const service = new SystemdUserDeviceService({
    platform: 'linux',
    execFile: async (file, args) => { calls.push({ file, args }); return { stdout: '', stderr: '' }; },
    unitPath,
    nodePath: '/usr/bin/node',
    entrypoint: '/opt/mcp-device/dist/mcp-device.js'
  });
  try {
    await assert.rejects(() => service.install(), /not owned|ownership conflict/i);
    await assert.rejects(() => service.uninstall(), /not owned|ownership conflict/i);
    assert.equal(await fs.readFile(unitPath, 'utf8'), unrelated);
    assert.equal(calls.some(call => call.args.includes('enable') || call.args.includes('disable')), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testPm2PreflightFailsBeforeMutationWhenUnavailableOrStartupUnproven() {
  const unavailableCalls = [];
  const unavailable = new Pm2DeviceService({
    platform: 'linux',
    pm2Path: '/usr/bin/pm2',
    execFile: async (file, args) => {
      unavailableCalls.push({ file, args });
      throw new Error('not found');
    },
    nodePath: '/usr/bin/node',
    entrypoint: '/opt/mcp-device/dist/mcp-device.js',
    user: 'alice',
    pm2Home: '/home/alice/.pm2'
  });
  await assert.rejects(() => unavailable.install(), /PM2.*not available|systemd.*alternative/i);
  assert.equal(unavailableCalls.some(call => call.args.includes('start')), false);

  const calls = [];
  const unproven = new Pm2DeviceService({
    platform: 'linux',
    pm2Path: '/usr/bin/pm2',
    execFile: async (file, args) => {
      calls.push({ file, args });
      if (file === '/usr/bin/pm2' && args[0] === '--version') return { stdout: '6.0.0\n', stderr: '' };
      if (file === 'systemctl' && args[0] === 'show') throw new Error('unit missing');
      return { stdout: '', stderr: '' };
    },
    nodePath: '/usr/bin/node',
    entrypoint: '/opt/mcp-device/dist/mcp-device.js',
    user: 'alice',
    pm2Home: '/home/alice/.pm2'
  });
  await assert.rejects(() => unproven.install(), /pm2 startup|systemd.*alternative/i);
  assert.equal(calls.some(call => fileIsPm2(call.file) && call.args[0] === 'start'), false);
}

function fileIsPm2(file) {
  return String(file).endsWith('/pm2') || String(file).endsWith('\\pm2') || file === 'pm2';
}

async function testPm2LookalikeProcessIsNeverMutated() {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-pm2-lookalike-'));
  const calls = [];
  const execFile = async (file, args) => {
    calls.push({ file, args });
    if (file === '/usr/bin/pm2' && args[0] === '--version') return { stdout: '6.0.0\n', stderr: '' };
    if (file === 'systemctl' && args[0] === 'show') {
      return { stdout: 'FragmentPath=/etc/systemd/system/pm2-alice.service\nExecStart=/usr/bin/pm2 resurrect\nEnvironment=PM2_HOME=/home/alice/.pm2\n', stderr: '' };
    }
    if (file === '/usr/bin/pm2' && args[0] === 'jlist') {
      return { stdout: JSON.stringify([{ name: 'mcp-device', pm2_env: { status: 'online', pm_exec_path: '/opt/other/app.js', exec_interpreter: '/usr/bin/node', args: [] } }]), stderr: '' };
    }
    return { stdout: '', stderr: '' };
  };
  const service = new Pm2DeviceService({
    platform: 'linux',
    pm2Path: '/usr/bin/pm2',
    execFile,
    nodePath: '/usr/bin/node',
    entrypoint: '/opt/mcp-device/dist/mcp-device.js',
    user: 'alice',
    pm2Home: '/home/alice/.pm2',
    runtimeDir
  });
  await assert.rejects(() => service.install(), /not owned|ownership conflict/i);
  await assert.rejects(() => service.stop(), /not owned|ownership conflict/i);
  await assert.rejects(() => service.uninstall(), /not owned|ownership conflict/i);
  assert.equal(calls.some(call => ['start', 'stop', 'delete', 'save'].includes(call.args[0])), false);
  await fs.rm(runtimeDir, { recursive: true, force: true });
}

async function testPm2LifecycleRequiresMatchingStartupEvidenceAndSavesState() {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-pm2-runtime-'));
  const calls = [];
  let online = false;
  let present = false;
  const execFile = async (file, args) => {
    calls.push({ file, args });
    if (file === '/usr/bin/pm2' && args[0] === '--version') return { stdout: '6.0.0\n', stderr: '' };
    if (file === 'systemctl' && args[0] === 'show') {
      return { stdout: 'FragmentPath=/etc/systemd/system/pm2-alice.service\nExecStart={ path=/usr/bin/pm2 ; argv[]=/usr/bin/pm2 resurrect ; }\nEnvironment=PM2_HOME=/home/alice/.pm2\n', stderr: '' };
    }
    if (file === '/usr/bin/pm2' && args[0] === 'start') { present = true; online = true; return { stdout: '', stderr: '' }; }
    if (file === '/usr/bin/pm2' && args[0] === 'stop') { online = false; return { stdout: '', stderr: '' }; }
    if (file === '/usr/bin/pm2' && args[0] === 'delete') { present = false; online = false; return { stdout: '', stderr: '' }; }
    if (file === '/usr/bin/pm2' && args[0] === 'jlist') {
      return { stdout: JSON.stringify(present ? [{ name: 'mcp-device', pm2_env: { status: online ? 'online' : 'stopped', pm_exec_path: '/opt/mcp-device/dist/mcp-device.js', exec_interpreter: '/usr/bin/node', args: ['--service', '--manager=pm2'] } }] : []), stderr: '' };
    }
    return { stdout: '', stderr: '' };
  };
  const service = new Pm2DeviceService({
    platform: 'linux',
    pm2Path: '/usr/bin/pm2',
    execFile,
    nodePath: '/usr/bin/node',
    entrypoint: '/opt/mcp-device/dist/mcp-device.js',
    user: 'alice',
    pm2Home: '/home/alice/.pm2',
    runtimeDir
  });
  await service.install();
  assert(calls.some(call => call.file === '/usr/bin/pm2' && call.args[0] === 'start' && call.args.includes('--manager=pm2')));
  assert(calls.some(call => call.file === '/usr/bin/pm2' && call.args[0] === 'start' && call.args.includes('--cwd') && call.args.includes(runtimeDir)));
  assert(calls.some(call => call.file === '/usr/bin/pm2' && call.args[0] === 'save'));
  assert.deepEqual(await service.status(), { installed: true, running: true, autostart: true, manager: 'pm2' });
  await service.stop();
  assert.deepEqual(await service.status(), { installed: true, running: false, autostart: true, manager: 'pm2' });
  await service.uninstall();
  assert(calls.filter(call => call.file === '/usr/bin/pm2' && call.args[0] === 'save').length >= 2);
  assert.deepEqual(await service.status(), { installed: false, running: false, autostart: true, manager: 'pm2' });
  await fs.rm(runtimeDir, { recursive: true, force: true });
}

await testManagerChoicePromptsEveryInstall();
await testSystemdUserLifecycleUsesOwnedUnitWithoutSecrets();
await testSystemdLeavesLookalikeUnitUntouched();
await testPm2PreflightFailsBeforeMutationWhenUnavailableOrStartupUnproven();
await testPm2LookalikeProcessIsNeverMutated();
await testPm2LifecycleRequiresMatchingStartupEvidenceAndSavesState();
console.log('Linux MCP Device service tests passed');
