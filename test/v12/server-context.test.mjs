import test from 'node:test';
import assert from 'node:assert/strict';
import { Server as NetServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes, generateKeyPairSync, sign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startServerRuntime } from '../../control-plane/scripts/authenticated-mcp-wrapper.mjs';
import { buildDeviceAuthChallenge } from '../../control-plane/scripts/device-broker.mjs';
import { buildContextCatalog } from '../../dist/context/tool-contract.js';
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
async function rpc(token, method, params = {}) {
  const response = await http('/mcp', {
    token, headers: { accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25' },
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



test('router fixture preserves every existing Context action and parameter without enabling the actual feature gate', { timeout: 15000 }, async t => {
  // Explicit router fixture: this is not an assertion that production Context
  // authorization is enabled. Real Core fail-closed behavior is in server-e2e.
  const stateRoot = mkdtempSync(path.join(os.tmpdir(), 'mcp-v12-context-router-'));
  const deviceId = 'context-router-fixture';
  const pair = generateKeyPairSync('ed25519');
  const record = {
    deviceId, publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), enrolled: false
  };
  const identity = {
    loadOrCreate: async () => ({ ...record }),
    markEnrolled: async () => { record.enrolled = true; },
    signChallenge: async nonce => sign(null, buildDeviceAuthChallenge({ deviceId, nonce }), pair.privateKey).toString('base64')
  };
  const calls = [];
  const core = {
    capabilities: buildContextCatalog().map(tool => tool.name), runtimeInstanceId: 'explicit-context-router-fixture',
    async invoke(tool, args) { calls.push({ tool, args: structuredClone(args) }); return { tool, received: args }; },
    async close() {}
  };
  const originalListen = NetServer.prototype.listen;
  let listeners = 0;
  NetServer.prototype.listen = function (...args) {
    assert.equal(args[0], 8104);
    assert.equal(args[1], '127.0.0.1');
    listeners += 1;
    return originalListen.apply(this, args);
  };
  let runtime;
  t.after(async () => {
    await runtime?.close();
    NetServer.prototype.listen = originalListen;
    rmSync(stateRoot, { recursive: true, force: true });
  });
  runtime = await startServerRuntime({
    core, identity, stateRoot, packageRoot, host: '127.0.0.1', port: 8104,
    deviceReleaseProvider: { latestVersion: async () => '1.0.12' }
  });
  const account = runtime.accounts.createAccount({ email: 'router@example.test', password: 'router-fixture-password' });
  const login = await http('/login', { form: { identity: account.email, password: 'router-fixture-password' } });
  assert.equal(login.status, 302);
  const cookie = cookieFrom(login);
  const approved = await http('/device/verify', { cookie, form: { user_code: runtime.localDevice.status().user_code } });
  assert.equal(approved.status, 200);
  await runtime.localDevice.checkPairing();
  assert.equal(runtime.localDevice.status().state, 'online');
  const tokens = await authorize(cookie);
  const scope = { device_id: deviceId, cwd: stateRoot };
  const cases = [
    ['local_status', { ...scope, check_current: true, job_id: 'job-ref' }],
    ['local_search', { ...scope, query: 'retained evidence', source_types: ['history', 'checkpoint', 'activity'], since: '2026-10-01T00:00:00Z', until: '2026-10-22T00:00:00Z', limit: 7, max_bytes: 4096, cursor: 'search-cursor', include_related: true }],
    ['local_read', { ...scope, refs: ['ref-2', 'ref-1'], max_bytes: 8192, cursor: 'read-cursor', ranges: [{ ref: 'ref-2', start: 3, end: 9 }, { ref: 'ref-1', start: 0 }] }],
    ['local_graph', { ...scope, action: 'path', refs: ['ref-a'], target: 'ref-b', relations: ['derived_from'], direction: 'both', max_hops: 3, max_nodes: 8, max_edges: 10, max_bytes: 4096, wall_ms: 50, cursor: 'graph-cursor' }],
    ['local_index', { ...scope, action: 'checkpoint', budget_profile: 'bounded', idempotency_key: 'one', summary: 'reviewable checkpoint', evidence_refs: ['ref-a'] }],
    ['local_wiki', { device_id: deviceId, action: 'status' }]
  ];
  for (const [tool, args] of cases) {
    await t.test(tool + ' keeps its published arguments', async () => {
      const result = await rpc(tokens.access_token, 'tools/call', { name: tool, arguments: args });
      assert.equal(result.result?.isError, undefined, JSON.stringify(result));
      const expected = tool === 'local_wiki' ? { action: 'status' } : args;
      assert.deepEqual(calls.at(-1), { tool, args: expected });
      assert.deepEqual(result.result.structuredContent.received, expected);
    });
  }
  await t.test('unknown Context fields and invalid actions fail before adapter dispatch', async () => {
    const before = calls.length;
    for (const [name, args] of [
      ['local_search', { ...scope, query: 'x', hidden_override: 'forbidden' }],
      ['local_graph', { ...scope, action: 'delete', refs: [] }],
      ['local_read', { ...scope, refs: [], ranges: [] }],
      ['local_index', { ...scope, action: 'unsafe-admin' }]
    ]) {
      const result = await rpc(tokens.access_token, 'tools/call', { name, arguments: args });
      assert.ok(result.error || result.result?.isError, JSON.stringify(result));
    }
    assert.equal(calls.length, before);
  });
  assert.equal(listeners, 1);
  assert.equal(calls.length, 6);
  t.diagnostic('Context router fixture only; actual signed feature authorization was preserved.');
});
