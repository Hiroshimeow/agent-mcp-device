import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  WindowsDeviceService,
  buildWindowsTaskName,
  buildWindowsRunnerScript
} from '../dist/remote-device/windows-service.js';

function testDeterministicTaskNameAndRunnerAreSecretFree() {
  assert.equal(buildWindowsTaskName('dc-thinkbook_1'), 'DesktopCommander-MCP-Device-dc-thinkbook_1');
  const script = buildWindowsRunnerScript({
    gatewayUrl: 'https://mcp-v2.example.test',
    allowedRoots: '["E:\\\\git-project"]',
    nodePath: 'C:\\Program Files\\nodejs\\node.exe',
    entrypoint: 'C:\\Program Files\\desktop-commander\\dist\\index.js'
  });
  assert(script.includes("$env:MCP_GATEWAY_URL = 'https://mcp-v2.example.test'"));
  assert(script.includes('MCP_GATEWAY_ALLOWED_ROOTS'));
  assert(script.includes(' remote'));
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
  await service.install({ deviceId: 'dc-test', gatewayUrl: 'https://gateway.test', allowedRoots: '["E:\\\\git-project"]' });
  const runner = await fs.readFile(path.join(root, 'run-device.ps1'), 'utf8');
  assert(runner.includes('https://gateway.test'));
  assert(calls.some(call => call.file.toLowerCase().includes('schtasks') && call.args.includes('/Create')));
  assert(calls.some(call => call.args.includes('DesktopCommander-MCP-Device-dc-test')));
  await service.start('dc-test');
  await service.stop('dc-test');
  const status = await service.status('dc-test');
  assert.deepEqual(status, { installed: true, running: false, taskName: 'DesktopCommander-MCP-Device-dc-test' });
  await service.uninstall('dc-test');
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
      return { stdout: 'DesktopCommander-MCP-Device-dc-fallback    REG_SZ    powershell.exe', stderr: '' };
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

  await service.install({ deviceId: 'dc-fallback', gatewayUrl: 'https://gateway.test', allowedRoots: '["E:/git-project"]' });
  assert(calls.some(call => call.file.toLowerCase().includes('reg.exe') && call.args[0] === 'add'));
  await service.start('dc-fallback');
  assert(calls.some(call => call.file.toLowerCase().includes('powershell') && call.args.join(' ').includes('Start-Process')));
  const status = await service.status('dc-fallback');
  assert.deepEqual(status, { installed: true, running: true, taskName: 'DesktopCommander-MCP-Device-dc-fallback' });
  await service.stop('dc-fallback');
  assert(calls.some(call => call.file.toLowerCase().includes('powershell') && call.args.join(' ').includes('taskkill.exe')));
  await service.uninstall('dc-fallback');
  assert(calls.some(call => call.file.toLowerCase().includes('reg.exe') && call.args[0] === 'delete'));
  await fs.rm(root, { recursive: true, force: true });
}

async function testNonWindowsRefusesLifecycle() {
  const service = new WindowsDeviceService({ platform: 'linux', execFile: async () => ({ stdout: '', stderr: '' }) });
  await assert.rejects(service.install({ deviceId: 'dc-test', gatewayUrl: 'https://gateway.test', allowedRoots: '[]' }), /Windows/i);
}

testDeterministicTaskNameAndRunnerAreSecretFree();
await testLifecycleUsesOneTaskAndRemovesRunner();
await testSchTasksAccessDeniedFallsBackToUserRunKey();
await testNonWindowsRefusesLifecycle();
console.log('Windows device service tests passed');
