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
assert.deepEqual(pkg.files, ['dist'], 'published device package must not ship upstream marketing assets');
assert.equal(pkg.publishConfig, undefined, 'publishing remains deferred and must not be configured implicitly');
for (const name of ['release', 'release:minor', 'release:major', 'release:dry', 'release:mcp', 'release:alpha', 'release:skip-mcp', 'build:mcpb', 'validate:tools', 'open-chat', 'setup', 'setup:debug', 'remove']) {
  assert.equal(pkg.scripts?.[name], undefined, `upstream product script ${name} must not remain in the HCU product`);
}
assert.equal(pkg.scripts?.start, 'node dist/hcu-device.js');
assert.equal(pkg.scripts?.['start:debug'], 'node --inspect-brk=9229 dist/hcu-device.js');
assert.equal(pkg.scripts?.postinstall, undefined, 'HCU Device must not run Desktop Commander telemetry during install');
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
assert.match(pkg.scripts?.prepack || '', /track-installation\.js/, 'prepack must prune stale legacy dist artifacts');
assert.equal(fs.existsSync(new URL('../PUBLISH.md', import.meta.url)), false);

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
assert.match(readme, /^# HCU Device/m);
assert.match(readme, /Desktop Commander/i, 'HCU README must retain upstream engine attribution');
assert.doesNotMatch(readme, /npx @wonderwhy-er\/desktop-commander@latest setup/);

const wrapper = fs.readFileSync(new URL('../src/hcu-device.ts', import.meta.url), 'utf8');
assert.match(wrapper, /splice\(2,\s*0,\s*['\"]remote['\"]\)/);

const remoteCommand = fs.readFileSync(new URL('../src/npm-scripts/remote.ts', import.meta.url), 'utf8');
const integration = fs.readFileSync(new URL('../src/remote-device/desktop-commander-integration.ts', import.meta.url), 'utf8');
assert.match(remoteCommand, /DESKTOP_COMMANDER_DISABLE_TELEMETRY\s*=\s*['\"]true['\"]/, 'HCU remote parent must disable upstream telemetry');
assert.match(integration, /DESKTOP_COMMANDER_DISABLE_TELEMETRY:\s*['\"]true['\"]/, 'spawned Desktop Commander engine must inherit the telemetry kill-switch');

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
