import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function createMcpClient(projectRoot, options = {}) {
  const runId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const configDir = options.configDir ?? path.join(os.tmpdir(), `mcp-device-bench-config-${runId}`);
  await fs.mkdir(configDir, { recursive: true });

  const resourceFile = options.resourceFile ?? null;
  const nodeOptions = resourceFile
    ? [process.env.NODE_OPTIONS, `--require=${path.join(projectRoot, 'bench', 'lib', 'resource-preload.cjs')}`].filter(Boolean).join(' ')
    : process.env.NODE_OPTIONS;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(projectRoot, 'dist', 'index.js'), '--no-onboarding'],
    cwd: projectRoot,
    stderr: 'pipe',
    env: {
      ...process.env,
      MCP_DEVICE_DISABLE_TELEMETRY: 'true',
      MCP_DEVICE_CONFIG_DIR: configDir,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      ...(resourceFile ? {
        MCP_BENCH_RESOURCE_FILE: resourceFile,
        MCP_BENCH_RESOURCE_INTERVAL_MS: String(options.resourceIntervalMs ?? 100),
      } : {}),
    },
  });

  const stderrChunks = [];
  transport.stderr?.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk).toString('utf8')));

  const client = new Client(
    { name: 'mcp-device-neutral-benchmark', version: '1.0.0' },
    { capabilities: {} }
  );
  await client.connect(transport, { timeout: 30000 });

  return {
    client,
    configDir,
    resourceFile,
    getStderr: () => stderrChunks.join(''),
    async close() {
      await client.close().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 750));
      await fs.rm(configDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
