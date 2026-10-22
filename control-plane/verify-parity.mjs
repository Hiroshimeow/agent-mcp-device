#!/usr/bin/env node
// Read-only provenance checks by default. Test groups are explicit in gateway-parity.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(packageRoot, relative), 'utf8'));
const manifest = readJson('specs/008-v12-platform/gateway-import-manifest.json');
const inventory = readJson('specs/008-v12-platform/gateway-parity.json');
const argv = process.argv.slice(2);
const failures = [];
const adaptations = new Map((manifest.adaptations || []).map(row => [row.target, row]));
const rawDigest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const digest = file => rawDigest(fs.readFileSync(file));
function verifyContent(file, expected) {
  const bytes = fs.readFileSync(file);
  if (!expected.canonical) return rawDigest(bytes) === expected.sha256;
  const text = bytes.toString('utf8');
  const isText = !bytes.includes(0) && Buffer.from(text, 'utf8').equals(bytes);
  const kind = isText ? 'utf8-lf' : 'raw-bytes';
  const normalized = isText ? Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8') : bytes;
  return kind === expected.canonical.kind && rawDigest(normalized) === expected.canonical.sha256;
}
const seen = new Set();
let unchanged = 0;
let adapted = 0;
let candidateRawCaptureMatches = 0;
for (const file of manifest.files) {
  if (seen.has(file.target)) failures.push('duplicate target: ' + file.target);
  seen.add(file.target);
  const target = path.resolve(packageRoot, file.target);
  if (!target.startsWith(packageRoot + path.sep)) { failures.push('target escapes package: ' + file.target); continue; }
  if (!fs.existsSync(target)) { failures.push('missing target: ' + file.target); continue; }
  const adaptation = adaptations.get(file.target);
  const expected = adaptation || file;
  if (!verifyContent(target, expected)) failures.push('target canonical content differs from recorded evidence: ' + file.target);
  if (digest(target) === expected.sha256) candidateRawCaptureMatches += 1;
  if (adaptation) adapted += 1; else unchanged += 1;
}
for (const addition of manifest.additions || []) {
  const target = path.resolve(packageRoot, addition.target);
  if (!target.startsWith(packageRoot + path.sep) || !fs.existsSync(target)) {
    failures.push('missing/invalid addition: ' + addition.target); continue;
  }
  if (!verifyContent(target, addition)) failures.push('addition canonical content differs from recorded evidence: ' + addition.target);
}
for (const adaptation of adaptations.values()) {
  if (!seen.has(adaptation.target)) failures.push('adaptation has no original source: ' + adaptation.target);
}
for (const entry of inventory.entries) {
  if (!entry.assertions?.length || !entry.command?.args?.length || !entry.source?.length || !entry.classification) {
    failures.push('incomplete executable inventory entry: ' + entry.id);
  }
  for (const test of entry.tests || []) {
    if (!fs.existsSync(path.join(packageRoot, 'control-plane', test))) failures.push('missing retained test: ' + test);
  }
}
let sourceVerification = 'NOT_REQUESTED';
let sourceRawCaptureMatches = 0;
const sourceRootIndex = argv.indexOf('--source-root');
const sourceRoot = sourceRootIndex >= 0 ? path.resolve(argv[sourceRootIndex + 1]) : manifest.sourceRoot;
if (argv.includes('--source')) {
  if (!fs.existsSync(sourceRoot)) {
    failures.push('source repository unavailable for --source');
  } else {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
    if (head !== manifest.sourceHead) failures.push('source HEAD differs from recorded baseline');
    const dirty = execFileSync('git', ['status', '--porcelain=v1'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
    if (dirty) failures.push('source repository has unreviewed working-tree changes');
    for (const file of manifest.files) {
      const original = path.join(sourceRoot, file.source);
      if (!fs.existsSync(original) || !verifyContent(original, file)) failures.push('source canonical provenance differs: ' + file.source);
      else if (digest(original) === file.sha256) sourceRawCaptureMatches += 1;
    }
    sourceVerification = failures.length ? 'FAILED' : 'PASS';
  }
}
const runIndex = argv.indexOf('--run');
const results = [];
if (runIndex !== -1 && failures.length === 0) {
  const requested = argv[runIndex + 1];
  const groups = requested === 'all-safe'
    ? inventory.executionGroups.filter(group => group.listener === 'NONE')
    : inventory.executionGroups.filter(group => group.id === requested);
  if (groups.length === 0) failures.push('unknown test group: ' + requested);
  for (const group of groups) {
    const result = spawnSync(process.execPath, group.args, {
      cwd: path.resolve(packageRoot, group.cwd),
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    const totals = [...String(result.stdout).matchAll(/^# tests (\d+)$/gm)];
    let tests = totals.length ? Number(totals.at(-1)[1]) : 0;
    let declaredStatus = null;
    if (group.resultFormat === 'json-summary') {
      try { const summary = JSON.parse(result.stdout); tests = summary.tests; declaredStatus = summary.status; } catch {}
    }
    const pass = result.status === 0 && tests >= group.minimumTests && (declaredStatus === null || declaredStatus === 'PASS');
    results.push({ group: group.id, exitCode: result.status, tests, status: pass ? 'PASS' : 'FAIL' });
    if (!pass) failures.push('test group failed or was vacuous: ' + group.id);
  }
}
console.log(JSON.stringify({
  product: manifest.targetProduct, version: manifest.targetVersion, node: process.version,
  sourceHead: manifest.sourceHead, importedFiles: manifest.files.length,
  unchanged, adapted, candidateRawCaptureMatches, sourceRawCaptureMatches, additions: (manifest.additions || []).length,
  inventoryFamilies: inventory.entries.length, sourceVerification,
  executionGroups: inventory.executionGroups.map(({ id, listener, minimumTests }) => ({ id, listener, minimumTests })),
  results, failures, status: failures.length ? 'FAIL' : 'PASS'
}, null, 2));
process.exitCode = failures.length ? 1 : 0;
