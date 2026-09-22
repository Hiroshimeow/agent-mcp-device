import assert from 'assert';
import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const childEntrypoint = path.join(projectRoot, 'dist', 'index.js');

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-remote-child-'));
const runtime = path.join(root, 'runtime');
const filesDir = path.join(root, 'files');
const configPath = path.join(root, 'config.json');
const flagsPath = path.join(root, 'feature-flags.json');
const secretPath = path.join(filesDir, 'secret.txt');
const readPath = path.join(filesDir, 'read.txt');

await fs.mkdir(runtime, { recursive: true });
await fs.mkdir(filesDir, { recursive: true });
await fs.writeFile(readPath, 'remote child hygiene content\n', 'utf8');

const initialConfig = {
  blockedCommands: [],
  defaultShell: process.platform === 'win32' ? 'powershell.exe' : '/bin/sh',
  allowedDirectories: [filesDir],
  telemetryEnabled: true,
  fileWriteLineLimit: 50,
  fileReadLineLimit: 1000,
  pendingWelcomeOnboarding: true,
  welcomeOnboardingEligible: true,
  currentClient: { name: 'docker', version: 'test' },
  usageStats: {
    filesystemOperations: 0,
    terminalOperations: 0,
    editOperations: 0,
    searchOperations: 0,
    configOperations: 0,
    processOperations: 0,
    totalToolCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    toolCounts: {},
    firstUsed: 1,
    lastUsed: 1,
    totalSessions: 0,
    lastFeedbackPrompt: 0
  }
};
const initialConfigText = JSON.stringify(initialConfig, null, 2);
await fs.writeFile(configPath, initialConfigText, 'utf8');
await fs.writeFile(flagsPath, JSON.stringify({
  version: 'test',
  flags: {
    user_surveys: true,
    onboarding_injection: true,
    welcome_page_enabled: true,
    welcome_page_excluded_clients: []
  }
}, null, 2), 'utf8');

let flagRequests = 0;
const flagServer = http.createServer((_req, res) => {
  flagRequests++;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ flags: { user_surveys: true, onboarding_injection: true } }));
});
await new Promise((resolve, reject) => {
  flagServer.once('error', reject);
  flagServer.listen(0, '127.0.0.1', resolve);
});
const address = flagServer.address();
const flagUrl = `http://127.0.0.1:${address.port}/flags.json`;

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [childEntrypoint],
  cwd: runtime,
  stderr: 'pipe',
  env: {
    ...getDefaultEnvironment(),
    MCP_DEVICE_REMOTE: 'true',
    MCP_DEVICE_CONFIG_DIR: root,
    MCP_DEVICE_DISABLE_TELEMETRY: 'true',
    DC_FLAG_URL: flagUrl
  }
});
const client = new Client(
  { name: 'docker', version: 'remote-hygiene-test' },
  { capabilities: {} }
);

let stderrText = '';
try {
  await client.connect(transport);
  if (transport.stderr) {
    transport.stderr.on('data', chunk => { stderrText += chunk.toString(); });
  }

  const readResult = await client.callTool({
    name: 'read_file',
    arguments: { path: readPath },
    _meta: {
      remote: true,
      clientInfo: { name: 'remote-hygiene-test', version: '1.0.0' }
    }
  });

  const readText = (readResult.content || [])
    .filter(item => item.type === 'text')
    .map(item => item.text || '')
    .join('\n');
  assert.match(readText, /remote child hygiene content/);
  assert(!/SYSTEM INSTRUCTION|Docker setup notice|feedback|onboarding/i.test(readText),
    'remote result must not receive inherited prompt injection');

  const secret = 'REMOTE_CHILD_SECRET_92731';
  const writeResult = await client.callTool({
    name: 'write_file',
    arguments: { path: secretPath, content: secret, mode: 'rewrite' },
    _meta: {
      remote: true,
      clientInfo: { name: 'remote-hygiene-test', version: '1.0.0' }
    }
  });
  assert.equal(writeResult.isError, undefined);
  assert.equal(await fs.readFile(secretPath, 'utf8'), secret);

  // Give the inherited async history writer more than one flush interval.
  await new Promise(resolve => setTimeout(resolve, 1200));

  assert.equal(flagRequests, 0, 'remote child must never fetch external feature flags');

  const finalConfigText = await fs.readFile(configPath, 'utf8');
  assert.equal(finalConfigText, initialConfigText,
    'remote tool calls must not persist usage/onboarding/client mutations to config.json');

  const historyPath = path.join(root, 'logs', 'history.jsonl');
  await assert.rejects(() => fs.access(historyPath), /ENOENT/,
    'remote calls must not be persisted to inherited raw tool history');

  const toolLog = await fs.readFile(path.join(root, 'logs', 'tool-calls.log'), 'utf8');
  assert(!toolLog.includes(secret), 'remote tool-call log must not persist raw file contents');
  assert(!toolLog.includes(readPath), 'remote tool-call log must not persist raw file paths');
  assert.match(toolLog, /Args: count=/);

  assert.equal(
    JSON.parse(await fs.readFile(flagsPath, 'utf8')).version,
    'test',
    'pre-seeded feature flag cache must remain untouched in remote mode'
  );

  console.log('Remote child hygiene integration passed');
} finally {
  await client.close().catch(() => {});
  await transport.close().catch(() => {});
  await new Promise(resolve => flagServer.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}
process.exit(0);
