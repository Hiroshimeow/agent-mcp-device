import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

async function freePort() {
  const server = createServer();
  await new Promise((ok, bad) => server.once('error', bad).listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  await new Promise(ok => server.close(ok));
  return port;
}
test('v12 loopback port shares MCP backend and never bypasses authentication', { timeout: 45000 }, async t => {
  const dir = await mkdtemp(join(os.tmpdir(), 'v12-loopback-'));
  const state = join(dir, 'state');
  const home = join(dir, 'home');
  await mkdir(home);
  const preload = join(dir, 'isolate-home.mjs');
  await writeFile(preload, "import os from 'node:os'; import {syncBuiltinESMExports} from 'node:module'; os.homedir=()=>" + JSON.stringify(home) + "; syncBuiltinESMExports();\n");
  const config = join(dir, 'server-config.json');
  const mcpConfig = join(dir, 'servers.toml');
  await writeFile(mcpConfig, '[external_mcp]\nenabled = false\n');
  const bearer = randomBytes(32).toString('hex');
  await writeFile(config, JSON.stringify({ configPath: mcpConfig, env: { MCP_BEARER_TOKEN: bearer } }));
  const pubPort = await freePort(); const localPort = await freePort();
  assert.notEqual(pubPort, localPort);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(MCP_|HCU_|NODE_OPTIONS$)/.test(k)));
  env.NODE_OPTIONS = '--import=' + pathToFileURL(preload).href;
  env.MCP_DEVICE_CONFIG_DIR = state;
  let child;
  t.after(async () => {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise(ok => child.once('exit', ok)), new Promise(ok => setTimeout(ok, 3500))]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await rm(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 });
  });
  child = spawn(process.execPath, [resolve('dist/mcp-device.js'), 'server', '--runtime-dir', state,
    '--host', '127.0.0.1', '--port', String(pubPort), '--loopback-port', String(localPort),
    '--config', config, '--public-url', 'https://device.example.test'],
    { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stderr.on('data', c => { stderr = (stderr + c).slice(-3000); });
  const ready = await new Promise((ok, bad) => {
    const timer = setTimeout(() => bad(new Error('server startup timeout ' + stderr)), 20000);
    child.stdout.on('data', c => {
      stdout += c;
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes('"event":"server_ready"')) continue;
        try { const data = JSON.parse(line); clearTimeout(timer); ok(data); } catch {}
      }
    });
    child.once('error', bad);
    child.once('exit', code => bad(new Error('server exited ' + code + ' ' + stderr)));
  });
  assert.equal(ready.url, 'https://device.example.test');
  assert.equal(ready.loopback_url, 'http://127.0.0.1:' + localPort + '/mcp');
  const headers = { 'content-type':'application/json', accept:'application/json, text/event-stream', 'mcp-protocol-version':'2025-11-25' };
  const body = JSON.stringify({ jsonrpc:'2.0', id:1, method:'tools/list', params:{} });
  async function rpc(port, token) {
    return fetch('http://127.0.0.1:' + port + '/mcp',
      { method:'POST', headers: { ...headers, ...(token ? {authorization:'Bearer ' + token} : {}) }, body, signal:AbortSignal.timeout(5000) });
  }
  assert.equal((await rpc(pubPort)).status, 401);
  assert.equal((await rpc(localPort)).status, 401);
  const spoofedHostStatus = await new Promise((ok, bad) => {
    const req=httpRequest('http://127.0.0.1:' + localPort + '/mcp', { method:'POST', headers:{...headers,Host:'mcp.hcu-lab.me'} }, res=>{res.resume();res.on('end',()=>ok(res.statusCode));});
    req.once('error',bad);req.end(body);
  });
  assert.equal(spoofedHostStatus, 421);
  assert.equal((await fetch('http://127.0.0.1:' + localPort + '/mcp', { method:'POST', headers:{...headers, 'x-forwarded-for':'10.1.1.1'}, body })).status, 421);
  const [publicResponse, localResponse] = await Promise.all([rpc(pubPort, bearer), rpc(localPort, bearer)]);
  assert.equal(publicResponse.status, 200);
  assert.equal(localResponse.status, 200);
  function parse(text) {
    const data = text.split(/\r?\n/).filter(x => x.startsWith('data:'));
    return JSON.parse(data.length ? data[data.length-1].slice(5) : text);
  }
  const pub = parse(await publicResponse.text());
  const local = parse(await localResponse.text());
  assert.equal(pub.result.tools.length, local.result.tools.length);
  assert.ok(pub.result.tools.length >= 10);
  assert.equal(pub.result.tools.some(t => t.name.startsWith('knowledge.')), false, 'Palace CLI must not be exposed as MCP tools by default');
  assert.deepEqual(pub.result.tools.map(t => t.name), local.result.tools.map(t => t.name));
  assert.equal((await fetch('http://127.0.0.1:' + localPort + '/.well-known/oauth-authorization-server')).status, 200);
  t.diagnostic('two listeners share ' + pub.result.tools.length + ' tools with 401 anonymous; auth issuer retained');
});
