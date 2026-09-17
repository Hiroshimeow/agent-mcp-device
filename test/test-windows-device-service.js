import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  WindowsDeviceService,
  buildWindowsTaskName,
  buildWindowsRunnerScript
} from '../dist/device/windows-service.js';

function testDeterministicTaskNameAndRunnerAreSecretFree() {
  assert.equal(buildWindowsTaskName('device_1'), 'MCP-Device-device_1');
  const script = buildWindowsRunnerScript({
    gatewayUrl: 'https://mcp.example.test',
    nodePath: 'C:\\Program Files\\nodejs\\node.exe',
    entrypoint: 'C:\\Program Files\\hcu-device\\dist\\index.js'
  });
  assert(!script.includes('mcp.example.test'));
  assert(!script.includes('MCP_GATEWAY_URL'));
  assert(!script.includes('MCP_GATEWAY_ALLOWED_ROOTS'));
  assert(script.includes(' --service'));
  assert(!script.includes(' remote'));
  assert(!/enrollment|pairing_grant|private_key|bearer/i.test(script));
}

async function testLifecycleUsesOneTaskAndRemovesRunner() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-service-'));
  const calls = [];
  const execFile = async (file, args) => {
    calls.push({ file, args });
    if (file.toLowerCase().includes('powershell') && args.join(' ').includes('Get-ScheduledTask')) {
      return { stdout: 'Ready\n', stderr: '' };
    }
    return { stdout: '', stderr: '' };
  };
  const service = new WindowsDeviceService({
    platform: 'win32',
    execFile,
    runnerPath: path.join(root, 'run-device.ps1'),
    nodePath: 'C:\\node.exe',
    entrypoint: 'C:\\dc\\dist\\index.js'
  });
  await service.install({ deviceId: 'device-test', gatewayUrl: 'https://gateway.example.test' });
  const runner = await fs.readFile(path.join(root, 'run-device.ps1'), 'utf8');
  assert(!runner.includes('https://gateway.example.test'));
  assert(calls.some(call => call.file.toLowerCase().includes('schtasks') && call.args.includes('/Create')));
  assert(calls.some(call => call.args.includes('MCP-Device-device-test')));
  assert(calls.some(call => call.args.includes('HCU-Device-device-test')), 'legacy registration must be removed during migration');
  await service.start('device-test');
  await service.stop('device-test');
  const status = await service.status('device-test');
  assert.deepEqual(status, { installed: true, running: false, autostart: true, registration: 'task', taskName: 'MCP-Device-device-test' });
  await service.uninstall('device-test');
  await assert.rejects(fs.readFile(path.join(root, 'run-device.ps1'), 'utf8'), /ENOENT/);
  assert(calls.some(call => call.file.toLowerCase().includes('schtasks') && call.args.includes('/Delete')));
  await fs.rm(root, { recursive: true, force: true });
}

async function testSchTasksAccessDeniedFallsBackToUserRunKey() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-service-fallback-'));
  const calls = [];
  let processChecks = 0;
  const execFile = async (file, args) => {
    calls.push({ file, args });
    const joined = args.join(' ');
    if (file.toLowerCase().includes('schtasks') && args.includes('/Create')) {
      const error = new Error('Command failed');
      error.stderr = 'ERROR: Access is denied.';
      throw error;
    }
    if (file.toLowerCase().includes('schtasks')) {
      const error = new Error('Command failed');
      error.stderr = 'ERROR: The system cannot find the file specified.';
      throw error;
    }
    if (file.toLowerCase().includes('powershell') && joined.includes('Get-ScheduledTask')) {
      throw new Error('task missing');
    }
    if (file.toLowerCase().includes('reg.exe') && args[0] === 'query') {
      return { stdout: 'MCP-Device-device-fallback    REG_SZ    powershell.exe', stderr: '' };
    }
    if (file.toLowerCase().includes('powershell') && joined.includes('Get-CimInstance Win32_Process') && joined.includes("'Running'")) {
      processChecks += 1;
      return { stdout: processChecks === 1 ? 'Stopped\n' : 'Running\n', stderr: '' };
    }
    return { stdout: '', stderr: '' };
  };
  const service = new WindowsDeviceService({
    platform: 'win32',
    execFile,
    runnerPath: path.join(root, 'run-device.ps1'),
    nodePath: 'C:\\node.exe',
    entrypoint: 'C:\\dc\\dist\\index.js'
  });

  await service.install({ deviceId: 'device-fallback', gatewayUrl: 'https://gateway.example.test' });
  assert(calls.some(call => call.file.toLowerCase().includes('reg.exe') && call.args[0] === 'add'));
  await service.start('device-fallback');
  assert(calls.some(call => call.file.toLowerCase().includes('powershell') && call.args.join(' ').includes('Start-Process')));
  const status = await service.status('device-fallback');
  assert.deepEqual(status, { installed: true, running: true, autostart: true, registration: 'run', taskName: 'MCP-Device-device-fallback' });
  await assert.rejects(service.stop('device-fallback'), /refusing PID-only termination/i);
  assert.equal(calls.some(call => call.args.join(' ').includes('taskkill.exe')), false);
  await service.uninstall('device-fallback');
  assert(calls.some(call => call.file.toLowerCase().includes('reg.exe') && call.args[0] === 'delete'));
  await fs.rm(root, { recursive: true, force: true });
}

async function testManualModeKeepsRunnerAndStartsDirectly() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-service-manual-'));
  const calls = [];
  const runnerPath = path.join(root, 'run-device.ps1');
  let taskExists = false;
  let runEntryExists = false;
  let running = false;
  const execFile = async (file, args) => {
    calls.push({ file, args });
    const lower = file.toLowerCase();
    const joined = args.join(' ');
    if (lower.includes('schtasks') && args.includes('/Create')) { taskExists = true; return { stdout: '', stderr: '' }; }
    if (lower.includes('schtasks') && args.includes('/Delete')) { taskExists = false; return { stdout: '', stderr: '' }; }
    if (lower.includes('schtasks') && args.includes('/Run')) {
      if (!taskExists) { const error = new Error('missing'); error.stderr = 'does not exist'; throw error; }
      running = true; return { stdout: '', stderr: '' };
    }
    if (lower.includes('schtasks') && args.includes('/End')) { running = false; return { stdout: '', stderr: '' }; }
    if (lower.includes('reg.exe') && args[0] === 'query') {
      if (!runEntryExists) throw new Error('missing');
      return { stdout: 'entry', stderr: '' };
    }
    if (lower.includes('reg.exe') && args[0] === 'add') { runEntryExists = true; return { stdout: '', stderr: '' }; }
    if (lower.includes('reg.exe') && args[0] === 'delete') { runEntryExists = false; return { stdout: '', stderr: '' }; }
    if (lower.includes('powershell') && joined.includes('Get-ScheduledTask')) {
      if (!taskExists) throw new Error('task missing');
      return { stdout: running ? 'Running\n' : 'Ready\n', stderr: '' };
    }
    if (lower.includes('powershell') && joined.includes("'Running'")) return { stdout: running ? 'Running\n' : 'Stopped\n', stderr: '' };
    if (lower.includes('powershell') && joined.includes('Start-Process')) { running = true; return { stdout: '', stderr: '' }; }
    if (lower.includes('powershell') && joined.includes('taskkill.exe')) { running = false; return { stdout: '', stderr: '' }; }
    return { stdout: '', stderr: '' };
  };
  const service = new WindowsDeviceService({ platform: 'win32', execFile, runnerPath, nodePath: 'C:\\node.exe', entrypoint: 'C:\\dc\\dist\\index.js' });
  await service.install({ deviceId: 'device-manual', gatewayUrl: 'https://gateway.example.test' });
  await service.setAutostart('device-manual', false);
  let status = await service.status('device-manual');
  assert.deepEqual(status, { installed: true, running: false, autostart: false, registration: 'manual', taskName: 'MCP-Device-device-manual' });
  await service.start('device-manual');
  assert(calls.some(call => call.file.toLowerCase().includes('powershell') && call.args.join(' ').includes('Start-Process')));
  status = await service.status('device-manual');
  assert.equal(status.running, true);
  await service.setAutostart('device-manual', true);
  status = await service.status('device-manual');
  assert.equal(status.autostart, true);
  await service.setAutostart('device-manual', false);
  assert.equal(await fs.readFile(runnerPath, 'utf8').then(() => true), true);
  await fs.rm(root, { recursive: true, force: true });
}

async function testUnrelatedLookalikeLegacyRegistrationIsUntouched() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-service-legacy-lookalike-'));
  const runnerPath = path.join(root, 'run-device.ps1');
  const legacyRunnerPath = path.join(root, 'legacy-run-device.ps1');
  const calls = [];
  const execFile = async (file, args) => {
    calls.push({ file, args });
    const joined = args.join(' ');
    if (file.toLowerCase().includes('powershell') && joined.includes('Get-ScheduledTask')) {
      if (joined.includes('HCU-Device-device-lookalike') && joined.includes('.Actions')) {
        return { stdout: 'powershell.exe -File C:\\unrelated\\run-device.ps1\n', stderr: '' };
      }
      throw new Error('task missing');
    }
    if (file.toLowerCase().includes('reg.exe') && args[0] === 'query') {
      if (args.includes('HCU-Device-device-lookalike')) {
        return { stdout: 'HCU-Device-device-lookalike REG_SZ powershell.exe -File C:\\unrelated\\run-device.ps1', stderr: '' };
      }
      throw new Error('missing');
    }
    return { stdout: '', stderr: '' };
  };
  const service = new WindowsDeviceService({
    platform: 'win32',
    execFile,
    runnerPath,
    legacyRunnerPath,
    nodePath: 'C:\\node.exe',
    entrypoint: 'C:\\dc\\dist\\mcp-device.js'
  });
  try {
    await service.install({ deviceId: 'device-lookalike' });
    const legacyDeletes = calls.filter(call =>
      call.args.includes('HCU-Device-device-lookalike') &&
      ((call.file.toLowerCase().includes('schtasks') && call.args.includes('/Delete')) ||
       (call.file.toLowerCase().includes('reg.exe') && call.args[0] === 'delete'))
    );
    assert.deepEqual(legacyDeletes, [], 'same-name legacy registrations with an unrelated command must not be deleted');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testVerifiedLegacyDeletionFailureStopsMigrationBeforeNewRegistration() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-service-legacy-delete-fail-'));
  const runnerPath = path.join(root, 'run-device.ps1');
  const legacyRunnerPath = path.join(root, 'legacy-run-device.ps1');
  const calls = [];
  const execFile = async (file, args) => {
    calls.push({ file, args });
    const joined = args.join(' ');
    if (file.toLowerCase().includes('powershell') && joined.includes('Get-ScheduledTask')) {
      if (joined.includes('HCU-Device-device-delete-fail') && joined.includes('.Actions')) {
        return { stdout: `powershell.exe -File \"${legacyRunnerPath}\"\n`, stderr: '' };
      }
      throw new Error('task missing');
    }
    if (file.toLowerCase().includes('schtasks') && args.includes('/Delete') && args.includes('HCU-Device-device-delete-fail')) {
      const error = new Error('Command failed');
      error.stderr = 'ERROR: Access is denied.';
      throw error;
    }
    if (file.toLowerCase().includes('reg.exe') && args[0] === 'query') throw new Error('missing');
    return { stdout: '', stderr: '' };
  };
  const service = new WindowsDeviceService({ platform: 'win32', execFile, runnerPath, legacyRunnerPath, nodePath: 'C:\\node.exe', entrypoint: 'C:\\dc\\dist\\mcp-device.js' });
  try {
    await assert.rejects(
      () => service.install({ deviceId: 'device-delete-fail' }),
      error => /command failed/i.test(error.message) && /access is denied/i.test(String(error.stderr || ''))
    );
    assert.equal(calls.some(call => call.file.toLowerCase().includes('schtasks') && call.args.includes('/Create') && call.args.includes('MCP-Device-device-delete-fail')), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testVerifiedLegacyRegistrationIsRemoved() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-service-legacy-owned-'));
  const runnerPath = path.join(root, 'run-device.ps1');
  const legacyRunnerPath = path.join(root, 'legacy-run-device.ps1');
  const calls = [];
  const execFile = async (file, args) => {
    calls.push({ file, args });
    const joined = args.join(' ');
    if (file.toLowerCase().includes('powershell') && joined.includes('Get-ScheduledTask')) {
      if (joined.includes('HCU-Device-device-owned') && joined.includes('.Actions')) {
        return { stdout: `powershell.exe -File \"${legacyRunnerPath}\"\n`, stderr: '' };
      }
      throw new Error('task missing');
    }
    if (file.toLowerCase().includes('reg.exe') && args[0] === 'query') {
      if (args.includes('HCU-Device-device-owned')) {
        return { stdout: `HCU-Device-device-owned REG_SZ powershell.exe -File \"${legacyRunnerPath}\"`, stderr: '' };
      }
      throw new Error('missing');
    }
    return { stdout: '', stderr: '' };
  };
  const service = new WindowsDeviceService({
    platform: 'win32',
    execFile,
    runnerPath,
    legacyRunnerPath,
    nodePath: 'C:\\node.exe',
    entrypoint: 'C:\\dc\\dist\\mcp-device.js'
  });
  try {
    await service.install({ deviceId: 'device-owned' });
    assert(calls.some(call => call.file.toLowerCase().includes('schtasks') && call.args.includes('/Delete') && call.args.includes('HCU-Device-device-owned')));
    assert(calls.some(call => call.file.toLowerCase().includes('reg.exe') && call.args[0] === 'delete' && call.args.includes('HCU-Device-device-owned')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testNonWindowsRefusesLifecycle() {
  const service = new WindowsDeviceService({ platform: 'linux', execFile: async () => ({ stdout: '', stderr: '' }) });
  await assert.rejects(service.install({ deviceId: 'device-test', gatewayUrl: 'https://gateway.example.test' }), /Windows/i);
}

testDeterministicTaskNameAndRunnerAreSecretFree();
await testLifecycleUsesOneTaskAndRemovesRunner();
await testSchTasksAccessDeniedFallsBackToUserRunKey();
await testManualModeKeepsRunnerAndStartsDirectly();
await testUnrelatedLookalikeLegacyRegistrationIsUntouched();
await testVerifiedLegacyDeletionFailureStopsMigrationBeforeNewRegistration();
await testVerifiedLegacyRegistrationIsRemoved();
await testNonWindowsRefusesLifecycle();
console.log('Windows device service tests passed');
