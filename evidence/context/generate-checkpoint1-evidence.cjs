const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const files = [
  'src/context/search.ts',
  'src/context/store.ts',
  'src/context/migrations/index.ts',
  'test/context/fixtures/migration-worker.js',
  'test/context/fixtures/v2-schema.js',
  'test/context/helpers.js',
  'test/context/retrieval.test.js',
];
const tap = readFileSync(resolve(__dirname, 'checkpoint1-complete.tap'), 'utf8');
if (!/# tests 48\r?\n/.test(tap) || !/# pass 48\r?\n/.test(tap) || !/# fail 0\r?\n/.test(tap)) {
  throw new Error('Full-suite passing TAP evidence required');
}
let document = `# Checkpoint 1 complete evidence — 002-device-local-context\n\n`;
document += `This file embeds complete source files and the unabridged context-suite TAP output; no external snippets are needed for B1–B3 review.\n\n`;
document += `## Verification\n\n- Workspace: E:/git-project/wt-mcp-device-111-context\n- Platform: Windows x64; Node v22.22.2; SQLite 3.51.2.\n- \`npm run build\`: exit 0 (TypeScript compilation and build steps succeeded).\n- \`node --test test/context/*.test.js\`: exit 0; 48 tests, 48 passed, 0 failed, 0 skipped.\n- SQLite ExperimentalWarning is expected and included without suppression.\n\n`;
document += `## Requirement mapping\n\n`;
document += `- **B1-a:** createV2Repository builds the historical v2 schema directly before starting the worker; the race asserts all eight required tables and version 2.\n`;
document += `- **B1-b:** the v4 race explicitly asserts versions [2, 4], demonstrating the post-lock version recheck.\n`;
document += `- **B1-c:** INDEX_INCOMPATIBLE immediately triggers BEGIN IMMEDIATE; COMMIT; on the same worker connection; the main thread asserts canBegin === true.\n`;
document += `- **B1-d:** rollback is guarded so a missing transaction cannot mask the original error; pre-commit, post-commit and process-crash regressions are included.\n`;
document += `- **B2-a:** a verified position field offset is changed by exactly one byte, valid JSON is asserted, and the original MAC is retained; store and service reject it as CURSOR_INVALID.\n`;
document += `- **B2-b:** every starting search/read continuation in retrieval.test.js asserts a non-null next_cursor. Search fixtures have multiple matches; read fixtures have sufficient retained bytes to force continuation.\n`;
document += `- **B2-c:** correctly signed expired search/read tokens first yield CURSOR_STALE; tampering their valid JSON key while preserving the MAC yields CURSOR_INVALID at both store and domain boundaries.\n`;
document += `- **B3-a:** the complete search SQL below uses UNION ALL, GROUP BY d.ref, min(m.score), aggregate HAVING and deterministic keyset ordering. A real dual-match event is returned once and the actual production SQL row has score 0.\n`;
document += `- **B3-c:** Unicode token extraction and individual token quoting are retained; explicit queries containing quotes, AND, minus, OR, wildcard and NEAR syntax execute without errors, including the requested combined query.\n\n`;
for (const file of files) {
  const source = readFileSync(resolve(root, file), 'utf8');
  document += `## ${file}\n\n\`\`\`${file.endsWith('.ts') ? 'typescript' : 'javascript'}\n${source}${source.endsWith('\n') ? '' : '\n'}\`\`\`\n\n`;
}
document += `## Complete TAP output\n\nCommand: \`node --test test/context/*.test.js\` (stdout and stderr captured together, exit 0).\n\n\`\`\`text\n${tap}${tap.endsWith('\n') ? '' : '\n'}\`\`\`\n`;
const output = resolve(__dirname, 'checkpoint1-complete-evidence.md');
writeFileSync(output, document);
const written = readFileSync(output, 'utf8');
for (const file of files) {
  if (!written.includes(readFileSync(resolve(root, file), 'utf8'))) throw new Error(`Incomplete source: ${file}`);
}
if (!written.includes(tap)) throw new Error('Incomplete TAP output');
console.log(`Verified ${files.length} complete source/test files and full TAP output (${Buffer.byteLength(written)} bytes).`);
