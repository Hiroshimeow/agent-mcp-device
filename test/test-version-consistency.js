import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expectedVersion = '1.0.10';
const read = relativePath => readFile(new URL(relativePath, import.meta.url), 'utf8');

const packageJson = JSON.parse(await read('../package.json'));
const lockfile = JSON.parse(await read('../package-lock.json'));
const versionSource = await read('../src/version.ts');
const deviceSource = await read('../src/device/device.ts');

assert.equal(packageJson.version, expectedVersion, 'package.json version');
assert.equal(lockfile.version, expectedVersion, 'package-lock.json root version');
assert.equal(lockfile.packages[''].version, expectedVersion, 'package-lock.json root package version');
assert.equal(versionSource.match(/export const VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1], expectedVersion, 'src/version.ts VERSION');
assert.equal(deviceSource.match(/agentVersion:\s*VERSION\s*\|\|\s*process\.env\.npm_package_version\s*\|\|\s*['"]([^'"]+)['"]/)?.[1], expectedVersion, 'src/device/device.ts fallback version');

console.log(`PASS: package.json, package-lock.json (root and root package), version.ts, and device.ts match ${expectedVersion}`);
