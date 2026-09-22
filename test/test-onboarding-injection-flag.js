/**
 * Test: onboarding_injection flag must be authoritative on cold starts.
 *
 * The test drives the real dist/index.js through the official MCP SDK stdio
 * transport. This avoids maintaining a second, hand-written MCP framing parser.
 *
 * Scenarios:
 * 1. Cold start, flag server unreachable -> no injection.
 * 2. Cold start, flags(false) delayed -> no injection.
 * 3. Cold start, flags(true) delayed -> injection appears after flags load.
 * 4. Warm cache with flags(false), no network -> no injection.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { createServer } from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_INDEX = path.join(PROJECT_ROOT, 'dist', 'index.js');
const MARKER = 'NEW USER ONBOARDING REQUIRED';
const SCENARIO_TIMEOUT_MS = 30000;

function makeHome({ cachedFlags } = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'dc-onboarding-test-'));
  const cfgDir = path.join(home, '.claude-server-commander');
  mkdirSync(cfgDir, { recursive: true });
  writeFileSync(
    path.join(cfgDir, 'config.json'),
    JSON.stringify({ telemetryEnabled: false })
  );
  if (cachedFlags) {
    writeFileSync(
      path.join(cfgDir, 'feature-flags.json'),
      JSON.stringify({ version: 'cached-test', flags: cachedFlags })
    );
  }
  return { home, cfgDir };
}

function startFlagServer(flags, delayMs = 0) {
  const server = createServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: 'live-test', flags }));
    }, delayMs);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function callToolOnFreshServer({ home, cfgDir, flagUrl, followUpDelayMs = null }) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [DIST_INDEX],
    cwd: PROJECT_ROOT,
    stderr: 'pipe',
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      DESKTOP_COMMANDER_CONFIG_DIR: cfgDir,
      DESKTOP_COMMANDER_DISABLE_TELEMETRY: 'true',
      DC_FLAG_URL: flagUrl,
      MCP_DEVICE_REMOTE: 'false',
    },
  });

  const client = new Client(
    { name: 'docker-mcp-gateway', version: '1.0.0' },
    { capabilities: {} }
  );

  let stderrText = '';
  try {
    await client.connect(transport, { timeout: SCENARIO_TIMEOUT_MS });
    if (transport.stderr) {
      transport.stderr.on('data', chunk => {
        stderrText += chunk.toString();
      });
    }

    const call = async () => {
      const result = await client.callTool(
        { name: 'get_config', arguments: {} },
        undefined,
        { timeout: SCENARIO_TIMEOUT_MS }
      );
      return (result.content || [])
        .map(item => item.text || '')
        .join('\n');
    };

    const texts = [await call()];
    if (followUpDelayMs !== null) {
      await new Promise(resolve => setTimeout(resolve, followUpDelayMs));
      texts.push(await call());
    }
    return { texts };
  } catch (error) {
    return {
      error:
        String(error?.message || error) +
        (stderrText ? '\nchild stderr:\n' + stderrText.slice(-4000) : '')
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function runScenario({
  name,
  expectInjection,
  fixture,
  flagUrl,
  followUpDelayMs
}) {
  try {
    const result = await callToolOnFreshServer({
      home: fixture.home,
      cfgDir: fixture.cfgDir,
      flagUrl,
      followUpDelayMs
    });

    if (result.error) {
      console.error('FAIL ' + name + ': ' + result.error);
      return false;
    }

    const injected = result.texts.some(text => text.includes(MARKER));
    const pass = injected === expectInjection;
    console.log(
      (pass ? 'PASS ' : 'FAIL ') +
      name +
      ': ' +
      (injected ? 'injected' : 'no injection') +
      ' (expected ' +
      (expectInjection ? 'injected' : 'no injection') +
      ')'
    );
    return pass;
  } finally {
    rmSync(fixture.home, { recursive: true, force: true });
  }
}

async function main() {
  console.log('Testing onboarding_injection flag authority on cold starts');

  const raceDelayMs = 1000;
  const followUpDelayMs = 2000;

  const flagsFalseServer = await startFlagServer(
    { onboarding_injection: false },
    raceDelayMs
  );
  const flagsTrueServer = await startFlagServer(
    { onboarding_injection: true },
    raceDelayMs
  );
  const unreachableUrl = 'http://127.0.0.1:9/';

  const results = [];
  try {
    results.push(await runScenario({
      name: 'cold start, flag server unreachable',
      expectInjection: false,
      fixture: makeHome(),
      flagUrl: unreachableUrl,
      followUpDelayMs
    }));

    results.push(await runScenario({
      name: 'cold start, flags(false) delayed',
      expectInjection: false,
      fixture: makeHome(),
      flagUrl: 'http://127.0.0.1:' + flagsFalseServer.address().port + '/',
      followUpDelayMs
    }));

    results.push(await runScenario({
      name: 'cold start, flags(true) delayed',
      expectInjection: true,
      fixture: makeHome(),
      flagUrl: 'http://127.0.0.1:' + flagsTrueServer.address().port + '/',
      followUpDelayMs
    }));

    results.push(await runScenario({
      name: 'warm cache with flags(false), no network',
      expectInjection: false,
      fixture: makeHome({ cachedFlags: { onboarding_injection: false } }),
      flagUrl: unreachableUrl
    }));
  } finally {
    await new Promise(resolve => flagsFalseServer.close(resolve));
    await new Promise(resolve => flagsTrueServer.close(resolve));
  }

  const failed = results.filter(value => !value).length;
  if (failed > 0) {
    console.error(failed + '/' + results.length + ' onboarding scenarios failed');
    process.exit(1);
  }

  console.log('All ' + results.length + ' onboarding scenarios passed');
}

main().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
