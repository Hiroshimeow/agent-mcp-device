import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeCommandShims } from './command-shims-fixture.mjs';

const selectedShell = process.env.SHELL || (process.platform === 'win32' ? process.env.COMSPEC || 'cmd.exe' : '/bin/sh');
const shells = [...new Set([selectedShell, ...(process.platform === 'win32' ? [process.env.COMSPEC || 'cmd.exe'] : [])])];
for (const shell of shells) test(`command shims execute through real shell_execute: ${shell}`, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'v12-command-shims-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }));
  const { GatewayToolAdapter } = await import('../../dist/device/gateway-tool-adapter.js');
  const adapter = new GatewayToolAdapter(undefined, { allowedRoots: [dir], pathValidator: async requested => requested });
  const bin = path.join(dir, 'bin with spaces');
  const entry = path.join(dir, 'entry with spaces.mjs');
  await fs.writeFile(entry, 'console.log(JSON.stringify(process.argv.slice(2)));');
  await writeCommandShims(bin, [['fixture-command', entry]]);
  const beforePath = process.env.PATH, beforeShell = process.env.SHELL;
  process.env.PATH = bin + path.delimiter + beforePath;
  process.env.SHELL = shell;
  try {
    const result = await adapter.call('shell_execute', { command: 'fixture-command "argument with spaces"', working_directory: dir, timeout_ms: 10000 });
    assert.equal(result.exitCode, 0, JSON.stringify(result));
    assert.deepEqual(JSON.parse(result.stdout), ['argument with spaces']);
  } finally {
    process.env.PATH = beforePath;
    if (beforeShell === undefined) delete process.env.SHELL; else process.env.SHELL = beforeShell;
  }
});
