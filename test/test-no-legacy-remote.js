import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const deviceSource = fs.readFileSync(path.join(root, 'src', 'remote-device', 'device.ts'), 'utf8');

assert.equal(pkg.dependencies?.['@supabase/supabase-js'], undefined, 'HCU device must not ship the legacy Supabase remote transport');
assert.equal(fs.existsSync(path.join(root, 'src', 'remote-device', 'remote-channel.ts')), false, 'legacy RemoteChannel source must be removed');
assert.equal(fs.existsSync(path.join(root, 'src', 'remote-device', 'device-authenticator.ts')), false, 'legacy Desktop Commander Remote authenticator must be removed');
assert.equal(fs.existsSync(path.join(root, 'src', 'remote-device', 'scripts', 'blocking-offline-update.js')), false, 'legacy Supabase offline updater must be removed');
assert.doesNotMatch(deviceSource, /MCP_SERVER_URL|mcp\.desktopcommander\.app|RemoteChannel|fetchSupabaseConfig|persistSession/, 'device runtime must only use the direct HCU Gateway transport');

console.log('HCU device has no legacy Desktop Commander Remote transport');
