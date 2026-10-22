import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fork, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const exec = promisify(execFile);
const installed = process.env.MCP_V12_COLD_PACKAGE_ROOT;
const base = 'http://127.0.0.1:8104';
let rpcId = 0;
async function http(route, { cookie, token, form, json, ...options } = {}) {
  const headers = { ...options.headers };
  if (cookie) headers.cookie = cookie;
  if (token) headers.authorization = 'Bearer ' + token;
  if (form) headers['content-type'] = 'application/x-www-form-urlencoded';
  if (json) headers['content-type'] = 'application/json';
  return fetch(base + route, { ...options, redirect: 'manual', signal: AbortSignal.timeout(10000), headers, ...(form ? { method: 'POST', body: new URLSearchParams(form) } : {}), ...(json ? { method: 'POST', body: JSON.stringify(json) } : {}) });
}
function hidden(html, name) { const value = html.match(new RegExp('name="' + name + '" value="([^"]+)"'))?.[1]; assert.ok(value); return value; }
async function rpc(token, method, params = {}) {
  const id = ++rpcId;
  const response = await http('/mcp', { token, headers: { accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25' }, json: { jsonrpc: '2.0', id, method, params } });
  assert.equal(response.status, 200);
  const text = await response.text();
  return response.headers.get('content-type')?.includes('text/event-stream') ? text.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5))).find(message => message.id === id) : JSON.parse(text);
}
async function authorize(cookie) {
  const callback = base + '/package-fixture-callback', verifier = randomBytes(32).toString('base64url');
  const registration = await http('/register', { json: { client_name: 'cold-package-acceptance', redirect_uris: [callback], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] } });
  assert.equal(registration.status, 201); const client = await registration.json();
  const params = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: callback, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', scope: 'mcp:tools offline_access', state: 'cold-package', resource: base + '/mcp' });
  const gate = await http('/authorize?' + params, { cookie }); assert.equal(gate.status, 200); const html = await gate.text();
  const approval = await http('/oauth/continue', { cookie, form: { pending: hidden(html, 'pending'), csrf: hidden(html, 'csrf') } }); assert.equal(approval.status, 302);
  const code = new URL(approval.headers.get('location')).searchParams.get('code'); assert.ok(code);
  const exchange = await http('/token', { form: { grant_type: 'authorization_code', client_id: client.client_id, code, code_verifier: verifier, redirect_uri: callback } });
  assert.equal(exchange.status, 200); return { ...await exchange.json(), client_id: client.client_id };
}

test('cold installed package runs CLI server, persists pairing/OAuth and restores complete stopped state', { timeout: 120000, skip: !installed ? 'Set MCP_V12_COLD_PACKAGE_ROOT to the isolated npm tarball installation' : false }, async t => {
  const packageRoot = path.resolve(installed), entry = path.join(packageRoot, 'dist', 'mcp-device.js');
  const packageInfo = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(packageInfo.name, '@hcu-lab.me/mcp-device'); assert.equal(packageInfo.version, '1.0.12');
  await assert.rejects(fs.stat(path.join(packageRoot, 'src')), { code: 'ENOENT' });
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'v12-cold-')), home = path.join(fixture, 'home');
  const runtimeRoot = path.join(fixture, 'state'), backupRoot = path.join(fixture, 'backup'), restoredRoot = path.join(fixture, 'restored');
  await fs.mkdir(path.join(home, '.pi', 'agent', 'sessions'), { recursive: true });
  await fs.writeFile(path.join(home, '.pi', 'agent', 'sessions', 'cold.jsonl'), JSON.stringify({ type: 'message', message: { role: 'toolResult', toolName: 'test', content: [{ type: 'text', text: 'Decision: cold package fixture records durable isolated acceptance evidence.' }] } }) + '\n');
  const preload = path.join(fixture, 'isolate-home.mjs');
  await fs.writeFile(preload, `import os from 'node:os';import{syncBuiltinESMExports}from'node:module';import{Server}from'node:net';os.homedir=()=>${JSON.stringify(home)};syncBuiltinESMExports();const listen=Server.prototype.listen;Server.prototype.listen=function(...a){if(a[0]!==8104||a[1]!=='127.0.0.1')throw new Error('TEST_LISTENER_OUTSIDE_8104');return listen.apply(this,a)};`);
  // Child plugin processes inherit the same isolated known-source home.
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(MCP_|HCU_)/.test(key) && key !== 'NODE_OPTIONS'));
  const env = { ...inherited, NODE_OPTIONS: '--import=' + JSON.stringify(pathToFileURL(preload).href), MCP_DEVICE_CONFIG_DIR: runtimeRoot };
  const cli = async (args, extraEnv = {}) => exec(process.execPath, ['--import', pathToFileURL(preload).href, entry, ...args], { cwd: home, env: { ...env, ...extraEnv }, timeout: 20000, maxBuffer: 512 * 1024 });
  const password = randomBytes(24).toString('hex'), email = 'cold-admin@example.test';
  let running;
  async function start(root) {
    const child = fork(entry, ['server', '--runtime-dir', root, '--host', '127.0.0.1', '--port', '8104', '--legacy-knowledge-mcp'], { execPath: process.execPath, execArgv: ['--import', pathToFileURL(preload).href], cwd: home, env: { ...env, MCP_DEVICE_CONFIG_DIR: root }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
    let buffer = '', stderr = '', pairing;
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CLI startup timed out: ' + stderr)), 20000);
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
      child.stdout.on('data', chunk => { buffer += chunk; let end; while ((end = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, end); buffer = buffer.slice(end + 1); try { const event = JSON.parse(line); if (event.event === 'device_pairing_required') pairing = event.pairing; if (event.event === 'server_ready') { clearTimeout(timer); resolve(event); } } catch {} } });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error('CLI exited ' + code + ': ' + stderr)); });
    });
    const closed = new Promise(resolve => child.once('exit', code => resolve(code)));
    running = { child, closed };
    const event = await ready;
    assert.equal(event.version, '1.0.12'); assert.equal(event.local_runtime, 'shared-device-core');
    return { ...event, pairing };
  }
  async function stop() {
    if (!running) return;
    const active = running; running = undefined;
    if (active.child.exitCode !== null) return;
    active.child.send({ type: 'mcp-device:shutdown' });
    let timer;
    try { assert.equal(await Promise.race([active.closed, new Promise((_, reject) => { timer = setTimeout(() => { active.child.kill(); reject(new Error('CLI did not stop gracefully')); }, 15000); })]), 0); }
    finally { clearTimeout(timer); }
  }
  t.after(async () => { await stop(); await fs.rm(fixture, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); });
  const admin = JSON.parse((await cli(['admin', '--runtime-dir', runtimeRoot, 'account', 'create-admin', email], { HCU_ADMIN_PASSWORD: password })).stdout);
  assert.equal(admin.ok, true);
  const invited = JSON.parse((await cli(['admin', '--runtime-dir', runtimeRoot, 'invite', 'create', '1'])).stdout);
  assert.equal(invited.ok, true); assert.equal(invited.codes.length, 1);
  const initial = await start(runtimeRoot);
  assert.ok(initial.pairing?.user_code); assert.equal('device_code' in initial.pairing, false);
  const anonymous = await http('/mcp', { headers: { accept: 'application/json, text/event-stream' }, json: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } }); assert.equal(anonymous.status, 401);
  const login = await http('/login', { form: { identity: email, password } }); assert.equal(login.status, 302);
  const adminCookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await http('/operator', { cookie: adminCookie })).status, 200);
  const signup = await http('/signup', { form: { identity: 'cold-user@example.test', password: randomBytes(24).toString('hex'), invite: invited.codes[0] } });
  assert.equal(signup.status, 302);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  assert.equal((await http('/operator', { cookie })).status, 403);
  const verify = await http('/device/verify?user_code=' + encodeURIComponent(initial.pairing.user_code), { cookie });
  assert.equal(verify.status, 200);
  assert.match(await verify.text(), /localhost/);
  const claimed = await http('/device/verify', { cookie, form: { user_code: initial.pairing.user_code } }); assert.equal(claimed.status, 200);
  const tokens = await authorize(cookie);
  const initialized = await rpc(tokens.access_token, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'cold-package-acceptance', version: '1.0.12' } });
  assert.ok(initialized.result?.serverInfo);
  let capabilities;
  for (let tries = 0; tries < 60; tries++) {
    capabilities = await rpc(tokens.access_token, 'tools/call', { name: 'capability.list', arguments: { device_id: initial.device_id } });
    if (capabilities.result?.structuredContent?.capabilities?.includes('knowledge.search')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(capabilities.result.structuredContent.capabilities.includes('knowledge.search'));
  assert.ok(capabilities.result.structuredContent.contracts.some(contract => contract.name === 'knowledge.search' && contract.version === '1.0.0'));
  const filename = path.join(home, 'cold-file.txt');
  const write = await rpc(tokens.access_token, 'tools/call', { name: 'write_file', arguments: { device_id: initial.device_id, path: filename, content: 'package-local-core' } }); assert.notEqual(write.result?.isError, true);
  assert.equal(await fs.readFile(filename, 'utf8'), 'package-local-core');
  const found = await rpc(tokens.access_token, 'tools/call', { name: 'knowledge.search', arguments: { device_id: initial.device_id, query: 'cold package fixture' } });
  assert.ok(found.result.structuredContent.items.length > 0, 'Bundled enabled Palace indexes the known isolated source automatically');
  const identity = JSON.parse(await fs.readFile(path.join(runtimeRoot, 'gateway-identity.json'), 'utf8')); assert.equal(identity.enrolled, true);
  await stop();
  await assert.rejects(fs.stat(path.join(runtimeRoot, 'server-runtime.lock')), { code: 'ENOENT' });
  const backed = JSON.parse((await cli(['state', 'backup', '--source', runtimeRoot, '--backup', backupRoot])).stdout); assert.ok(backed.manifest.files.length > 0);
  assert.equal(JSON.parse((await cli(['state', 'verify', '--backup', backupRoot])).stdout).valid, true);
  await fs.rm(runtimeRoot, { recursive: true, force: true });
  await cli(['state', 'restore', '--backup', backupRoot, '--target', restoredRoot]);
  const restoredIdentity = JSON.parse(await fs.readFile(path.join(restoredRoot, 'gateway-identity.json'), 'utf8')); assert.deepEqual(restoredIdentity, identity);
  const restarted = await start(restoredRoot); assert.equal(restarted.device_id, initial.device_id); assert.equal(restarted.pairing, undefined);
  const refresh = await http('/token', { form: { grant_type: 'refresh_token', client_id: tokens.client_id, refresh_token: tokens.refresh_token } }); assert.equal(refresh.status, 200);
  const fresh = await refresh.json();
  const after = await rpc(fresh.access_token, 'tools/call', { name: 'knowledge.search', arguments: { device_id: initial.device_id, query: 'cold package fixture' } }); assert.ok(after.result.structuredContent.items.length > 0);
  const selected = await rpc(fresh.access_token, 'tools/call', { name: 'knowledge.read', arguments: { device_id: initial.device_id, ref: found.result.structuredContent.items[0].read_ref, evidence: true } }); assert.notEqual(selected.result.isError, true);
  assert.ok(selected.result.structuredContent.evidence.some(item => item.verifiedBytes));
  const read = await rpc(fresh.access_token, 'tools/call', { name: 'read_text_file', arguments: { device_id: initial.device_id, path: filename } }); assert.notEqual(read.result.isError, true);
  await stop();
  t.diagnostic(JSON.stringify({ version: '1.0.12', install: 'npm-tarball-production-dependencies', defaultPalace: true, oauthRefreshAfterRestore: true, pairedIdentityPreserved: true, exactEvidenceAfterRestore: true, listener: base }));
});
