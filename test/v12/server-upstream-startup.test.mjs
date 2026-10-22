import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Server as NetServer } from 'node:net';
import { createExternalMcpManager } from '../../control-plane/scripts/upstreams/manager.mjs';
import { createStdioUpstreamClient } from '../../control-plane/scripts/upstreams/stdio-client.mjs';

function fixture(t, servers) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-v12-upstream-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, 'mcp-servers.toml');
  fs.writeFileSync(configPath, '[external_mcp]\nfail_gateway_on_startup_error = true\nshutdown_timeout_ms = 10\n' + servers.map(id => '\n[mcp_servers.' + id + ']\nenabled = true\ncommand = "fixture"\n').join(''));
  const originalListen = NetServer.prototype.listen;
  NetServer.prototype.listen = function () { throw new Error('Upstream startup tests must never listen.'); };
  t.after(() => { NetServer.prototype.listen = originalListen; });
  return { root, configPath };
}

function provider(id, closed, tools = []) {
  return {
    id,
    capabilities: { tools: {} },
    async listTools() { return { tools }; },
    async close() { closed.push(id); }
  };
}

test('mandatory provider startup failure closes previously constructed provider clients', async t => {
  const { root, configPath } = fixture(t, ['first', 'second']);
  const closed = [];
  await assert.rejects(createExternalMcpManager({
    repoRoot: root,
    env: { MCP_UPSTREAM_CONFIG: configPath },
    clientFactory: async server => {
      if (server.id === 'second') throw new Error('fixture mandatory provider unavailable');
      return provider(server.id, closed);
    }
  }), /fixture mandatory provider unavailable/);
  assert.deepEqual(closed, ['first']);
});

test('fatal startup catalog collision closes all constructed provider clients', async t => {
  const { root, configPath } = fixture(t, ['first', 'second']);
  const closed = [];
  await assert.rejects(createExternalMcpManager({
    repoRoot: root,
    env: { MCP_UPSTREAM_CONFIG: configPath },
    localToolNames: ['first_collision'],
    clientFactory: async server => provider(server.id, closed, [{ name: 'collision', inputSchema: { type: 'object' } }])
  }), /collision/i);
  assert.deepEqual(closed.sort(), ['first', 'second']);
});

test('a real STDIO child that never initializes is terminated before startup rejection returns', async t => {
  let pidPath;
  const childAlive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  t.after(() => {
    if (pidPath && fs.existsSync(pidPath)) {
      const pid = Number(fs.readFileSync(pidPath, 'utf8'));
      if (childAlive(pid)) process.kill(pid);
    }
  });
  const { root } = fixture(t, []);
  const childPath = path.join(root, 'never-initializes.mjs');
  pidPath = path.join(root, 'child.pid');
  fs.writeFileSync(childPath, "import fs from 'node:fs'; fs.writeFileSync(process.argv[2], String(process.pid)); process.stdin.resume(); setInterval(() => {}, 1000);\n");
  await assert.rejects(createStdioUpstreamClient({
    id: 'stalled', command: process.execPath, args: [childPath, pidPath], cwd: root,
    startupTimeoutMs: 1000, shutdownTimeoutMs: 1000
  }), /initialize timed out/);
  assert.equal(fs.existsSync(pidPath), true, 'fixture must actually start a child');
  const pid = Number(fs.readFileSync(pidPath, 'utf8'));
  for (let attempt = 0; attempt < 30 && childAlive(pid); attempt += 1) await delay(20);
  assert.equal(childAlive(pid), false, 'failed constructor must not leave a provider child alive');
});
