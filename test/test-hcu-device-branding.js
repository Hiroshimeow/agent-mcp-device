import assert from 'assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.name, '@hcu/device');
assert.equal(pkg.bin?.['hcu-device'], 'dist/hcu-device.js');
assert.equal(pkg.bin?.['desktop-commander'], undefined);
assert.equal(pkg.mcpName, undefined);
assert.equal(pkg.repository?.url, 'https://github.com/Hiroshimeow/agent-mcp-device.git');

const wrapper = fs.readFileSync(new URL('../src/hcu-device.ts', import.meta.url), 'utf8');
assert.match(wrapper, /splice\(2,\s*0,\s*['\"]remote['\"]\)/);

const helpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hcu-device-help-'));
try {
  const result = spawnSync(process.execPath, ['dist/hcu-device.js', '--help'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    timeout: 5000,
    env: {
      ...process.env,
      HOME: helpHome,
      USERPROFILE: helpHome,
      MCP_GATEWAY_URL: ''
    }
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `help exited ${result.status}: ${result.stderr || result.stdout}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /Usage:\s+hcu-device/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Starting HCU Device/);
} finally {
  fs.rmSync(helpHome, { recursive: true, force: true });
}

console.log('HCU device package identity test passed');
