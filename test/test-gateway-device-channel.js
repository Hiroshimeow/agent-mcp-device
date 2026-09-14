import assert from 'assert';
import { execFileSync } from 'child_process';
import { createPublicKey, verify } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { WebSocketServer } from 'ws';

import { GatewayDeviceChannel } from '../dist/remote-device/gateway-channel.js';
import { GatewayDeviceIdentity } from '../dist/remote-device/gateway-identity.js';
import { GatewayToolAdapter } from '../dist/remote-device/gateway-tool-adapter.js';
import { isModuleEntrypoint } from '../dist/remote-device/device.js';

const waitFor = async (predicate, timeoutMs = 4000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for condition');
};

class FakeDesktop {
  calls = [];
  async callClientTool(name, args) {
    this.calls.push({ name, args });
    if (name === 'start_process') return { content: [{ type: 'text', text: 'Process started with PID 123' }] };
    return { content: [{ type: 'text', text: `${name}:ok` }] };
  }
}

function testPm2EntrypointDetection() {
  const modulePath = path.resolve('dist/remote-device/device.js');
  const moduleUrl = pathToFileURL(modulePath).href;
  assert.equal(isModuleEntrypoint(moduleUrl, modulePath), true);
  assert.equal(isModuleEntrypoint(moduleUrl, path.resolve('node_modules/pm2/lib/ProcessContainerFork.js'), modulePath), true);
  assert.equal(isModuleEntrypoint(moduleUrl, path.resolve('other.js'), path.resolve('different.js')), false);
}

async function testIdentity() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-gateway-identity-'));
  const identityPath = path.join(root, 'identity.json');
  const identity = new GatewayDeviceIdentity(identityPath);
  const first = await identity.loadOrCreate();
  const second = await new GatewayDeviceIdentity(identityPath).loadOrCreate();
  assert.equal(first.deviceId, second.deviceId);
  assert.equal(first.publicKeyPem, second.publicKeyPem);
  assert.equal(first.privateKeyPem, second.privateKeyPem);
  const nonce = 'test-nonce';
  const signature = Buffer.from(await identity.signChallenge(nonce), 'base64');
  assert(verify(null, Buffer.from(`mcp-device-auth-v1\n${first.deviceId}\n${nonce}`), createPublicKey(first.publicKeyPem), signature));
  await fs.rm(root, { recursive: true, force: true });
}

async function testDefaultWindowsIdentityPathIsProfileBound() {
  if (process.platform !== 'win32') return;
  const previous = process.env.MCP_GATEWAY_DEVICE_IDENTITY_PATH;
  const outside = path.join(path.parse(os.homedir()).root, `dc-unsafe-identity-${process.pid}.json`);
  process.env.MCP_GATEWAY_DEVICE_IDENTITY_PATH = outside;
  assert.throws(() => new GatewayDeviceIdentity(), /desktop-commander-device/);

  const root = await fs.mkdtemp(path.join(os.homedir(), '.desktop-commander-device', `.test-${process.pid}-`));
  const inside = path.join(root, 'identity.json');
  process.env.MCP_GATEWAY_DEVICE_IDENTITY_PATH = inside;
  try {
    await new GatewayDeviceIdentity().loadOrCreate();
    const acl = execFileSync('icacls.exe', [inside], { encoding: 'utf8', windowsHide: true });
    assert.equal((acl.match(/\(F\)/g) || []).length, 3, `identity ACL must have three full-control principals: ${acl}`);
    assert(!/\((?:M|RX|R|W)\)/.test(acl), `identity ACL must not grant broad read/write/modify access: ${acl}`);
  } finally {
    if (previous === undefined) delete process.env.MCP_GATEWAY_DEVICE_IDENTITY_PATH;
    else process.env.MCP_GATEWAY_DEVICE_IDENTITY_PATH = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testAdapterDefaultsToDesktopCommanderWideAccess() {
  const desktop = new FakeDesktop();
  const previous = process.env.MCP_GATEWAY_ALLOWED_ROOTS;
  delete process.env.MCP_GATEWAY_ALLOWED_ROOTS;
  try {
    const adapter = new GatewayToolAdapter(desktop, { pathValidator: async value => value });
    await adapter.call('read_text_file', { path: '/shared/anywhere.txt' });
    assert.deepEqual(desktop.calls.at(-1), { name: 'read_file', args: { path: '/shared/anywhere.txt' } });
  } finally {
    if (previous === undefined) delete process.env.MCP_GATEWAY_ALLOWED_ROOTS;
    else process.env.MCP_GATEWAY_ALLOWED_ROOTS = previous;
  }
}

async function testAdapter() {
  const desktop = new FakeDesktop();
  const adapter = new GatewayToolAdapter(desktop, { allowedRoots: ['/work'], pathValidator: async value => value });
  await adapter.call('read_text_file', { path: '/work/x.txt', head: 3 });
  assert.deepEqual(desktop.calls.at(-1), { name: 'read_file', args: { path: '/work/x.txt', offset: 0, length: 3 } });
  await assert.rejects(adapter.call('read_text_file', { path: '/other/x.txt' }), /outside MCP_GATEWAY_ALLOWED_ROOTS/);
  await adapter.call('write_file', { path: '/work/x.txt', content: 'new' });
  assert.equal(desktop.calls.at(-1).name, 'write_file');
  await adapter.call('edit_file', { path: '/work/x.txt', old_text: 'old', new_text: 'new', expected_replacements: 1 });
  assert.deepEqual(desktop.calls.at(-1), { name: 'edit_block', args: { file_path: '/work/x.txt', old_string: 'old', new_string: 'new', expected_replacements: 1 } });
  const started = await adapter.call('start_process', { command: 'node -v', working_directory: '/work' });
  assert.equal(started.session_id, '123');
  assert.deepEqual(desktop.calls.at(-1), { name: 'start_process', args: { command: 'node -v', timeout_ms: 10000, working_directory: '/work' } });
  await assert.rejects(adapter.call('start_process', { command: 'node -v' }), /working_directory is required/);
  await adapter.call('read_process_output', { session_id: '123', offset: 2, length: 5 });
  assert.equal(desktop.calls.at(-1).name, 'read_process_output');
  assert.equal(desktop.calls.at(-1).args.pid, 123);
  await adapter.call('terminate_process', { session_id: '123' });
  assert.equal(desktop.calls.at(-1).name, 'force_terminate');
}

async function testOperatorPreEnrolledIdentityUsesAuthHello() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-gateway-preenroll-'));
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  const initial = await identity.loadOrCreate();
  assert.equal(initial.enrolled, false);
  const wss = new WebSocketServer({ port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const address = wss.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  let helloType = null;
  let authenticated = false;
  wss.on('connection', (ws, request) => {
    assert.equal(request.headers.authorization, undefined);
    ws.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'auth_hello') {
        helloType = message.type;
        assert.equal(message.payload.public_key_pem, undefined);
        ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_challenge', device_id: message.device_id, payload: { nonce: 'pre-enrolled' } }));
      } else if (message.type === 'auth_response') {
        authenticated = true;
        ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_ok', device_id: message.device_id, connection_epoch: 1, payload: { accepted: true } }));
      }
    });
  });
  const channel = new GatewayDeviceChannel({ gatewayUrl: `ws://127.0.0.1:${port}/device`, identity, adapter: { async call() { return {}; } }, agentVersion: 'test' });
  await channel.start();
  await waitFor(() => authenticated);
  assert.equal(helloType, 'auth_hello');
  assert.equal((await identity.loadOrCreate()).enrolled, true);
  await channel.stop();
  await new Promise(resolve => wss.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}

async function testChannelEnrollmentToolAndReconnect() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-gateway-channel-'));
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  const desktop = new FakeDesktop();
  const adapter = new GatewayToolAdapter(desktop, { allowedRoots: ['/work'], pathValidator: async value => value });
  const wss = new WebSocketServer({ port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const address = wss.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  let connections = 0;
  let firstToolResult = null;
  let reconnectSeen = false;

  wss.on('connection', (ws, request) => {
    connections += 1;
    const current = connections;
    if (current === 1) assert.equal(request.headers.authorization, 'Bearer enroll-once');
    if (current > 1) assert.equal(request.headers.authorization, undefined);
    let publicKeyPem = '';
    ws.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'enroll_hello' || message.type === 'auth_hello') {
        if (current === 1) {
          assert.equal(message.type, 'enroll_hello');
          publicKeyPem = message.payload.public_key_pem;
        } else {
          assert.equal(message.type, 'auth_hello');
          reconnectSeen = true;
        }
        ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_challenge', device_id: message.device_id, payload: { nonce: `nonce-${current}` } }));
        return;
      }
      if (message.type === 'auth_response') {
        if (publicKeyPem) {
          const bytes = Buffer.from(`mcp-device-auth-v1\n${message.device_id}\nnonce-${current}`);
          assert(verify(null, bytes, publicKeyPem, Buffer.from(message.payload.signature, 'base64')));
        }
        ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_ok', device_id: message.device_id, connection_epoch: current, payload: { accepted: true } }));
        if (current === 1) {
          setTimeout(() => ws.send(JSON.stringify({ protocol_version: 1, type: 'tool_call', request_id: 'req-1', device_id: message.device_id, connection_epoch: current, payload: { tool: 'read_text_file', arguments: { path: '/work/remote.txt' } } })), 20);
        }
        return;
      }
      if (message.type === 'tool_result' && message.request_id === 'req-1') {
        firstToolResult = message.payload;
        ws.close(4001, 'reconnect-test');
      }
    });
  });

  const channel = new GatewayDeviceChannel({ gatewayUrl: `ws://127.0.0.1:${port}/device`, enrollmentToken: 'enroll-once', identity, adapter, agentVersion: 'test' });
  await channel.start();
  await waitFor(() => Boolean(firstToolResult));
  assert.equal(firstToolResult.content[0].text, 'read_file:ok');
  await waitFor(() => reconnectSeen && connections >= 2, 5000);
  await channel.stop();
  await new Promise(resolve => wss.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}


async function testRejectsMismatchedAuthDevice() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-gateway-auth-device-'));
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  const wss = new WebSocketServer({ port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const address = wss.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  wss.on('connection', ws => ws.on('message', raw => {
    const message = JSON.parse(raw.toString());
    if (message.type === 'enroll_hello') {
      ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_challenge', device_id: 'wrong-device', payload: { nonce: 'mismatch' } }));
    }
  }));
  const channel = new GatewayDeviceChannel({ gatewayUrl: `ws://127.0.0.1:${port}/device`, enrollmentToken: 'enroll-once', identity, adapter: { async call() { return {}; } }, agentVersion: 'test' });
  await assert.rejects(Promise.race([channel.start(), new Promise((_, reject) => setTimeout(() => reject(new Error('auth mismatch was not rejected')), 1000))]), /device_id/i);
  assert.equal((await identity.loadOrCreate()).enrolled, false);
  await channel.stop();
  await new Promise(resolve => wss.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}

async function testRejectsStaleToolEpochAndReconnects() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-gateway-stale-epoch-'));
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  const desktop = new FakeDesktop();
  const adapter = new GatewayToolAdapter(desktop, { allowedRoots: ['/work'], pathValidator: async value => value });
  const wss = new WebSocketServer({ port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const address = wss.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  let connections = 0;
  let reconnectSeen = false;
  wss.on('connection', ws => {
    connections += 1;
    const current = connections;
    ws.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'enroll_hello' || message.type === 'auth_hello') {
        ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_challenge', device_id: message.device_id, payload: { nonce: `epoch-${current}` } }));
      } else if (message.type === 'auth_response') {
        ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_ok', device_id: message.device_id, connection_epoch: current, payload: { accepted: true } }));
        if (current === 1) {
          setTimeout(() => ws.send(JSON.stringify({ protocol_version: 1, type: 'tool_call', request_id: 'stale-1', device_id: message.device_id, connection_epoch: 0, payload: { tool: 'read_text_file', arguments: { path: '/work/remote.txt' } } })), 20);
        } else {
          reconnectSeen = true;
        }
      }
    });
  });
  const channel = new GatewayDeviceChannel({ gatewayUrl: `ws://127.0.0.1:${port}/device`, enrollmentToken: 'enroll-once', identity, adapter, agentVersion: 'test' });
  await channel.start();
  await waitFor(() => reconnectSeen && connections >= 2, 5000);
  assert.equal(desktop.calls.length, 0);
  await channel.stop();
  await new Promise(resolve => wss.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}


async function testOversizedToolResultReturnsBoundedError() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-gateway-oversize-'));
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  const adapter = { async call() { return { content: [{ type: 'text', text: 'x'.repeat(70 * 1024) }] }; } };
  const wss = new WebSocketServer({ port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const address = wss.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  let errorMessage = null;
  wss.on('connection', ws => ws.on('message', raw => {
    const message = JSON.parse(raw.toString());
    if (message.type === 'enroll_hello') ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_challenge', device_id: message.device_id, payload: { nonce: 'oversize' } }));
    else if (message.type === 'auth_response') {
      ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_ok', device_id: message.device_id, connection_epoch: 1, payload: { accepted: true } }));
      setTimeout(() => ws.send(JSON.stringify({ protocol_version: 1, type: 'tool_call', request_id: 'oversize-1', device_id: message.device_id, connection_epoch: 1, payload: { tool: 'read_text_file', arguments: { path: '/work/remote.txt' } } })), 20);
    } else if (message.type === 'tool_error') errorMessage = message.payload;
  }));
  const channel = new GatewayDeviceChannel({ gatewayUrl: `ws://127.0.0.1:${port}/device`, enrollmentToken: 'enroll-once', identity, adapter, agentVersion: 'test' });
  await channel.start();
  await waitFor(() => Boolean(errorMessage));
  assert.equal(errorMessage.code, 'DEVICE_OUTPUT_TOO_LARGE');
  await channel.stop();
  await new Promise(resolve => wss.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}

testPm2EntrypointDetection();
await testIdentity();
await testDefaultWindowsIdentityPathIsProfileBound();
await testAdapterDefaultsToDesktopCommanderWideAccess();
await testAdapter();
await testOperatorPreEnrolledIdentityUsesAuthHello();
await testChannelEnrollmentToolAndReconnect();
await testRejectsMismatchedAuthDevice();
await testRejectsStaleToolEpochAndReconnects();
await testOversizedToolResultReturnsBoundedError();
console.log('âœ… Gateway identity, adapter, enrollment, tool routing, and reconnect tests passed');
