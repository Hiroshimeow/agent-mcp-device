import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { configManager } from '../dist/config-manager.js';
import { handleReadMultipleFiles } from '../dist/handlers/filesystem-handlers.js';
import { handleEditBlock } from '../dist/handlers/edit-search-handlers.js';
import * as searchHandlers from '../dist/handlers/search-handlers.js';

const TEST_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-compact-'));
const originalConfig = await configManager.getConfig();
await configManager.setValue('allowedDirectories', [TEST_DIR]);

let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  await check('read_multiple_files honors bounded pagination', async () => {
    const file = path.join(TEST_DIR, 'lines.txt');
    await fs.writeFile(file, 'line0\nline1\nline2\nline3\nline4\n', 'utf8');

    const result = await handleReadMultipleFiles({
      paths: [file],
      offset: 2,
      length: 2,
      maxBytes: 4096,
    });
    const text = result.content.map(item => item.text ?? '').join('\n');

    assert.match(text, /line2/);
    assert.match(text, /line3/);
    assert.doesNotMatch(text, /line0/);
    assert.doesNotMatch(text, /line4/);
    assert.match(text, /nextOffset=4/);
  });

  await check('search_once completes in one call and leaves no session', async () => {
    assert.equal(typeof searchHandlers.handleSearchOnce, 'function');
    const file = path.join(TEST_DIR, 'search.txt');
    await fs.writeFile(file, 'needle one\nneedle two\nneedle three\n', 'utf8');

    const before = await searchHandlers.handleListSearches();
    const result = await searchHandlers.handleSearchOnce({
      path: TEST_DIR,
      pattern: 'needle',
      searchType: 'content',
      literalSearch: true,
      maxResults: 2,
      maxBytes: 4096,
      timeout_ms: 2000,
      contextLines: 0,
    });
    const after = await searchHandlers.handleListSearches();
    const text = result.content.map(item => item.text ?? '').join('\n');

    assert.match(text, /needle/);
    assert.match(text, /truncated=true/);
    assert.equal(after.content[0].text, before.content[0].text);
  });

  await check('search_once context does not consume maxResults match quota', async () => {
    const file = path.join(TEST_DIR, 'search-context-single.txt');
    await fs.writeFile(file, 'before one\nbefore two\nNEEDLE_ONE\nafter one\nafter two\n', 'utf8');

    const result = await searchHandlers.handleSearchOnce({
      path: file,
      pattern: 'NEEDLE',
      searchType: 'content',
      literalSearch: true,
      maxResults: 1,
      maxBytes: 4096,
      timeout_ms: 2000,
      contextLines: 2,
    });
    const text = result.content.map(item => item.text ?? '').join('\n');

    assert.match(text, /search-context-single\.txt:3 - NEEDLE/);
    assert.match(text, /before one/);
    assert.match(text, /after two/);
    assert.match(text, /truncated=false/);
  });

  await check('search_once truncates by match count with context present', async () => {
    const file = path.join(TEST_DIR, 'search-context-multiple.txt');
    await fs.writeFile(
      file,
      'ctx a\nNEEDLE_ONE\nctx b\nNEEDLE_TWO\nctx c\nNEEDLE_THREE\nctx d\n',
      'utf8'
    );

    const result = await searchHandlers.handleSearchOnce({
      path: file,
      pattern: 'NEEDLE',
      searchType: 'content',
      literalSearch: true,
      maxResults: 2,
      maxBytes: 4096,
      timeout_ms: 2000,
      contextLines: 1,
    });
    const text = result.content.map(item => item.text ?? '').join('\n');

    assert.match(text, /search-context-multiple\.txt:2 - NEEDLE/);
    assert.match(text, /search-context-multiple\.txt:4 - NEEDLE/);
    assert.doesNotMatch(text, /search-context-multiple\.txt:6 - NEEDLE/);
    assert.match(text, /truncated=true/);
  });

  await check('edit_block batch applies exact edits with one deterministic call', async () => {
    const file = path.join(TEST_DIR, 'batch.txt');
    await fs.writeFile(file, 'alpha\r\nbeta\r\ngamma\r\n', 'utf8');

    const result = await handleEditBlock({
      file_path: file,
      edits: [
        { old_string: 'alpha', new_string: 'ALPHA', expected_replacements: 1 },
        { old_string: 'gamma', new_string: 'GAMMA', expected_replacements: 1 },
      ],
    });

    assert.equal(result.isError, undefined);
    assert.equal(await fs.readFile(file, 'utf8'), 'ALPHA\r\nbeta\r\nGAMMA\r\n');
  });

  await check('batched exact edit is atomic on cardinality failure', async () => {
    const file = path.join(TEST_DIR, 'atomic.txt');
    const original = 'one\ntwo\nthree\n';
    await fs.writeFile(file, original, 'utf8');

    const result = await handleEditBlock({
      file_path: file,
      edits: [
        { old_string: 'one', new_string: 'ONE', expected_replacements: 1 },
        { old_string: 'missing', new_string: 'X', expected_replacements: 1 },
      ],
    });

    assert.equal(result.isError, true);
    assert.equal(await fs.readFile(file, 'utf8'), original);
  });

  await check('read_multiple_files enforces UTF-8 aggregate byte budget', async () => {
    const file = path.join(TEST_DIR, 'unicode.txt');
    await fs.writeFile(file, '猫🙂'.repeat(200) + '\n', 'utf8');
    const maxBytes = 192;

    const result = await handleReadMultipleFiles({ paths: [file], maxBytes, length: 1000 });
    const bytes = result.content.reduce((sum, item) =>
      sum + Buffer.byteLength(item.text ?? item.data ?? '', 'utf8'), 0);
    const text = result.content.map(item => item.text ?? '').join('');

    assert.ok(bytes <= maxBytes, `response bytes ${bytes} exceeded budget ${maxBytes}`);
    assert.doesNotMatch(text, /�/);
    assert.match(text, /truncated=true/);
  });

  await check('same-file exact edits serialize without losing updates', async () => {
    const file = path.join(TEST_DIR, 'concurrent.txt');
    await fs.writeFile(file, 'first\nsecond\n', 'utf8');

    const [a, b] = await Promise.all([
      handleEditBlock({ file_path: file, old_string: 'first', new_string: 'FIRST' }),
      handleEditBlock({ file_path: file, old_string: 'second', new_string: 'SECOND' }),
    ]);

    assert.equal(a.isError, undefined);
    assert.equal(b.isError, undefined);
    assert.equal(await fs.readFile(file, 'utf8'), 'FIRST\nSECOND\n');
  });
} finally {
  await configManager.updateConfig(originalConfig);
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log('All compact file/search/edit tests passed.');
}
