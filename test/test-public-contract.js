import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { GATEWAY_CAPABILITIES } from '../dist/device/gateway-tool-adapter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  await fs.readFile(path.join(here, 'fixtures', 'public-contract-v1.json'), 'utf8')
);

const expectedRequiredArguments = {
  read_text_file: ['path', 'device_id'],
  write_file: ['path', 'content', 'device_id'],
  edit_file: ['path', 'old_text', 'new_text', 'device_id'],
  shell_execute: ['command', 'working_directory', 'device_id'],
  start_process: ['command', 'working_directory', 'device_id'],
  read_process_output: ['session_id'],
  interact_with_process: ['session_id', 'input'],
  terminate_process: ['session_id'],
  image_preview: ['device_id'],
  project_inspect: ['device_id', 'project_id', 'view']
};

assert.equal(fixture.source, 'gateway-public-schema');
assert.deepEqual([...GATEWAY_CAPABILITIES], fixture.capabilities);
assert.deepEqual(fixture.requiredArguments, expectedRequiredArguments);
assert.deepEqual(fixture.emptyStringCompatibility, {
  'write_file.content': true,
  'edit_file.new_text': true,
  'interact_with_process.input': true
});
assert.equal(new Set(fixture.capabilities).size, fixture.capabilities.length);

// The public gateway owns device_id selection and strips it before dispatch.
// Follow-up process calls intentionally remain session_id-only.
for (const tool of ['read_process_output', 'interact_with_process', 'terminate_process']) {
  assert(!fixture.requiredArguments[tool].includes('device_id'));
}
assert(fixture.requiredArguments.start_process.includes('device_id'));
assert(fixture.requiredArguments.shell_execute.includes('device_id'));

console.log('Public MCP Device gateway contract fixture is pinned to the gateway schema');
process.exit(0);
