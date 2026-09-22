import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const originalConfigDir = process.env.MCP_DEVICE_CONFIG_DIR;

const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-execution-engine-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
process.env.MCP_DEVICE_CONFIG_DIR = path.join(home, '.mcp-device');

let integration;
try {
  const { LocalExecutionEngine } = await import('../dist/device/execution-engine.js');
  integration = new LocalExecutionEngine();

  const resolved = await integration.resolveMcpConfig();
  assert(resolved, 'local built MCP child must resolve');
  const expectedRuntime = path.join(home, '.mcp-device', 'runtime');
  assert.equal(path.resolve(resolved.cwd), path.resolve(expectedRuntime),
    'child MCP cwd must be the canonical runtime directory outside the npm package tree');

  const packageDist = path.resolve(path.dirname(resolved.args[0]));
  assert(!path.resolve(resolved.cwd).startsWith(packageDist + path.sep),
    'child cwd must not live under dist/global package');

  await integration.initialize();
  const pid = integration.getChildPid();
  assert(Number.isInteger(pid) && pid > 0, 'execution engine must expose the live child MCP PID');
  process.kill(pid, 0);

  console.log('Execution-engine runtime cwd and child PID hardening passed');
} finally {
  if (integration) await integration.shutdown().catch(() => {});
  await fs.rm(home, { recursive: true, force: true });
  if (originalHome === undefined) delete process.env.HOME; else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = originalUserProfile;
  if (originalConfigDir === undefined) delete process.env.MCP_DEVICE_CONFIG_DIR; else process.env.MCP_DEVICE_CONFIG_DIR = originalConfigDir;
}

process.exit(0);
