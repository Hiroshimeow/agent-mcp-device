import assert from 'assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const versionSource = fs.readFileSync(new URL('../src/version.ts', import.meta.url), 'utf8');

assert.equal(pkg.name, '@hcu-lab.me/mcp-device');
assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
assert.match(versionSource, new RegExp(`VERSION = ['\"]${pkg.version.replace(/\\./g, '\\\\.')}['\"]`));
assert.equal(pkg.author, 'Hirohimeow');
assert.equal(pkg.bin?.['mcp-device'], 'dist/mcp-device.js');
assert.equal(pkg.bin?.md, 'dist/mcp-device.js');
assert.deepEqual(Object.keys(pkg.bin || {}).sort(), ['mcp-device', 'md']);
assert.equal(pkg.mcpName, undefined);
assert.equal(pkg.repository?.url, 'git+https://github.com/Hiroshimeow/agent-mcp-device.git');
assert.deepEqual(pkg.files, ['dist'], 'published device package must not ship upstream marketing assets');
for (const name of ['release:dry', 'release:mcp', 'release:alpha', 'release:skip-mcp', 'build:mcpb', 'validate:tools', 'open-chat', 'setup', 'setup:debug', 'remove']) {
  assert.equal(pkg.scripts?.[name], undefined, `upstream product script ${name} must not remain in MCP Device`);
}
assert.equal(pkg.scripts?.release, 'node scripts/release.js patch');
assert.equal(pkg.scripts?.['release:minor'], 'node scripts/release.js minor');
assert.equal(pkg.scripts?.['release:major'], 'node scripts/release.js major');
assert.equal(pkg.scripts?.version, 'node scripts/sync-version.js && git add src/version.ts package-lock.json');
assert.equal(pkg.scripts?.start, 'node dist/mcp-device.js');
assert.equal(pkg.scripts?.['start:debug'], 'node --inspect-brk=9229 dist/mcp-device.js');
assert.equal(pkg.scripts?.postinstall, undefined, 'MCP Device must not run install-time telemetry');
assert.equal(fs.existsSync(new URL('../scripts/release.js', import.meta.url)), true);
assert.equal(fs.existsSync(new URL('../scripts/publish-release.cjs', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../scripts/build-mcpb.cjs', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../scripts/validate-tools-sync.js', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../track-installation.js', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../src/npm-scripts/setup.ts', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../src/npm-scripts/uninstall.ts', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../src/npm-scripts/verify-ripgrep.ts', import.meta.url)), false);
assert.equal(pkg.scripts?.prepack, 'node scripts/verify-production-trust.cjs');
assert.match(pkg.scripts?.prepack || '', /verify-production-trust\.cjs/, 'prepack must fail closed when the official application CA is absent or invalid');
assert.match(pkg.scripts?.build || '', /copy-official-ca\.cjs/, 'build must copy only the independently provisioned official CA into dist');
assert.equal(fs.existsSync(new URL('../scripts/verify-production-trust.cjs', import.meta.url)), true);
assert.equal(fs.existsSync(new URL('../scripts/copy-official-ca.cjs', import.meta.url)), true);
assert.equal(fs.existsSync(new URL('../PUBLISH.md', import.meta.url)), false);

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
assert.match(readme, /^# MCP Device/m);
assert.match(readme, /The gateway owns accounts, OAuth, device ownership, MCP tool contracts, routing, and usage aggregation\. MCP Device owns local device identity, pairing, reconnect lifecycle, bounded execution, background registration, and local status\./);
assert.match(readme, /npm install -g @hcu-lab\.me\/mcp-device@1\.0\.7/);
for (const command of ['login', 'logout', 'status', 'install', 'stop', 'uninstall']) {
  assert.match(readme, new RegExp(`mcp-device ${command}\\b`));
}
assert.doesNotMatch(readme, /connects a user-owned computer|outbound connection|no inbound device port|Limited hosted access|Dashboard updates|First run and trust|Local state and|Development|Upstream execution engine/i);

const wrapper = fs.readFileSync(new URL('../src/mcp-device.ts', import.meta.url), 'utf8');
assert.match(wrapper, /splice\(2,\s*0,\s*['\"]remote['\"]\)/);


const helpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-device-help-'));
try {
  const result = spawnSync(process.execPath, ['dist/mcp-device.js', '--help'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    timeout: process.platform === 'win32' ? 20000 : 5000,
    env: {
      ...process.env,
      HOME: helpHome,
      USERPROFILE: helpHome,
      MCP_GATEWAY_URL: ''
    }
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `help exited ${result.status}: ${result.stderr || result.stdout}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /Usage:\s+mcp-device/);
  assert.match(output, /Commands:\s+start, login, logout, status, install, stop, uninstall/);
  assert.doesNotMatch(output, /\brun\b|autostart|Starting MCP Device/i);
} finally {
  fs.rmSync(helpHome, { recursive: true, force: true });
}

console.log('MCP Device package identity test passed');

