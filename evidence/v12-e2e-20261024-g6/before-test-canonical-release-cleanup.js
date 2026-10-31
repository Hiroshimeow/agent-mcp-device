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
assert.match(pkg.scripts?.build || '', /^shx rm -rf dist && tsc/, 'build must start from a clean dist directory before TypeScript emit');
assert.equal(pkg.scripts?.prepack, 'node scripts/verify-production-trust.cjs', 'prepack must only verify release trust; prepare/build owns clean output generation');

const config = read('src/config.ts');
assert.match(config, /MCP_DEVICE_CONFIG_DIR/);
assert.doesNotMatch(config, /claude_tool_call\.log/);
assert.match(config, /\.mcp-device/);

const history = read('src/utils/toolHistory.ts');
assert.doesNotMatch(history, /tool-history\.jsonl/);
assert.match(history, /CONFIG_DIR/);

const fuzzy = read('src/utils/fuzzySearchLogger.ts');
assert.match(fuzzy, /CONFIG_DIR/);

const isolatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-device-canonical-state-'));
process.env.MCP_DEVICE_CONFIG_DIR = isolatedRoot;
try {
  const configModule = await import('../dist/config.js');
  const { toolHistory } = await import('../dist/utils/toolHistory.js');
  const { fuzzySearchLogger } = await import('../dist/utils/fuzzySearchLogger.js');
  assert.equal(configModule.CONFIG_DIR, isolatedRoot, 'MCP_DEVICE_CONFIG_DIR must own active state');
  assert.equal(configModule.TOOL_CALL_FILE, path.join(isolatedRoot, 'logs', 'tool-calls.log'));
  assert.equal(toolHistory.getStats().historyFile, path.join(isolatedRoot, 'logs', 'history.jsonl'));
  assert.equal(await fuzzySearchLogger.getLogPath(), path.join(isolatedRoot, 'logs', 'fuzzy-search.log'));
  await toolHistory.cleanup();
} finally {
  delete process.env.MCP_DEVICE_CONFIG_DIR;
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

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}


// Public/runtime product identity must be vendor-neutral apart from the immutable
// package/domain identity and the v2 wire labels retained for protocol continuity.
const allowedIdentityLiterals = [
  '@hcu-lab.me/mcp-device',
  'https://device.hcu-lab.me',
  'hcu-lab.me',
  'hcu-device-v2-inner-tls',
  'hcu-mcp-device-auth-v2',
  'EXPERIMENTAL-HCU-MCP-DEVICE-AUTH-V2'
];
const forbiddenBrandPattern = /Desktop Commander|desktop-commander|DesktopCommander|desktopcommander|DESKTOP_COMMANDER_[A-Z0-9_]+|\.claude|claude|\.hcu-device|HCU-Device-|hcu-device/gi;
const brandSurfaceFiles = [
  'README.md',
  'package.json',
  ...walk(path.join(root, 'src')).filter(file => /\.(?:ts|json|html|css|md)$/.test(file)),
  ...walk(path.join(root, 'scripts')).filter(file => /\.(?:js|cjs|mjs|ts|json|md)$/.test(file)),
  ...(fs.existsSync(path.join(root, 'skills')) ? walk(path.join(root, 'skills')).filter(file => /\.(?:md|json)$/.test(file)) : [])
].map(file => path.isAbsolute(file) ? path.relative(root, file).replaceAll('\\', '/') : file);
for (const rel of brandSurfaceFiles) {
  let content = read(rel);
  for (const literal of allowedIdentityLiterals) content = content.split(literal).join(' '.repeat(literal.length));
  const matches = content.match(forbiddenBrandPattern) || [];
  assert.deepEqual(matches, [], `${rel} exposes legacy/vendor branding: ${matches.join(', ')}`);
}
assert.equal(fs.existsSync(path.join(root, 'skills', 'ai-tools-setup')), false, 'Claude-specific setup skill must not live in the runtime repo');
assert.equal(fs.existsSync(path.join(root, 'skills', 'desktop-commander-overview')), false, 'Desktop Commander overview skill must not live in the runtime repo');
assert.match(pkg.scripts?.build || '', /^shx rm -rf dist && tsc/, 'build must start from a clean dist directory');
assert.match(pkg.scripts?.prepack || '', /^node scripts\/verify-production-trust\.cjs$/, 'prepack should verify trust only; build owns clean output generation');

console.log('canonical release cleanup tests passed');
