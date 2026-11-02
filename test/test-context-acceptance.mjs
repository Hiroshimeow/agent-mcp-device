import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
test('Context acceptance validates release identity without pinning a release', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'context-acceptance-'));
  try {
    for (const dir of ['docs', 'skills', 'scripts', 'specs']) cpSync(join(root, dir), join(fixture, dir), { recursive: true });
    for (const name of readdirSync(root).filter(name => name.endsWith('.md'))) cpSync(join(root, name), join(fixture, name));
    mkdirSync(join(fixture, 'src/context'), { recursive: true });
    cpSync(join(root, 'src/context/tool-contract.ts'), join(fixture, 'src/context/tool-contract.ts'));
    cpSync(join(root, 'LICENSE'), join(fixture, 'LICENSE'));
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
    const check = (version, mutate = () => {}, expected = []) => {
      const p = structuredClone(pkg), l = structuredClone(lock);
      p.version = l.version = l.packages[''].version = version;
      const state = { pkg: p, lock: l, runtime: `export const VERSION = '${version}';\n` };
      mutate(state);
      writeFileSync(join(fixture, 'package.json'), JSON.stringify(state.pkg));
      writeFileSync(join(fixture, 'package-lock.json'), JSON.stringify(state.lock));
      writeFileSync(join(fixture, 'src/version.ts'), state.runtime);
      const result = spawnSync(process.execPath, ['scripts/check-context-acceptance.mjs'], { cwd: fixture, encoding: 'utf8' });
      assert.equal(result.error, undefined);
      const report = JSON.parse(result.stdout);
      assert.equal(report.requirements, 32);
      assert.equal(report.success_criteria, 8);
      assert.equal(report.tasks, 62);
      assert.deepEqual(report.errors, expected, `${version}: ${result.stdout} ${result.stderr}`);
      assert.equal(result.status, expected.length ? 1 : 0);
    };
    check('1.0.11', s => { s.runtime = "export const VERSION = '1.0.12'; // '1.0.11'\n"; }, ['Runtime version mismatch']);
    check('1.0.12');
    check('2.3.4-rc.1+build.7');
    check('1.0.11');
    for (const version of ['garbage', 'v1.0.12', '01.0.12', '1.0', '1.0.12-01', '1.0.12\n']) {
      check(version, s => { s.runtime = "export const VERSION = '1.0.12';\n"; }, ['Version identity mismatch', 'Runtime version mismatch']);
    }
    check('1.0.12', s => { s.lock.version = '1.0.11'; }, ['Version identity mismatch']);
    check('1.0.12', s => { s.lock.packages[''].version = '1.0.11'; }, ['Version identity mismatch']);
    check('1.0.12', s => { s.runtime = "export const VERSION = '1.0.11'; // '1.0.12'\n"; }, ['Runtime version mismatch']);
    check('1.0.12', s => { s.runtime += "export const OTHER = '1.0.12';\n"; }, ['Runtime version mismatch']);
    check('1.0.12', s => { s.pkg.engines.node = '>=20'; }, ['Node floor mismatch']);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
