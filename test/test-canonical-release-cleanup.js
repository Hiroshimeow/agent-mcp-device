import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

assert.equal(fs.existsSync(path.join(root, 'src', 'remote-device')), false, 'active source namespace must not be remote-device');
assert.equal(fs.existsSync(path.join(root, 'src', 'device', 'device.ts')), true, 'canonical src/device namespace must exist');

const pkg = JSON.parse(read('package.json'));
for (const [name, script] of Object.entries(pkg.scripts || {})) {
  if (name === 'build' || name === 'prepack') continue;
  assert.doesNotMatch(script, /src\/remote-device|dist\/remote-device/, `script ${name} must use canonical device namespace`);
}
assert.match(pkg.scripts?.build || '', /^shx rm -rf dist\/remote-device/, 'build must prune stale dist/remote-device before emit');
assert.match(pkg.scripts?.build || '', /dist\/device\/desktop-commander-integration\.js/, 'build must prune the renamed upstream adapter artifact');
assert.match(pkg.scripts?.build || '', /dist\/device\/windows-dpapi\.js/, 'build must prune the removed Windows DPAPI artifact before emit');
assert.match(pkg.scripts?.build || '', /&& tsc/, 'build must prune stale outputs before TypeScript emit');
assert.match(pkg.scripts?.prepack || '', /rm -rf dist\/remote-device/, 'prepack must prune stale dist/remote-device artifacts');
assert.match(pkg.scripts?.prepack || '', /dist\/device\/desktop-commander-integration\.js/, 'prepack must prune the renamed upstream adapter artifact');
assert.match(pkg.scripts?.prepack || '', /dist\/device\/windows-dpapi\.js/, 'prepack must never ship the removed Windows DPAPI artifact');

const config = read('src/config.ts');
assert.match(config, /MCP_DEVICE_CONFIG_DIR/);
assert.doesNotMatch(config, /\.claude-server-commander/);
assert.doesNotMatch(config, /claude_tool_call\.log/);
assert.match(config, /\.mcp-device/);

const history = read('src/utils/toolHistory.ts');
assert.doesNotMatch(history, /\.claude-server-commander|tool-history\.jsonl/);
assert.match(history, /CONFIG_DIR/);

const fuzzy = read('src/utils/fuzzySearchLogger.ts');
assert.doesNotMatch(fuzzy, /\.claude-server-commander-logs/);
assert.match(fuzzy, /CONFIG_DIR/);

const isolatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-device-canonical-state-'));
const legacyOverride = path.join(isolatedRoot, 'legacy-override-must-not-win');
process.env.MCP_DEVICE_CONFIG_DIR = isolatedRoot;
process.env.DESKTOP_COMMANDER_CONFIG_DIR = legacyOverride;
try {
  const configModule = await import('../dist/config.js');
  const { toolHistory } = await import('../dist/utils/toolHistory.js');
  const { fuzzySearchLogger } = await import('../dist/utils/fuzzySearchLogger.js');
  assert.equal(configModule.CONFIG_DIR, isolatedRoot, 'MCP_DEVICE_CONFIG_DIR must own active state');
  assert.equal(configModule.TOOL_CALL_FILE, path.join(isolatedRoot, 'logs', 'tool-calls.log'));
  assert.equal(toolHistory.getStats().historyFile, path.join(isolatedRoot, 'logs', 'history.jsonl'));
  assert.equal(await fuzzySearchLogger.getLogPath(), path.join(isolatedRoot, 'logs', 'fuzzy-search.log'));
  assert.equal(fs.existsSync(legacyOverride), false, 'legacy config override must not receive active writes when canonical override exists');
  await toolHistory.cleanup();
} finally {
  delete process.env.MCP_DEVICE_CONFIG_DIR;
  delete process.env.DESKTOP_COMMANDER_CONFIG_DIR;
  fs.rmSync(isolatedRoot, { recursive: true, force: true });
}

for (const [rel, pattern] of [
  ['src/npm-scripts/remote.ts', /remote-device/],
  ['src/server.ts', /remote-device wrapper/],
  ['src/utils/capture.ts', /remote-device telemetry/]
]) {
  assert.doesNotMatch(read(rel), pattern, `${rel} contains stale active product naming`);
}

const serverSource = read('src/server.ts');
assert.match(serverSource, /name:\s*"mcp-device"/);
assert.doesNotMatch(serverSource, /name:\s*"desktop-commander"/);
assert.doesNotMatch(serverSource, /use Desktop Commander|version of the DesktopCommander/);

const uiContracts = read('src/ui/contracts.ts');
assert.match(uiContracts, /ui:\/\/mcp-device\//);
assert.doesNotMatch(uiContracts, /ui:\/\/desktop-commander\//);

for (const rel of [
  'src/tools/prompts.ts',
  'src/ui/config-editor/src/app.ts',
  'src/ui/file-preview/src/app.ts',
  'src/ui/resources.ts',
  'src/config-field-definitions.ts',
  'src/utils/ripgrep-resolver.ts',
  'src/utils/system-info.ts'
]) {
  assert.doesNotMatch(read(rel), /Desktop Commander/, `${rel} exposes stale public product branding`);
}
assert.doesNotMatch(read('src/utils/usageTracker.ts'), /Desktop Commander Team request|New to Desktop Commander|used Desktop Commander|tool calls with Desktop Commander/);
assert.doesNotMatch(read('src/custom-stdio.ts'), /\[INFO\] Desktop Commander:|logger:\s*"desktop-commander"/);
assert.doesNotMatch(read('src/index.ts'), /logger:\s*"desktop-commander"/);
assert.doesNotMatch(read('src/utils/logger.ts'), /logger:\s*"desktop-commander"/);
assert.doesNotMatch(read('src/ui/shared/widget-state.ts'), /desktop-commander:widget-state|__dc_widget_id__/);
assert.match(read('src/ui/shared/widget-state.ts'), /mcp-device:widget-state|__mcp_device_widget_id__/);
assert.doesNotMatch(read('src/utils/open-browser.ts'), /desktopcommander\.app\/welcome|Desktop Commander welcome page/);
assert.match(read('src/utils/open-browser.ts'), /Hiroshimeow\/agent-mcp-device/);

const allowlist = JSON.parse(read('test/fixtures/canonical-legacy-allowlist.json'));
for (const entry of allowlist) {
  assert.match(entry.reason, /^[BCD]$/, `invalid reason code for ${entry.file}`);
  assert.ok(entry.why, `missing allowlist rationale for ${entry.file}`);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
const shippedFiles = [
  'README.md',
  'package.json',
  ...walk(path.join(root, 'src'))
    .filter(file => /\.(?:ts|md)$/.test(file))
    .map(file => path.relative(root, file).replaceAll('\\', '/'))
];
const stalePattern = /remote-device|hcu-device|\.claude-server-commander|claude_tool_call\.log|tool-history\.jsonl|DC_REMOTE_DEVICE|DESKTOP_COMMANDER_[A-Z0-9_]+|Desktop Commander|desktop-commander|desktopcommander|DesktopCommander|give_feedback_to_desktop_commander/gi;
for (const rel of shippedFiles) {
  let content = read(rel);
  for (const entry of allowlist.filter(item => item.file === rel).sort((a, b) => b.token.length - a.token.length)) {
    const parts = content.split(entry.token);
    assert.equal(parts.length - 1, entry.count, `allowlist count changed for ${entry.file}: ${entry.token}`);
    content = parts.join(' '.repeat(entry.token.length));
  }
  const unexplained = content.match(stalePattern) || [];
  assert.deepEqual(unexplained, [], `${rel} has unexplained stale identity: ${unexplained.join(', ')}`);
}

console.log('canonical release cleanup tests passed');
