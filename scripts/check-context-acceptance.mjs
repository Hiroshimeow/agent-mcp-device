// Current implementation consistency check; not the archived planning-only gate.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8').replace(/^\uFEFF/, '');
const spec = read('specs/002-device-local-context/spec.md');
const tasks = read('specs/002-device-local-context/tasks.md');
const errors = [];
const requirements = [...spec.matchAll(/^- \*\*(FR-\d{3})\*\*/gm)].map(m => m[1]);
const criteria = [...spec.matchAll(/^- \*\*(SC-\d{3})\*\*/gm)].map(m => m[1]);
const ids = [...tasks.matchAll(/^- \[[ xX]\] (T\d{3})/gm)].map(m => m[1]);
if (requirements.length !== 32 || criteria.length !== 8 || ids.length !== 62) errors.push('Unexpected spec/task inventory');
ids.forEach((id, index) => { if (id !== `T${String(index + 1).padStart(3, '0')}`) errors.push(`Nonsequential ${id}`); });
for (const id of requirements) if (!tasks.includes(`| ${id} |`)) errors.push(`Unmapped ${id}`);
for (const id of criteria) if (!tasks.includes(`${id}:`)) errors.push(`Unmapped ${id}`);
for (const match of tasks.matchAll(/^\| FR-\d{3} \| ([^\n]+)\|$/gm)) {
  for (const id of match[1].match(/T\d{3}/g) ?? []) if (!ids.includes(id)) errors.push(`Unknown mapped task ${id}`);
}
const docs = ['spec.md', 'plan.md', 'research.md', 'data-model.md', 'integration-110.md', 'quickstart.md', 'tasks.md',
  'contracts/context-api.md', 'contracts/context-policy.md', 'contracts/skill-contract.md', 'checklists/requirements.md', 'checklists/implementation-gates.md']
  .map(file => `specs/002-device-local-context/${file}`)
  .concat(['README.md', 'PRIVACY.md', 'docs/context.md', 'skills/mcp-device-context/SKILL.md']);
for (const file of docs) {
  if (!existsSync(resolve(root, file))) { errors.push(`Missing ${file}`); continue; }
  const body = read(file);
  if (/\[NEEDS CLARIFICATION:|\[###-feature-name\]/.test(body)) errors.push(`Unfilled scaffold ${file}`);
  for (const match of body.matchAll(/\[[^\]\n]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (target && !/^[a-z]+:/i.test(target) && !existsSync(resolve(root, dirname(file), target))) errors.push(`Broken link ${file}: ${target}`);
  }
}
const pkg = JSON.parse(read('package.json')), lock = JSON.parse(read('package-lock.json'));
if (pkg.version !== '1.0.11' || lock.version !== pkg.version || lock.packages[''].version !== pkg.version) errors.push('Version identity mismatch');
if (pkg.engines.node !== '>=22.13.0' || lock.packages[''].engines.node !== pkg.engines.node) errors.push('Node floor mismatch');
if (!read('src/version.ts').includes("'1.0.11'")) errors.push('Runtime version mismatch');
console.log(JSON.stringify({ kind: 'implementation-consistency-not-independent-review', requirements: requirements.length,
  success_criteria: criteria.length, tasks: ids.length, checked_tasks: [...tasks.matchAll(/^- \[[xX]\] T/gm)].length,
  passed: errors.length === 0, errors }, null, 2));
process.exitCode = errors.length ? 1 : 0;
