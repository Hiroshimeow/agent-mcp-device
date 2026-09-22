import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const deviceSource = fs.readFileSync(path.join(root, 'src', 'device', 'device.ts'), 'utf8');

assert.equal(pkg.dependencies?.['@supabase/supabase-js'], undefined, 'MCP Device must not ship the legacy Supabase remote transport');
assert.equal(pkg.dependencies?.glob, undefined, 'MCP Device must not ship the unused direct glob dependency');
assert.equal(fs.existsSync(path.join(root, 'src', 'device', 'remote-channel.ts')), false, 'legacy RemoteChannel source must be removed');
assert.equal(fs.existsSync(path.join(root, 'src', 'device', 'device-authenticator.ts')), false, 'legacy remote authenticator must be removed');
assert.equal(fs.existsSync(path.join(root, 'src', 'device', 'scripts', 'blocking-offline-update.js')), false, 'legacy Supabase offline updater must be removed');
assert.doesNotMatch(deviceSource, /MCP_SERVER_URL|RemoteChannel|fetchSupabaseConfig|persistSession/, 'device runtime must only use the direct MCP Device gateway transport');

console.log('MCP Device has no legacy remote transport');
