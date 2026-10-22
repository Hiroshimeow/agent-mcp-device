import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const server = process.argv.includes('--server');
const files = fs.readdirSync(path.join(root, 'test', 'v12')).filter(name => /\.test\.(?:js|mjs)$/.test(name))
  .filter(name => server ? name.startsWith('server-') : !name.startsWith('server-') && name !== 'device-core-parity.test.js').sort();
if (!files.length) throw new Error('No acceptance tests selected');
// Baseline parity is a separate command because it needs the frozen v11 checkout.
// Server acceptance explicitly owns 127.0.0.1:8104 and refuses any other listener.
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files.map(name => path.join(root, 'test', 'v12', name))], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
