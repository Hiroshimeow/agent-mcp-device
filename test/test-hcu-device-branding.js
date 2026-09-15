import assert from 'assert';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.name, '@hcu/device');
assert.equal(pkg.bin?.['hcu-device'], 'dist/hcu-device.js');
assert.equal(pkg.bin?.['desktop-commander'], undefined);
assert.equal(pkg.mcpName, undefined);
assert.equal(pkg.repository?.url, 'https://github.com/Hiroshimeow/agent-mcp-device.git');

const wrapper = fs.readFileSync(new URL('../src/hcu-device.ts', import.meta.url), 'utf8');
assert.match(wrapper, /splice\(2,\s*0,\s*['\"]remote['\"]\)/);

console.log('HCU device package identity test passed');
