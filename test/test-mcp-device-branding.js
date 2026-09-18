import assert from 'assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.name, '@hcu-lab.me/mcp-device');
assert.equal(pkg.version, '1.0.3');
assert.equal(pkg.author, 'Hirohimeow');
assert.equal(pkg.bin?.['mcp-device'], 'dist/mcp-device.js');
assert.equal(pkg.bin?.md, 'dist/mcp-device.js');
assert.equal(pkg.bin?.['hcu-device'], undefined);
assert.equal(pkg.bin?.['desktop-commander'], undefined);
assert.equal(pkg.mcpName, undefined);
assert.equal(pkg.repository?.url, 'https://github.com/Hiroshimeow/agent-mcp-device.git');
assert.deepEqual(pkg.files, ['dist'], 'published device package must not ship upstream marketing assets');
for (const name of ['release', 'release:minor', 'release:major', 'release:dry', 'release:mcp', 'release:alpha', 'release:skip-mcp', 'build:mcpb', 'validate:tools', 'open-chat', 'setup', 'setup:debug', 'remove']) {
  assert.equal(pkg.scripts?.[name], undefined, `upstream product script ${name} must not remain in MCP Device`);
}
assert.equal(pkg.scripts?.start, 'node dist/mcp-device.js');
assert.equal(pkg.scripts?.['start:debug'], 'node --inspect-brk=9229 dist/mcp-device.js');
assert.equal(pkg.scripts?.postinstall, undefined, 'MCP Device must not run Desktop Commander telemetry during install');
assert.equal(pkg.devDependencies?.['@anthropic-ai/mcpb'], undefined);
assert.equal(fs.existsSync(new URL('../scripts/publish-release.cjs', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../scripts/build-mcpb.cjs', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../scripts/validate-tools-sync.js', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../track-installation.js', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../setup-claude-server.js', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../uninstall-claude-server.js', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../src/npm-scripts/setup.ts', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../src/npm-scripts/uninstall.ts', import.meta.url)), false);
assert.equal(fs.existsSync(new URL('../src/npm-scripts/verify-ripgrep.ts', import.meta.url)), false);
assert.match(pkg.scripts?.prepack || '', /dist\/hcu-device\.js/, 'prepack must prune stale legacy dist artifacts');
assert.match(pkg.scripts?.prepack || '', /verify-production-trust\.cjs/, 'prepack must fail closed when the official application CA is absent or invalid');
assert.match(pkg.scripts?.build || '', /copy-official-ca\.cjs/, 'build must copy only the independently provisioned official CA into dist');
assert.equal(fs.existsSync(new URL('../scripts/verify-production-trust.cjs', import.meta.url)), true);
assert.equal(fs.existsSync(new URL('../scripts/copy-official-ca.cjs', import.meta.url)), true);
assert.equal(fs.existsSync(new URL('../PUBLISH.md', import.meta.url)), false);

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
assert.match(readme, /^# MCP Device/m);
assert.match(readme, /@hcu-lab\.me\/mcp-device/);
assert.match(readme, /npm install -g @hcu-lab\.me\/mcp-device@1\.0\.3/);
assert.match(readme, /https:\/\/device\.hcu-lab\.me/);
assert.match(readme, /https:\/\/device\.hcu-lab\.me\/dashboard/);
assert.match(readme, /https:\/\/device\.hcu-lab\.me\/pair/);
assert.match(readme, /https:\/\/device\.hcu-lab\.me\/help/);
assert.doesNotMatch(readme, /mcp-v2\.hcu-lab\.me/);
assert.doesNotMatch(readme, /protected with Windows DPAPI|DPAPI for the current user/i);
assert.match(readme, /Desktop Commander/i, 'MCP Device README must retain upstream engine attribution');
assert.match(readme, /MIT licensed/i);
assert.match(readme, /Windows.*bare `md`.*shell.*collision/i, 'Windows docs must not advertise the shell-reserved bare md alias');
assert.doesNotMatch(readme, /npx @wonderwhy-er\/desktop-commander@latest setup/);

assert.equal(fs.existsSync(new URL('../src/hcu-device.ts', import.meta.url)), false);
const wrapper = fs.readFileSync(new URL('../src/mcp-device.ts', import.meta.url), 'utf8');
assert.match(wrapper, /splice\(2,\s*0,\s*['\"]remote['\"]\)/);

const remoteCommand = fs.readFileSync(new URL('../src/npm-scripts/remote.ts', import.meta.url), 'utf8');
const integration = fs.readFileSync(new URL('../src/device/execution-engine.ts', import.meta.url), 'utf8');
assert.match(remoteCommand, /DESKTOP_COMMANDER_DISABLE_TELEMETRY\s*=\s*['\"]true['\"]/, 'MCP Device parent must disable upstream telemetry');
assert.match(integration, /DESKTOP_COMMANDER_DISABLE_TELEMETRY:\s*['\"]true['\"]/, 'spawned Desktop Commander engine must inherit the telemetry kill-switch');

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

