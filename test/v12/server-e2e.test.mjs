import test from 'node:test';
import assert from 'node:assert/strict';
import { Server as NetServer } from 'node:net';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseUrl = 'http://127.0.0.1:8104';

function cookieFrom(response) {
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie, 'The ordinary account flow must issue a browser session.');
  return cookie.split(';', 1)[0];
}
function hidden(html, name) {
  const value = html.match(new RegExp('name="' + name + '" value="([^"]+)"'))?.[1];
  assert.ok(value, 'Missing authorization gate field: ' + name);
  return value;
}
async function http(route, { token, cookie, form, json, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.authorization = 'Bearer ' + token;
  if (cookie) headers.cookie = cookie;
  if (form) headers['content-type'] = 'application/x-www-form-urlencoded';
  if (json) headers['content-type'] = 'application/json';
  return fetch(baseUrl + route, {
    redirect: 'manual', signal: AbortSignal.timeout(10000), ...options, headers,
    ...(form ? { method: 'POST', body: new URLSearchParams(form) } : {}),
    ...(json ? { method: 'POST', body: JSON.stringify(json) } : {})
  });
}
let rpcId = 0;
async function rpc(token, method, params = {}, modern = false) {
  const version = modern ? '2026-07-28' : '2025-11-25';
  const headers = { accept: 'application/json, text/event-stream', 'mcp-protocol-version': version };
  if (modern) {
    headers['mcp-method'] = method;
    if (params.uri || params.name) headers['mcp-name'] = params.uri || params.name;
    params = { ...params, _meta: {
      'io.modelcontextprotocol/protocolVersion': version,
      'io.modelcontextprotocol/clientInfo': { name: 'v12-modern-acceptance', version: '1.0.0' },
      'io.modelcontextprotocol/clientCapabilities': {}
    } };
  }
  const response = await http('/mcp', {
    token, headers,
    json: { jsonrpc: '2.0', id: ++rpcId, method, params }
  });
  const body = await response.text();
  assert.equal(response.status, 200, 'MCP response status: ' + body.slice(0, 200));
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const data = body.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim());
    const messages = data.map(value => JSON.parse(value));
    return messages.find(message => message.id === rpcId);
  }
  return JSON.parse(body);
}
async function authorize(cookie) {
  const callback = baseUrl + '/fixture-callback';
  const registration = await http('/register', { json: {
    client_name: 'MCP Device v12 isolated acceptance',
    redirect_uris: [callback], token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'], response_types: ['code']
  } });
  assert.equal(registration.status, 201);
  const client = await registration.json();
  const verifier = randomBytes(32).toString('base64url');
  const params = new URLSearchParams({
    response_type: 'code', client_id: client.client_id, redirect_uri: callback,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    scope: 'mcp:tools offline_access', state: 'isolated-fixture-state', resource: baseUrl + '/mcp'
  });
  const anonymous = await http('/authorize?' + params);
  assert.equal(anonymous.status, 302);
  assert.ok(anonymous.headers.get('location').startsWith('/login'));
  const gate = await http('/authorize?' + params, { cookie });
  assert.equal(gate.status, 200);
  const html = await gate.text();
  const pending = hidden(html, 'pending'); const csrf = hidden(html, 'csrf');
  const denied = await http('/oauth/continue', { cookie, form: { pending, csrf: 'wrong-csrf' } });
  assert.equal(denied.status, 400);
  const accepted = await http('/oauth/continue', { cookie, form: { pending, csrf } });
  assert.equal(accepted.status, 302);
  const target = new URL(accepted.headers.get('location'));
  assert.equal(target.origin, baseUrl);
  assert.equal(target.searchParams.get('state'), 'isolated-fixture-state');
  const code = target.searchParams.get('code');
  assert.ok(code);
  const exchanged = await http('/token', { form: {
    grant_type: 'authorization_code', client_id: client.client_id,
    code, code_verifier: verifier, redirect_uri: callback
  } });
  assert.equal(exchanged.status, 200);
  const tokens = await exchanged.json();
  assert.ok(tokens.access_token);
  assert.ok(tokens.refresh_token);
  return { ...tokens, client_id: client.client_id };
}


async function remoteDevice(t, { deviceId, stateRoot, workspace, pluginMode = 'enabled' }) {
  const child = fork(path.join(packageRoot, 'test/v12/server-remote-child.mjs'), [
    stateRoot, workspace, baseUrl, path.join(packageRoot, 'control-plane/tests/fixtures/device-inner-tls/ca-cert.pem'), pluginMode
  ], {
    execPath: process.execPath, execArgv: [], windowsHide: true,
    env: { ...process.env, MCP_DEVICE_CONFIG_DIR: stateRoot, MCP_DEVICE_ID: deviceId },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  let sequence = 0; let stderr = '';
  const pending = new Map();
  child.stdout.resume();
  child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-4000); });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Remote Device startup timed out: ' + stderr)), 15000);
    child.on('message', message => {
      if (message.type === 'ready') { clearTimeout(timer); resolve(message); return; }
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer); pending.delete(message.id);
      if (message.ok) request.resolve(message.value);
      else request.reject(new Error(message.error));
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      const error = new Error('Remote Device exited ' + code + ': ' + stderr);
      reject(error);
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
      pending.clear();
    });
  });
  function request(type, args = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id); reject(new Error('Remote fixture command timed out: ' + type + ': ' + stderr));
      }, 10000);
      pending.set(id, { resolve, reject, timer });
      child.send({ id, type, ...args });
    });
  }
  t.after(async () => {
    if (child.exitCode !== null) return;
    try { await request('close'); } catch { child.kill(); }
  });
  const record = await ready;
  return { record, request, workspace };
}
async function pairRemote(remote, cookie) {
  const verifier = randomBytes(32).toString('base64url');
  const clientId = 'v12-remote-acceptance-' + remote.record.deviceId;
  const start = await http('/device/start', { json: {
    client_id: clientId, device_id: remote.record.deviceId, device_name: remote.record.deviceId,
    public_key_pem: remote.record.publicKeyPem,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256'
  } });
  assert.equal(start.status, 200);
  const started = await start.json();
  const pending = await http('/device/poll', { json: { device_code: started.device_code, client_id: clientId, code_verifier: verifier } });
  assert.equal(pending.status, 400);
  assert.equal((await pending.json()).error, 'authorization_pending');
  const approval = await http('/device/verify', { cookie, form: { user_code: started.user_code } });
  assert.equal(approval.status, 200);
  const wrongProof = await http('/device/poll', { json: { device_code: started.device_code, client_id: clientId, code_verifier: 'incorrect-verifier' } });
  assert.equal(wrongProof.status, 400);
  const poll = await http('/device/poll', { json: { device_code: started.device_code, client_id: clientId, code_verifier: verifier } });
  assert.equal(poll.status, 200);
  const grant = await poll.json();
  const connected = await remote.request('connect', { pairingGrant: grant.enrollment_grant });
  assert.equal(connected.protocolVersion, 2);
  assert.equal(connected.runtimeInstanceId, remote.record.runtimeInstanceId);
}
async function eventually(assertion) {
  let last;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { return assertion(); } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw last;
}

test('one server on 8104 preserves account/OAuth/pairing and dispatches through the actual shared Device Core', { timeout: 90000 }, async t => {
  const stateRoot = mkdtempSync(path.join(os.tmpdir(), 'mcp-v12-server-'));
  const workspace = path.join(stateRoot, 'workspace');
  mkdirSync(workspace);
  process.env.MCP_DEVICE_CONFIG_DIR = stateRoot;
  process.env.MCP_DEVICE_ID = 'server-core-acceptance';
  const originalListen = NetServer.prototype.listen;
  const listeners = [];
  NetServer.prototype.listen = function (...args) {
    assert.equal(args[0], 8104, 'Every test listener must use the leased G6 port.');
    assert.equal(args[1], '127.0.0.1', 'The isolated listener must remain loopback-only.');
    listeners.push({ port: args[0], host: args[1] });
    return originalListen.apply(this, args);
  };
  let runtime; let core;
  t.after(async () => {
    await runtime?.close();
    if (!runtime) await core?.close();
    NetServer.prototype.listen = originalListen;
    // Native v11 SQLite managers are process-scoped. Windows can retain those
    // handles until process exit; never alter user state to force cleanup.
    try { rmSync(stateRoot, { recursive: true, force: true }); } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error.code)) throw error;
      t.diagnostic('Isolated state retained until process exit: ' + stateRoot);
    }
  });
  const [{ createPlatformDeviceCore }, { GatewayDeviceIdentity }, { startServerRuntime }, { PluginHost }, { bundledPluginManifests }, { createPlatformTools }] = await Promise.all([
    import('../../dist/platform/device-runtime.js'),
    import('../../dist/device/gateway-identity.js'),
    import('../../control-plane/scripts/authenticated-mcp-wrapper.mjs'),
    import('../../dist/platform/plugin-host.js'),
    import('../../dist/distribution.js'),
    import('../../dist/platform/knowledge-mcp.js')
  ]);
  const identity = new GatewayDeviceIdentity(path.join(stateRoot, 'device-identity.json'));
  const record = await identity.loadOrCreate();
  const sourceRoot = path.join(stateRoot, 'knowledge-sources');
  mkdirSync(sourceRoot);
  const seedHost = new PluginHost({ stateRoot, deviceId: record.deviceId });
  for (const manifest of bundledPluginManifests()) await seedHost.install(manifest, { enabled: true, settings: { autoIndex: false, discoverKnownSources: false } });
  await seedHost.close();
  core = await createPlatformDeviceCore({ deviceId: record.deviceId, stateRoot, allowedRoots: [workspace], projectRoots: [], sourceRoots: [sourceRoot] });
  assert.ok(core.capabilities.includes('knowledge.search'), 'The preinstalled enabled Palace provider must start in an isolated process.');
  const actualInvoke = core.invoke.bind(core);
  const invocations = [];
  core.invoke = async (tool, args) => {
    invocations.push({ tool, args: structuredClone(args), instance: core.runtimeInstanceId });
    return actualInvoke(tool, args);
  };
  const extensionCalls = [];
  const configPath = path.join(stateRoot, 'mcp-servers.toml');
  const bundledConfig = readFileSync(path.join(packageRoot, 'control-plane/config/mcp-servers.toml'), 'utf8');
  writeFileSync(configPath, bundledConfig.replace('exposure_mode = "hybrid"', 'exposure_mode = "direct"') + '\n' +
    '[mcp_servers.fixture]\nenabled = true\ntransport = "stdio"\ncommand = ' + JSON.stringify(process.execPath) +
    '\nargs = [' + JSON.stringify(path.join(packageRoot, 'control-plane/tests/fixtures/fake-mcp-server.mjs')) + ']\n');
  runtime = await startServerRuntime({
    core, identity, stateRoot, packageRoot, configPath,
    port: 8104, host: '127.0.0.1', pairingPollIntervalMs: 100,
    deviceReleaseProvider: { latestVersion: async () => '1.0.12' },
    innerTls: {
      cert: readFileSync(path.join(packageRoot, 'control-plane/tests/fixtures/device-inner-tls/server-cert.pem')),
      key: readFileSync(path.join(packageRoot, 'control-plane/tests/fixtures/device-inner-tls/server-key.pem'))
    },
    extraTools: [...await createPlatformTools(stateRoot), {
      name: 'fixture.account_scope',
      description: 'Verify capability handler receives the authenticated account.',
      inputSchema: { type: 'object', properties: { accountId: { type: 'string' } }, additionalProperties: false },
      handler(args, context) {
        extensionCalls.push({ args, accountId: context.accountId, frozen: Object.isFrozen(context) });
        return { accountId: context.accountId, deviceIds: context.listDevices().map(device => device.deviceId), sessionBound: Boolean(context.sessionId) };
      }
    }]
  });
  let aliceCookie; let bobCookie; let aliceTokens; let bobTokens; let alice; let bob;

  await t.test('localhost remains authenticated and the local Device starts unclaimed', async () => {
    const anonymous = await http('/mcp', {
      headers: { accept: 'application/json, text/event-stream' },
      json: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
    });
    assert.equal(anonymous.status, 401);
    assert.equal(runtime.localDevice.status().state, 'pairing_required');
    assert.equal(runtime.localDevice.status().owner_account_id, null);
    assert.deepEqual(runtime.broker.listDevices(), []);
    const pairRedirect = await http('/device/verify?user_code=' + runtime.localDevice.status().user_code);
    assert.equal(pairRedirect.status, 302);
    assert.ok(pairRedirect.headers.get('location').startsWith('/login'));
    assert.equal(invocations.length, 0);
    assert.deepEqual(listeners, [{ port: 8104, host: '127.0.0.1' }]);
  });

  await t.test('ordinary one-use invite signup creates separate account sessions', async () => {
    const invite = runtime.accounts.createInvite().code;
    const signup = await http('/signup', { form: { identity: 'alice@example.test', password: 'acceptance-alice-password', invite } });
    assert.equal(signup.status, 302);
    aliceCookie = cookieFrom(signup);
    alice = runtime.accounts.getAccountByEmail('alice@example.test');
    assert.ok(alice?.accountId);
    const reuse = await http('/signup', { form: { identity: 'reuse@example.test', password: 'acceptance-reuse-password', invite } });
    assert.equal(reuse.status, 200);
    assert.equal(reuse.headers.has('set-cookie'), false);
    assert.equal(runtime.accounts.getAccountByEmail('reuse@example.test'), null);
    const signupBob = await http('/signup', { form: {
      identity: 'bob@example.test', password: 'acceptance-bob-password', invite: runtime.accounts.createInvite().code
    } });
    assert.equal(signupBob.status, 302);
    bobCookie = cookieFrom(signupBob);
    bob = runtime.accounts.getAccountByEmail('bob@example.test');
    assert.notEqual(alice.accountId, bob.accountId);
  });

  await t.test('browser approval claims embedded Device through PKCE and identity proof', async () => {
    const status = runtime.localDevice.status();
    const approval = await http('/device/verify', { cookie: aliceCookie, form: { user_code: status.user_code } });
    assert.equal(approval.status, 200);
    await runtime.localDevice.checkPairing();
    assert.equal(runtime.localDevice.status().state, 'online');
    assert.equal(runtime.localDevice.status().owner_account_id, alice.accountId);
    const owned = runtime.broker.listDevices({ accountId: alice.accountId });
    assert.equal(owned.length, 1);
    assert.equal(owned[0].executionRuntimeGeneration, core.runtimeInstanceId);
    assert.deepEqual(runtime.broker.listDevices({ accountId: bob.accountId }), []);
    assert.equal((await identity.loadOrCreate()).enrolled, true);
    assert.equal(listeners.length, 1);
  });

  await t.test('DCR, account consent, PKCE token exchange and refresh work on the same app', async () => {
    const metadata = await http('/.well-known/oauth-authorization-server');
    assert.equal(metadata.status, 200);
    assert.equal((await metadata.json()).token_endpoint, baseUrl + '/token');
    aliceTokens = await authorize(aliceCookie);
    bobTokens = await authorize(bobCookie);
    const refreshed = await http('/token', { form: {
      grant_type: 'refresh_token', client_id: aliceTokens.client_id, refresh_token: aliceTokens.refresh_token
    } });
    assert.equal(refreshed.status, 200);
    aliceTokens = { ...aliceTokens, ...await refreshed.json() };
    const init = await rpc(aliceTokens.access_token, 'initialize', {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'v12-acceptance', version: '1.0.0' }
    });
    assert.ok(init.result?.capabilities?.tools);
  });

  await t.test('modern 2026 per-request discovery, tools and native Skills coexist with legacy clients', async () => {
    const discovered = await rpc(aliceTokens.access_token, 'server/discover', {}, true);
    assert.ok(discovered.result.supportedVersions.includes('2026-07-28'));
    assert.deepEqual(discovered.result.capabilities.extensions['io.modelcontextprotocol/skills'], {});
    const listed = await rpc(aliceTokens.access_token, 'tools/list', {}, true);
    assert.ok(listed.result.tools.some(tool => tool.name === 'knowledge.search'));
    const skills = await rpc(aliceTokens.access_token, 'skills/list', {}, true);
    assert.ok(skills.result.skills.length > 0);
    const selected = skills.result.skills[0];
    const loaded = await rpc(aliceTokens.access_token, 'skills/get', { uri: selected.uri }, true);
    assert.ok(loaded.result);
    const bobSkills = await rpc(bobTokens.access_token, 'skills/list', {}, true);
    assert.deepEqual(bobSkills.result.skills.map(skill => skill.uri), skills.result.skills.map(skill => skill.uri));
    const bobLoaded = await rpc(bobTokens.access_token, 'skills/get', { uri: selected.uri }, true);
    assert.equal(bobLoaded.result.skill.uri, selected.uri);
    const bobFallback = await rpc(bobTokens.access_token, 'tools/call', { name: 'skill_catalog', arguments: {} }, true);
    assert.match(JSON.stringify(bobFallback.result), new RegExp(selected.name));
    const devices = await rpc(aliceTokens.access_token, 'tools/call', { name: 'list_devices', arguments: {} }, true);
    assert.match(JSON.stringify(devices.result), new RegExp(record.deviceId));
    t.diagnostic('Legacy protocol2025-11-25 and modern2026-07-28 both dispatched with OAuth through the pinned SDK2.0.0 control plane.');
  });

  await t.test('explicit unified config loads real STDIO upstream tools, resources and prompts on first startup', async () => {
    const listed = await rpc(aliceTokens.access_token, 'tools/list');
    assert.ok(listed.result.tools.some(tool => tool.name === 'fixture_read_context'));
    const called = await rpc(aliceTokens.access_token, 'tools/call', { name: 'fixture_read_context', arguments: {} });
    assert.match(JSON.stringify(called.result), /called:read_context/);
    const resources = await rpc(aliceTokens.access_token, 'resources/list');
    const remoteResource = resources.result.resources.find(resource => resource.uri.startsWith('external-mcp://fixture/') && resource.name === 'Fake context');
    assert.ok(remoteResource);
    const read = await rpc(aliceTokens.access_token, 'resources/read', { uri: remoteResource.uri });
    assert.match(JSON.stringify(read.result), /resource:fake/);
    const prompts = await rpc(aliceTokens.access_token, 'prompts/list');
    assert.ok(prompts.result.prompts.some(prompt => prompt.name === 'fixture_review_context'));
    const prompt = await rpc(aliceTokens.access_token, 'prompts/get', { name: 'fixture_review_context', arguments: { topic: 'v12' } });
    assert.match(JSON.stringify(prompt.result), /prompt:review_context:v12/);
    assert.equal(listeners.length, 1);
  });

  await t.test('catalog retains all twelve public tools plus exact Context routing contracts', async () => {
    const listed = await rpc(aliceTokens.access_token, 'tools/list');
    assert.ok(Array.isArray(listed.result?.tools));
    const names = listed.result.tools.map(tool => tool.name);
    for (const name of ['list_devices', 'project_list', 'read_text_file', 'write_file', 'edit_file', 'shell_execute', 'start_process', 'read_process_output', 'interact_with_process', 'terminate_process', 'image_preview', 'project_inspect']) {
      assert.ok(names.includes(name), 'Missing frozen public tool: ' + name);
    }
    for (const name of ['local_status', 'local_search', 'local_read', 'local_graph', 'local_index', 'local_wiki']) {
      const definition = listed.result.tools.find(tool => tool.name === name);
      assert.ok(definition, 'Missing Context tool: ' + name);
      assert.ok(definition.inputSchema.required.includes('device_id'));
    }
    const readSchema = listed.result.tools.find(tool => tool.name === 'local_read').inputSchema;
    assert.ok(readSchema.properties.ranges);
    const searchSchema = listed.result.tools.find(tool => tool.name === 'local_search').inputSchema;
    assert.ok(searchSchema.properties.source_types);
    assert.ok(searchSchema.properties.since);
    assert.ok(searchSchema.properties.until);
  });

  await t.test('actual file and shell calls use the shared Core; cross-owner calls never invoke it', async () => {
    const file = path.join(workspace, 'proof.txt');
    const write = await rpc(aliceTokens.access_token, 'tools/call', { name: 'write_file', arguments: { device_id: record.deviceId, path: file, content: 'same Device Core\nline two\n' } });
    assert.ok(write.result && !write.error && write.result.isError !== true, JSON.stringify(write));
    assert.equal(readFileSync(file, 'utf8'), 'same Device Core\nline two\n');
    const read = await rpc(aliceTokens.access_token, 'tools/call', { name: 'read_text_file', arguments: { device_id: record.deviceId, path: file } });
    assert.match(JSON.stringify(read.result), /same Device Core/);
    const shell = await rpc(aliceTokens.access_token, 'tools/call', { name: 'shell_execute', arguments: { device_id: record.deviceId, working_directory: workspace, command: 'echo MCP_V12_SHARED_CORE', timeout_ms: 5000 } });
    assert.match(JSON.stringify(shell.result), /MCP_V12_SHARED_CORE/);
    const count = invocations.length;
    const denied = await rpc(bobTokens.access_token, 'tools/call', { name: 'read_text_file', arguments: { device_id: record.deviceId, path: file } });
    assert.ok(denied.error || denied.result?.isError);
    assert.match(JSON.stringify(denied), /DEVICE_ACCESS_DENIED|not owned/);
    assert.equal(invocations.length, count);
    assert.ok(invocations.every(call => call.instance === core.runtimeInstanceId));
  });

  await t.test('the existing signed Context feature gate remains fail-closed without approval', async () => {
    const args = {
      device_id: record.deviceId, cwd: workspace, query: 'missing-fixture',
      source_types: ['history', 'checkpoint'], since: '2026-01-01T00:00:00Z', until: '2026-12-31T23:59:59Z',
      limit: 3, max_bytes: 4096, include_related: true
    };
    const before = invocations.length;
    const response = await rpc(aliceTokens.access_token, 'tools/call', { name: 'local_search', arguments: args });
    if (core.capabilities.includes('local_search')) {
      assert.deepEqual(invocations.findLast(call => call.tool === 'local_search')?.args, args);
    } else {
      assert.ok(response.error || response.result?.isError);
      assert.match(JSON.stringify(response), /does not advertise capability local_search/);
      assert.equal(invocations.length, before);
      t.diagnostic('Actual Context execution is feature-gated; no approval artifact was minted or changed.');
    }
  });

  await t.test('generic extensions validate arguments and receive trusted account context', async () => {
    const extension = await rpc(aliceTokens.access_token, 'tools/call', { name: 'fixture.account_scope', arguments: { accountId: bob.accountId } });
    assert.equal(extension.result.structuredContent.accountId, alice.accountId);
    assert.deepEqual(extension.result.structuredContent.deviceIds, [record.deviceId]);
    assert.equal(extension.result.structuredContent.sessionBound, true);
    assert.equal(extensionCalls[0].frozen, true);
    assert.equal(extensionCalls[0].accountId, alice.accountId);
    const invalid = await rpc(aliceTokens.access_token, 'tools/call', { name: 'fixture.account_scope', arguments: { unexpected: true } });
    assert.ok(invalid.error || invalid.result?.isError);
    assert.equal(extensionCalls.length, 1);
  });

  await t.test('operator view shares the listener and requires an administrator session', async () => {
    const anonymous = await http('/operator/state');
    assert.equal(anonymous.status, 302);
    const normal = await http('/operator/state', { cookie: aliceCookie });
    assert.equal(normal.status, 403);
    runtime.accounts.createAdmin({ email: 'admin@example.test', password: 'acceptance-admin-password' });
    const login = await http('/login', { form: { identity: 'admin@example.test', password: 'acceptance-admin-password' } });
    assert.equal(login.status, 302);
    assert.equal(login.headers.get('location'), '/operator');
    const adminCookie = cookieFrom(login);
    const operator = await http('/operator', { cookie: adminCookie });
    assert.equal(operator.status, 200);
    const html = await operator.text();
    assert.match(html, /Authenticated administrator overview/);
    assert.match(html, /\/operator\/state/);
    const operatorState = await http('/operator/state', { cookie: adminCookie });
    assert.equal(operatorState.status, 200);
    const dashboard = await http('/dashboard', { cookie: aliceCookie });
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), new RegExp(record.deviceId));
    assert.equal(listeners.length, 1);
  });

  await t.test('two actual remote Device Cores pair over inner TLS v2 and preserve owner, capability and process-session guards', async remoteTest => {
    const [remoteB, remoteC] = await Promise.all([
      remoteDevice(remoteTest, { deviceId: 'remote-b-acceptance', stateRoot: path.join(stateRoot, 'remote-b'), workspace: path.join(stateRoot, 'remote-b/workspace') }),
      remoteDevice(remoteTest, { deviceId: 'remote-c-acceptance', stateRoot: path.join(stateRoot, 'remote-c'), workspace: path.join(stateRoot, 'remote-c/workspace'), pluginMode: 'disabled' })
    ]);
    await pairRemote(remoteB, aliceCookie);
    await pairRemote(remoteC, bobCookie);
    const aliceDevices = runtime.broker.listDevices({ accountId: alice.accountId });
    assert.deepEqual(aliceDevices.map(device => device.deviceId).sort(), [record.deviceId, remoteB.record.deviceId].sort());
    assert.deepEqual(runtime.broker.listDevices({ accountId: bob.accountId }).map(device => device.deviceId), [remoteC.record.deviceId]);
    assert.equal(new Set([core.runtimeInstanceId, remoteB.record.runtimeInstanceId, remoteC.record.runtimeInstanceId]).size, 3);
    const bFile = path.join(remoteB.workspace, 'remote.txt');
    const cFile = path.join(remoteC.workspace, 'remote.txt');
    for (const [remote, token, file] of [[remoteB, aliceTokens.access_token, bFile], [remoteC, bobTokens.access_token, cFile]]) {
      const write = await rpc(token, 'tools/call', { name: 'write_file', arguments: { device_id: remote.record.deviceId, path: file, content: 'REMOTE_CORE_ACCEPTANCE:' + remote.record.deviceId } });
      assert.ok(write.result && !write.error && write.result.isError !== true, JSON.stringify(write));
      assert.equal(readFileSync(file, 'utf8'), 'REMOTE_CORE_ACCEPTANCE:' + remote.record.deviceId);
      const read = await rpc(token, 'tools/call', { name: 'read_text_file', arguments: { device_id: remote.record.deviceId, path: file } });
      assert.match(JSON.stringify(read), /REMOTE_CORE_ACCEPTANCE/);
    }
    const cBefore = await remoteC.request('stats');
    const crossOwner = await rpc(aliceTokens.access_token, 'tools/call', { name: 'read_text_file', arguments: { device_id: remoteC.record.deviceId, path: cFile } });
    assert.ok(crossOwner.error || crossOwner.result?.isError);
    assert.match(JSON.stringify(crossOwner), /DEVICE_ACCESS_DENIED|not owned/);
    assert.equal((await remoteC.request('stats')).invoked, cBefore.invoked);

    const reduced = remoteB.record.capabilities.filter(name => name !== 'read_text_file');
    assert.equal((await remoteB.request('capabilities', { capabilities: reduced })).sent, true);
    await eventually(() => assert.equal(runtime.broker.listDevices({ accountId: alice.accountId }).find(device => device.deviceId === remoteB.record.deviceId).capabilities.includes('read_text_file'), false));
    const noCapability = await rpc(aliceTokens.access_token, 'tools/call', { name: 'read_text_file', arguments: { device_id: remoteB.record.deviceId, path: bFile } });
    assert.ok(noCapability.error || noCapability.result?.isError);
    assert.match(JSON.stringify(noCapability), /does not advertise/);
    await remoteB.request('capabilities', { capabilities: remoteB.record.capabilities });
    await eventually(() => assert.equal(runtime.broker.listDevices({ accountId: alice.accountId }).find(device => device.deviceId === remoteB.record.deviceId).capabilities.includes('read_text_file'), true));

    const started = await rpc(aliceTokens.access_token, 'tools/call', { name: 'start_process', arguments: { device_id: remoteB.record.deviceId, working_directory: remoteB.workspace, command: 'echo REMOTE_SESSION_ACCEPTANCE', timeout_ms: 1000 } });
    assert.ok(started.result?.structuredContent?.session_id, JSON.stringify(started));
    const sessionId = started.result.structuredContent.session_id;
    const beforeEpoch = runtime.broker.listDevices({ accountId: alice.accountId }).find(device => device.deviceId === remoteB.record.deviceId).connectionEpoch;
    await remoteB.request('connect');
    const afterEpoch = runtime.broker.listDevices({ accountId: alice.accountId }).find(device => device.deviceId === remoteB.record.deviceId).connectionEpoch;
    assert.ok(afterEpoch > beforeEpoch);
    const stale = await rpc(aliceTokens.access_token, 'tools/call', { name: 'read_process_output', arguments: { session_id: sessionId } });
    assert.ok(stale.error || stale.result?.isError);
    assert.match(JSON.stringify(stale), /PROCESS_SESSION_STALE|session is stale/);
    const fresh = await rpc(aliceTokens.access_token, 'tools/call', { name: 'read_text_file', arguments: { device_id: remoteB.record.deviceId, path: bFile } });
    assert.match(JSON.stringify(fresh), /REMOTE_CORE_ACCEPTANCE/);
    for (const remote of [remoteB, remoteC]) {
      const stats = await remote.request('stats');
      assert.ok(stats.invoked >= 2);
      assert.ok(stats.outerFrames > 0);
      assert.equal(stats.outerPlaintext, false, 'Tool frames must remain encrypted inside outer WebSocket.');
    }
    await pairRemote(remoteC, aliceCookie);
    assert.equal(runtime.broker.listDevices({ accountId: alice.accountId }).length, 3);
    assert.deepEqual(runtime.broker.listDevices({ accountId: bob.accountId }), []);
    const aDbPath = path.join(core.plugins.dataRoot('palace'), 'palace.sqlite');
    const cDbPath = path.join(remoteC.record.stateRoot, 'plugins/palace/data/palace.sqlite');
    const cardCount = dbPath => {
      const db = new DatabaseSync(dbPath, { readOnly: true });
      try { return Number(db.prepare('SELECT count(*) AS count FROM cards').get().count); }
      finally { db.close(); }
    };
    assert.equal(cardCount(aDbPath), 0);
    assert.equal(existsSync(cDbPath), false);
    writeFileSync(path.join(remoteB.record.sourceRoot, 'session.log'), 'Error SQLITE_BUSY: bounded retries require the original transaction identity.\n');
    const seeded = await remoteB.request('invokeLocal', { capability: 'knowledge.ingest', arguments: {} });
    assert.equal(seeded.cards, 1);
    let selectedKnowledge;
    let selectedCard;

    await remoteTest.test('public search/list return remote previews without imports; read lazily imports exactly one origin-preserving card', async () => {
      const searched = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.search', arguments: {
        device_id: record.deviceId, query: 'SQLITE_BUSY', provider_device_id: remoteB.record.deviceId, max_bytes: 16384
      } });
      assert.ok(searched.result && !searched.error && searched.result.isError !== true, JSON.stringify(searched));
      const search = searched.result.structuredContent;
      assert.equal(search.items.length, 1);
      assert.equal(search.imported, 0);
      assert.deepEqual(search.queried, [remoteB.record.deviceId]);
      assert.equal(cardCount(aDbPath), 0);
      selectedKnowledge = search.items[0];
      assert.equal(selectedKnowledge.originDeviceId, remoteB.record.deviceId);
      assert.equal(selectedKnowledge.servingDeviceId, remoteB.record.deviceId);
      assert.ok(selectedKnowledge.read_ref.startsWith('k1.'));
      const listed = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.list', arguments: {
        device_id: record.deviceId, provider_device_id: remoteB.record.deviceId, limit: 10
      } });
      assert.equal(listed.result.structuredContent.imported, 0);
      assert.equal(cardCount(aDbPath), 0);
      const read = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.read', arguments: {
        device_id: record.deviceId, ref: selectedKnowledge.read_ref, evidence: true, max_bytes: 16384
      } });
      assert.ok(read.result && !read.error && read.result.isError !== true, JSON.stringify(read));
      const result = read.result.structuredContent;
      assert.equal(result.imported, true);
      assert.equal(result.freshness.status, 'current');
      selectedCard = result.card;
      assert.equal(selectedCard.id, selectedKnowledge.id);
      assert.equal(selectedCard.originDeviceId, remoteB.record.deviceId);
      assert.equal(selectedCard.version, selectedKnowledge.version);
      assert.equal(selectedCard.contentHash, selectedKnowledge.contentHash);
      assert.ok(selectedCard.evidence.length > 0);
      assert.ok(selectedCard.provenance.length > 0);
      assert.ok(selectedCard.evidence.every(item => item.originDeviceId === remoteB.record.deviceId && /^[a-f0-9]{64}$/.test(item.recordHash)));
      assert.ok(result.evidence.some(item => item.verifiedBytes === true));
      assert.equal(cardCount(aDbPath), 1);
      const imported = await core.invoke('knowledge.read', { ref: selectedCard.id });
      assert.equal(imported.card.originDeviceId, remoteB.record.deviceId);
      assert.equal(imported.card.servingDeviceId, record.deviceId);
      assert.equal(imported.card.contentHash, selectedCard.contentHash);
      const again = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.read', arguments: {
        device_id: record.deviceId, ref: selectedKnowledge.read_ref
      } });
      assert.equal(again.result.structuredContent.imported, false);
      assert.equal(cardCount(aDbPath), 1);
    });

    await remoteTest.test('Device without Palace uses account knowledge through the platform without persistent import', async () => {
      const capabilities = await rpc(aliceTokens.access_token, 'tools/call', { name: 'capability.list', arguments: { device_id: remoteC.record.deviceId } });
      assert.ok(capabilities.result.structuredContent.capabilities.includes('read_text_file'));
      assert.equal(capabilities.result.structuredContent.capabilities.some(name => name.startsWith('knowledge.')), false);
      const search = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.search', arguments: {
        device_id: remoteC.record.deviceId, query: 'SQLITE_BUSY', provider_device_id: remoteB.record.deviceId
      } });
      assert.equal(search.result.structuredContent.imported, 0);
      assert.equal(search.result.structuredContent.items.length, 1);
      assert.equal(existsSync(cDbPath), false);
      const read = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.read', arguments: {
        device_id: remoteC.record.deviceId, ref: selectedKnowledge.read_ref
      } });
      assert.equal(read.result.structuredContent.imported, false);
      assert.equal(read.result.structuredContent.card.originDeviceId, remoteB.record.deviceId);
      assert.equal(existsSync(cDbPath), false);
      const privateImport = await rpc(aliceTokens.access_token, 'tools/call', { name: 'capability.call', arguments: {
        device_id: remoteC.record.deviceId, capability: 'knowledge.import', arguments: { card: selectedCard }
      } });
      assert.ok(privateImport.error || privateImport.result?.isError);
      assert.match(JSON.stringify(privateImport), /CAPABILITY_PRIVATE|public knowledge exchange/);
    });

    await remoteTest.test('selected reads follow origin corrections and update the imported copy without replication', async () => {
      const correction = await remoteB.request('invokeLocal', { capability: 'knowledge.correct', arguments: {
        ref: selectedCard.id, body: 'Error SQLITE_BUSY: corrected evidence requires retrying the same transaction with a bounded deadline.', reason: 'isolated acceptance correction'
      } });
      assert.ok(correction.card.version > selectedCard.version);
      const read = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.read', arguments: {
        device_id: record.deviceId, ref: selectedKnowledge.read_ref
      } });
      assert.equal(read.result.structuredContent.card.version, correction.card.version);
      assert.equal(read.result.structuredContent.card.contentHash, correction.card.contentHash);
      assert.equal(read.result.structuredContent.card.originDeviceId, remoteB.record.deviceId);
      assert.match(read.result.structuredContent.card.body, /bounded deadline/);
      assert.equal(cardCount(aDbPath), 1);
      const cRead = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.read', arguments: {
        device_id: remoteC.record.deviceId, ref: selectedKnowledge.read_ref
      } });
      assert.equal(cRead.result.structuredContent.card.version, correction.card.version);
      assert.equal(cRead.result.structuredContent.imported, false);
      assert.equal(existsSync(cDbPath), false);
    });

    await remoteTest.test('plugin disable changes advertised capabilities; cached reads survive provider loss and native execution remains available', async () => {
      await core.plugins.disable('palace');
      await eventually(() => assert.equal(runtime.broker.listDevices({ accountId: alice.accountId }).find(device => device.deviceId === record.deviceId).capabilities.includes('knowledge.read'), false));
      assert.equal(cardCount(aDbPath), 1);
      await remoteB.request('disconnect');
      const cached = await rpc(aliceTokens.access_token, 'tools/call', { name: 'knowledge.read', arguments: {
        device_id: remoteC.record.deviceId, ref: selectedKnowledge.read_ref
      } });
      assert.equal(cached.result.structuredContent.freshness.status, 'stale');
      assert.equal(cached.result.structuredContent.imported, false);
      assert.match(cached.result.structuredContent.card.body, /bounded deadline/);
      const native = await rpc(aliceTokens.access_token, 'tools/call', { name: 'read_text_file', arguments: {
        device_id: record.deviceId, path: path.join(workspace, 'proof.txt')
      } });
      assert.match(JSON.stringify(native), /same Device Core/);
      const cNative = await rpc(aliceTokens.access_token, 'tools/call', { name: 'read_text_file', arguments: {
        device_id: remoteC.record.deviceId, path: cFile
      } });
      assert.match(JSON.stringify(cNative), /REMOTE_CORE_ACCEPTANCE/);
      assert.equal(existsSync(cDbPath), false);
      await remoteB.request('connect');
      await core.plugins.enable('palace');
      await eventually(() => assert.equal(runtime.broker.listDevices({ accountId: alice.accountId }).find(device => device.deviceId === record.deviceId).capabilities.includes('knowledge.read'), true));
      assert.equal(cardCount(aDbPath), 1);
    });

    assert.equal(runtime.localDevice.status().state, 'online');
    assert.equal(listeners.length, 1);
    remoteTest.diagnostic('Three actual Device Core instances: one embedded and two isolated TLS v2 remote processes; one server listener.');
  });

  await t.test('account revocation invalidates OAuth access and refresh on localhost', async () => {
    runtime.accounts.revokeAccount(bob.accountId);
    const denied = await http('/mcp', {
      token: bobTokens.access_token, headers: { accept: 'application/json, text/event-stream' },
      json: { jsonrpc: '2.0', id: 999, method: 'tools/list', params: {} }
    });
    assert.equal(denied.status, 401);
    const refresh = await http('/token', { form: {
      grant_type: 'refresh_token', client_id: bobTokens.client_id, refresh_token: bobTokens.refresh_token
    } });
    assert.equal(refresh.status, 400);
    assert.equal((await refresh.json()).error, 'invalid_grant');
  });

  t.diagnostic('Node ' + process.version + '; listeners=' + listeners.length + '; sharedCoreDispatches=' + invocations.length);
});
