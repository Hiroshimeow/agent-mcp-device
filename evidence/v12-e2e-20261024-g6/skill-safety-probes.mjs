import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const installer=path.join(repo,'scripts/v12/install-palace-skill.cjs');
const source=path.join(repo,'skills/palace-cli');
async function base(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'palace-skill-safety-'));t.after(()=>fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50}));return dir;}
function run(script,home){const env={...process.env,MCP_DEVICE_INSTALL_SKILLS_FORCE:'1',MCP_DEVICE_SKILL_HOME:home};delete env.MCP_DEVICE_SKIP_SKILL_INSTALL;const r=spawnSync(process.execPath,[script],{env,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
test('a marked fallback copy preserves user edits during later installation',async t=>{
  const dir=await base(t),home=path.join(dir,'home'),target=path.join(home,'.agents/skills/palace-cli');
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.cp(source,target,{recursive:true});
  await fs.writeFile(path.join(target,'.mcp-device-palace-owned'),'palace-cli\n');
  await fs.writeFile(path.join(target,'SKILL.md'),'# User-authored revision that must survive\n');
  const result=run(installer,home);assert.equal(result.ok,true);
  assert.equal(await fs.readFile(path.join(target,'SKILL.md'),'utf8'),'# User-authored revision that must survive\n');
});
test('moving an installed package repairs its previously installed Skill link',async t=>{
  const dir=await base(t),home=path.join(dir,'home'),old=path.join(dir,'package-v1'),next=path.join(dir,'package-v2');
  for(const pkg of [old,next]){await fs.mkdir(path.join(pkg,'scripts/v12'),{recursive:true});await fs.mkdir(path.join(pkg,'skills'),{recursive:true});await fs.copyFile(installer,path.join(pkg,'scripts/v12/install-palace-skill.cjs'));await fs.cp(source,path.join(pkg,'skills/palace-cli'),{recursive:true});}
  assert.equal(run(path.join(old,'scripts/v12/install-palace-skill.cjs'),home).ok,true);
  await fs.rename(old,path.join(dir,'retired-package'));
  const installed=run(path.join(next,'scripts/v12/install-palace-skill.cjs'),home);assert.equal(installed.ok,true);
  const target=path.join(home,'.agents/skills/palace-cli/SKILL.md');
  assert.match(await fs.readFile(target,'utf8'),/name: palace-cli/);
});
