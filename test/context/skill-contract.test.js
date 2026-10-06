import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTEXT_CLI_CONTRACT } from '../../dist/context/cli.js';

const skillPath = new URL('../../skills/mcp-device-context/SKILL.md', import.meta.url);
const text = () => readFileSync(skillPath, 'utf8');

test('portable skill freezes search-first and selective-maintenance behavior', () => {
  const body = text();
  assert.match(body, /search first/i);
  assert.match(body, /selective/i);
  assert.match(body, /do not sync.*every/i);
  assert.match(body, /verify current source/i);
  assert.match(body, /checkpoint/i);
  assert.match(body, /observed/i);
  assert.match(body, /reported/i);
  assert.match(body, /local_wiki.*disabled/i);
  assert.match(body, /NMem/i);
});

test('portable skill forbids sandbox bypass and sealed namespace auto-selection', () => {
  const body = text();
  assert.match(body, /ACCESS_DENIED/);
  assert.match(body, /LOCAL_STATE_UNAVAILABLE/);
  assert.match(body, /do not.*remote/i);
  assert.match(body, /sealed/i);
  assert.match(body, /never.*auto-select/i);
});

test('portable skill mentions only commands and flags covered by the CLI contract', () => {
  const body = text();
  const commands = [...body.matchAll(/mcp-device context ([a-z-]+)/g)].map(match => match[1]);
  const flags = [...body.matchAll(/--[a-z][a-z-]*/g)].map(match => match[0]);
  const allowedCommands = new Set(CONTEXT_CLI_CONTRACT.commands.map(command => command.name));
  const allowedFlags = new Set([
    ...CONTEXT_CLI_CONTRACT.globalFlags,
    ...CONTEXT_CLI_CONTRACT.commands.flatMap(command => command.flags),
  ]);
  assert.ok(commands.length > 0);
  assert.ok(flags.length > 0);
  for (const command of commands) assert.ok(allowedCommands.has(command), `undocumented command: ${command}`);
  for (const flag of flags) assert.ok(allowedFlags.has(flag), `undocumented flag: ${flag}`);
  assert.doesNotMatch(body, /[A-Z]:\\|\/home\/|\/Users\//);
  assert.doesNotMatch(body, /sqlite|\.db\b|context-hmac\.key/i);
});
