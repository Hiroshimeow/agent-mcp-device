import assert from 'assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = ['pack', '--dry-run', '--json', '--ignore-scripts'];
const npmExecPath = String(process.env.npm_execpath || '').trim();

const result = npmExecPath
  ? spawnSync(process.execPath, [npmExecPath, ...args], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true
    })
  : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      shell: process.platform === 'win32'
    });

assert.equal(result.status, 0, result.stderr || result.stdout || 'npm pack --dry-run failed');
const stdout = String(result.stdout || '').trim();
const jsonStart = stdout.indexOf('[');
assert(jsonStart >= 0, 'npm pack --dry-run did not return JSON');
const payload = JSON.parse(stdout.slice(jsonStart));
const pack = payload[0];
assert(pack, 'npm pack --dry-run returned no package entry');

const paths = (pack.files || []).map(file => String(file.path));
assert(paths.includes('dist/device/update-helper.cjs'), 'published package must contain update helper');
assert(paths.includes('package.json'), 'published package must contain package.json');
assert(!paths.some(file => file.startsWith('src/')), 'src/ must not be published');
assert(!paths.some(file => file.startsWith('test/')), 'test/ must not be published');
assert(!paths.some(file => file.startsWith('.plan/')), '.plan/ must not be published');

console.log(`Package publish surface is bounded: ${paths.length} files`);
process.exit(0);
