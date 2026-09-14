import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-remote-yolo-'));
const configDir = path.join(root, 'config');
const narrowDir = path.join(root, 'narrow');
const wideDir = path.join(root, 'wide');
await fs.mkdir(configDir, { recursive: true });
await fs.mkdir(narrowDir, { recursive: true });
await fs.mkdir(wideDir, { recursive: true });
const target = path.join(wideDir, 'outside-legacy-allowlist.txt');
await fs.writeFile(target, 'wide-access-ok', 'utf8');
await fs.writeFile(path.join(configDir, 'config.json'), JSON.stringify({ allowedDirectories: [narrowDir] }), 'utf8');

process.env.DESKTOP_COMMANDER_CONFIG_DIR = configDir;
const { validatePath } = await import('../dist/tools/filesystem.js');

process.env.DC_REMOTE_DEVICE = 'false';
await assert.rejects(validatePath(target), /Path not allowed/);

process.env.DC_REMOTE_DEVICE = 'true';
assert.equal(await validatePath(target), await fs.realpath(target));

await fs.rm(root, { recursive: true, force: true });
console.log('Remote YOLO path access test passed');
