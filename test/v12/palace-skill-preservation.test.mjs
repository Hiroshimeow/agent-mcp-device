import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=path.join(root,'skills/palace-cli'),installer=path.join(root,'scripts/v12/install-palace-skill.cjs');
async function fixture(t){
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'palace-skill-preserve-'));
  t.after(()=>fs.rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:50}));
  const target=path.join(home,'.agents/skills/palace-cli');
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.cp(source,target,{recursive:true});
  await fs.writeFile(path.join(target,'.mcp-device-palace-owned'),'palace-cli\n');
  const run=()=>{const env={...process.env,MCP_DEVICE_INSTALL_SKILLS_FORCE:'1',MCP_DEVICE_SKILL_HOME:home};delete env.MCP_DEVICE_SKIP_SKILL_INSTALL;const r=spawnSync(process.execPath,[installer],{env,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  return {home,target,run};
}
test('a legacy owned copy never grants permission to discard a modified Skill',async t=>{
  const f=await fixture(t),text='# My own amended procedure\n';
  await fs.writeFile(path.join(f.target,'SKILL.md'),text);
  const result=f.run();assert.equal(result.ok,true);
  assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),text);
});
test('a legacy owned copy preserves files added by the user',async t=>{
  const f=await fixture(t),notes=path.join(f.target,'my-notes.txt');
  await fs.writeFile(notes,'keep this extra evidence\n');
  const result=f.run();assert.equal(result.ok,true);
  assert.equal(await fs.readFile(notes,'utf8'),'keep this extra evidence\n');
});
test('an unchanged legacy copy remains readable and a repeated install is idempotent',async t=>{
  const f=await fixture(t),expected=await fs.readFile(path.join(source,'SKILL.md'));
  assert.equal(f.run().ok,true);assert.deepEqual(await fs.readFile(path.join(f.target,'SKILL.md')),expected);
  assert.equal(f.run().ok,true);assert.deepEqual(await fs.readFile(path.join(f.target,'SKILL.md')),expected);
});
