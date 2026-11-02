import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = path.join(root, 'dist');

function runChild(script, loader, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-loader', pathToFileURL(loader).href, script], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

test('normal Device startup remains Core-only with a compatibility policy input', { timeout: 30000 }, async t => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'v12-device-core-first-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }));
  const loader = path.join(fixture, 'loader.mjs');
  const script = path.join(fixture, 'device.mjs');
  const gatewayChannel = pathToFileURL(path.join(dist, 'device', 'gateway-channel.js')).href;
  const inertGateway = pathToFileURL(path.join(fixture, 'inert-gateway.mjs')).href;
  const home = path.join(fixture, 'home');
  const state = path.join(home, '.mcp-device');
  await fs.writeFile(loader, `export async function resolve(specifier, context, next) { const result = await next(specifier, context); if (result.url === ${JSON.stringify(gatewayChannel)}) return { url: ${JSON.stringify(inertGateway)}, shortCircuit: true }; return result; }\n`);
  await fs.writeFile(path.join(fixture, 'inert-gateway.mjs'), `export class GatewayDeviceChannel { constructor(options) { this.options = options; } async start() { this.options.runtimeState(); } async stop() {} updateCapabilities() {} }\n`);
  await fs.writeFile(script, `
const state = ${JSON.stringify(state)};
process.env.MCP_DEVICE_CONFIG_DIR = state;
process.argv.push('--plugin-policy', 'core-first');
const fs = await import('node:fs/promises');
const path = await import('node:path');
await fs.mkdir(state, { recursive: true });
await fs.writeFile(path.join(state, 'gateway-config.json'), JSON.stringify({ version: 1, gatewayUrl: 'http://127.0.0.1:1', allowedRoots: [], proxy: { mode: 'direct' }, securityProtocolFloor: 1 }));
const { GatewayDeviceIdentity } = await import(${JSON.stringify(pathToFileURL(path.join(dist, 'device', 'gateway-identity.js')).href)});
const identity = new GatewayDeviceIdentity();
await identity.loadOrCreate();
await identity.markEnrolled();
const { MCPDevice } = await import(${JSON.stringify(pathToFileURL(path.join(dist, 'device', 'device.js')).href)});
const device = new MCPDevice();
try {
  await device.start();
  const palace = device.core.plugins.list().find(record => record.manifest.id === 'palace');
  if (palace) throw new Error('Core-first Device startup installed Palace');
  if (device.core.capabilities.includes('knowledge.search')) throw new Error('Core-first Device startup started Palace');
} finally {
  await device.shutdown();
}
`);
  const result = await runChild(script, loader, { ...process.env, HOME: home, USERPROFILE: home, MCP_DEVICE_CONFIG_DIR: state, MCP_DEVICE_PLUGIN_POLICY: 'core-first', MCP_DEVICE_SKIP_SKILL_INSTALL: '1' });
  assert.equal(result.code, 0, result.stdout + '\n' + result.stderr);
});

test('server compatibility policy validates CLI > config > environment and never provisions Palace', { timeout: 60000 }, async t => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'v12-server-policy-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }));
  const wrapper = pathToFileURL(path.join(root, 'control-plane', 'scripts', 'authenticated-mcp-wrapper.mjs')).href;
  const fixtureWrapper = path.join(fixture, 'wrapper.mjs');
  const loader = path.join(fixture, 'loader.mjs');
  await fs.writeFile(loader, `export async function resolve(specifier, context, next) { const result = await next(specifier, context); if (result.url === ${JSON.stringify(wrapper)}) return { url: ${JSON.stringify(pathToFileURL(fixtureWrapper).href)}, shortCircuit: true }; return result; }`);
  // Only replace network/account transport: CLI parsing, config loading and Core/plugin startup are real.
  await fs.writeFile(fixtureWrapper, `
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
export async function startServerRuntime({ core }) {
  const bundled = process.env.EXPECT_BUNDLED === '1';
  assert.equal(core.plugins.list().some(record => record.manifest.id === 'palace'), bundled);
  assert.equal(core.plugins.capabilities().includes('knowledge.search'), bundled);
  const server = new EventEmitter();
  setTimeout(() => server.emit('close'), 20);
  return { server, baseUrl: 'http://policy-fixture.invalid', close: () => core.close() };
}
`);
  const cases = [
    { name: 'core-default', expected: false },
    { name: 'environment', env: 'core-first', expected: false },
    { name: 'config-over-environment', env: 'bundled', config: 'core-first', expected: false },
    { name: 'legacy-cli-over-config', env: 'core-first', config: 'core-first', cli: 'bundled', expected: false },
    { name: 'cli-equals-over-config', env: 'bundled', config: 'bundled', cliEquals: 'core-first', expected: false },
    { name: 'valid-cli-over-invalid-config-env', env: 'invalid-env', config: 'invalid-config', cli: 'bundled', expected: false },
    { name: 'valid-config-over-invalid-env', env: 'invalid-env', config: 'core-first', expected: false },
    { name: 'invalid-cli-not-masked', env: 'core-first', config: 'bundled', cli: 'invalid-cli', invalid: true },
    { name: 'invalid-config-not-masked', env: 'bundled', config: 'invalid-config', invalid: true },
    { name: 'invalid-env-selected', env: 'invalid-env', invalid: true }
  ];
  for (const item of cases) {
    const state = path.join(fixture, item.name);
    const config = path.join(fixture, item.name + '.json');
    const script = path.join(fixture, item.name + '.mjs');
    await fs.writeFile(config, JSON.stringify(item.config ? { pluginPolicy: item.config } : {}));
    const args = ['--runtime-dir', state, '--config', config, ...(item.cli ? ['--plugin-policy', item.cli] : []), ...(item.cliEquals ? ['--plugin-policy=' + item.cliEquals] : [])];
    await fs.writeFile(script, `const { runPlatformCli } = await import(${JSON.stringify(pathToFileURL(path.join(dist, 'platform', 'cli.js')).href)}); await runPlatformCli('server', ${JSON.stringify(args)});`);
    const result = await runChild(script, loader, { ...process.env, MCP_DEVICE_CONFIG_DIR: state, MCP_DEVICE_PLUGIN_POLICY: item.env ?? '', EXPECT_BUNDLED: item.expected ? '1' : '0', MCP_DEVICE_SKIP_SKILL_INSTALL: '1' });
    if (item.invalid) {
      assert.notEqual(result.code, 0, item.name);
      assert.match(result.stderr, /--plugin-policy must be bundled or core-first/, item.name);
      assert.doesNotMatch(result.stdout, /server_ready/, item.name);
      continue;
    }
    assert.equal(result.code, 0, item.name + '\n' + result.stdout + '\n' + result.stderr);
    assert.match(result.stdout, /server_ready/, item.name);
  }
});
