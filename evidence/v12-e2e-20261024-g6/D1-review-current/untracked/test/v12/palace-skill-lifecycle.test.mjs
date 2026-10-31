import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reconcilePalaceSkill, palaceSkillStatus } from '../../dist/plugins/palace/skill-manager.js';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const cleanup=dir=>fs.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:50});
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-skill-life-'));t.after(()=>cleanup(root));return root;}
async function packageRoot(parent,name,version,body){
  const root=path.join(parent,name.replace(/[^a-z0-9]+/gi,'-')+'-'+crypto.randomUUID());
  await fs.mkdir(path.join(root,'skills','palace-cli'),{recursive:true});
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name,version,type:'module'}));
  await fs.writeFile(path.join(root,'skills','palace-cli','SKILL.md'),body);
  await fs.writeFile(path.join(root,'skills','palace-cli','agents.json'),'{}\n');
  return root;
}
const target=(home,kind='agents')=>kind==='agents'?path.join(home,'.agents','skills','palace-cli'):path.join(home,'.pi','agent','skills','palace-cli');

for(const kind of ['agents','pi'])test('managed '+kind+' Skill is a plain copy and repeated reconcile is idempotent',async t=>{
  const root=await fixture(t),home=path.join(root,'home'),pkg=await packageRoot(root,'@hcu-lab.me/mcp-device','1.0.12','# v12\n');
  const first=await reconcilePalaceSkill({home,packageRoot:pkg,force:true});assert.equal(first.ok,true);
  const stat=await fs.lstat(target(home,kind));assert.equal(stat.isDirectory(),true);assert.equal(stat.isSymbolicLink(),false);
  assert.equal(await fs.readFile(path.join(target(home,kind),'SKILL.md'),'utf8'),'# v12\n');
  const second=await reconcilePalaceSkill({home,packageRoot:pkg,force:true});
  assert.equal(second.result.find(item=>item.target===target(home,kind)).state,'already-installed');
});

test('clean copy upgrades in place from its installed baseline instead of comparing to the new package',async t=>{
  const root=await fixture(t),home=path.join(root,'home'),pkg=await packageRoot(root,'@hcu-lab.me/mcp-device','1.0.11','# old\n');
  await reconcilePalaceSkill({home,packageRoot:pkg,force:true});
  await fs.writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'@hcu-lab.me/mcp-device',version:'1.0.12',type:'module'}));
  await fs.writeFile(path.join(pkg,'skills','palace-cli','SKILL.md'),'# new\n');
  const result=await reconcilePalaceSkill({home,packageRoot:pkg,force:true});
  assert.ok(result.result.every(item=>item.state==='updated'));
  assert.equal(await fs.readFile(path.join(target(home),'SKILL.md'),'utf8'),'# new\n');
});

test('modified owned Skill and user-added files are preserved with new content staged outside discovery roots',async t=>{
  const root=await fixture(t),home=path.join(root,'home'),pkg=await packageRoot(root,'@hcu-lab.me/mcp-device','1.0.11','# old\n');
  await reconcilePalaceSkill({home,packageRoot:pkg,force:true});
  await fs.writeFile(path.join(target(home),'SKILL.md'),'# user edit\n');await fs.writeFile(path.join(target(home),'notes.txt'),'keep\n');
  await fs.writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'@hcu-lab.me/mcp-device',version:'1.0.12',type:'module'}));await fs.writeFile(path.join(pkg,'skills','palace-cli','SKILL.md'),'# new\n');
  const result=await reconcilePalaceSkill({home,packageRoot:pkg,force:true}),item=result.result.find(value=>value.target===target(home));
  assert.equal(item.state,'preserved-modified');assert.equal(await fs.readFile(path.join(target(home),'SKILL.md'),'utf8'),'# user edit\n');assert.equal(await fs.readFile(path.join(target(home),'notes.txt'),'utf8'),'keep\n');
  assert.equal(item.pending.startsWith(path.join(home,'.mcp-device','palace-skill')),true);assert.equal(item.pending.includes(path.join('.agents','skills')),false);
  assert.equal(await fs.readFile(path.join(item.pending,'SKILL.md'),'utf8'),'# new\n');
});

test('package relocation repairs the Skill without retaining a dangling package link',async t=>{
  const root=await fixture(t),home=path.join(root,'home'),oldRoot=await packageRoot(root,'@hcu-lab.me/mcp-device','1.0.11','# old\n');
  await reconcilePalaceSkill({home,packageRoot:oldRoot,force:true});await cleanup(oldRoot);
  const nextRoot=await packageRoot(root,'@hcu-lab.me/mcp-device','1.0.12','# relocated\n');
  const result=await reconcilePalaceSkill({home,packageRoot:nextRoot,force:true});assert.equal(result.selectedOwner!==null,true);
  assert.equal(await fs.readFile(path.join(target(home),'SKILL.md'),'utf8'),'# relocated\n');assert.equal((await fs.lstat(target(home))).isSymbolicLink(),false);
});

test('two package owners coexist; removing one keeps the Skill and removing the final pristine owner removes it',async t=>{
  const root=await fixture(t),home=path.join(root,'home');
  const device=await packageRoot(root,'@hcu-lab.me/mcp-device','1.0.12','# shared\n'),standalone=await packageRoot(root,'@hcu-lab.me/palace','1.0.12','# shared\n');
  await reconcilePalaceSkill({home,packageRoot:device,force:true});let both=await reconcilePalaceSkill({home,packageRoot:standalone,force:true});assert.equal(both.owners.length,2);
  await reconcilePalaceSkill({home,packageRoot:standalone,force:true,removeCurrentOwner:true});assert.equal((await palaceSkillStatus({home,packageRoot:device})).owners.length,1);await fs.access(path.join(target(home),'SKILL.md'));
  await reconcilePalaceSkill({home,packageRoot:device,force:true,removeCurrentOwner:true});await assert.rejects(fs.stat(target(home)),{code:'ENOENT'});await assert.rejects(fs.stat(target(home,'pi')),{code:'ENOENT'});
});

test('foreign same-name Skill is never adopted or replaced',async t=>{
  const root=await fixture(t),home=path.join(root,'home'),pkg=await packageRoot(root,'@hcu-lab.me/mcp-device','1.0.12','# managed\n');
  await fs.mkdir(target(home),{recursive:true});await fs.writeFile(path.join(target(home),'SKILL.md'),'# foreign\n');
  const result=await reconcilePalaceSkill({home,packageRoot:pkg,force:true});assert.equal(result.result.find(item=>item.target===target(home)).state,'preserved-existing');assert.equal(await fs.readFile(path.join(target(home),'SKILL.md'),'utf8'),'# foreign\n');
});

test('scripts-disabled installation stays read-only until explicit Skill repair',async t=>{
  const root=await fixture(t),home=path.join(root,'home'),runtime=path.join(root,'runtime'),env={...process.env,MCP_DEVICE_INSTALL_SKILLS_FORCE:'1',MCP_DEVICE_SKILL_HOME:home};delete env.MCP_DEVICE_SKIP_SKILL_INSTALL;
  await assert.rejects(fs.stat(target(home)),{code:'ENOENT'});
  for(const args of [['plugins','--runtime-dir',runtime,'list'],['--help'],['server','--help']]){
    const run=spawnSync(process.execPath,[path.join(repo,'dist','mcp-device.js'),...args],{cwd:repo,env,encoding:'utf8',timeout:20000});
    assert.equal(run.status,0,run.stderr);await assert.rejects(fs.stat(home),{code:'ENOENT'},'Read commands must not create an agent home');
  }
  const repair=spawnSync(process.execPath,[path.join(repo,'dist','plugins/palace/cli.js'),'skill','install'],{cwd:repo,env,encoding:'utf8',timeout:20000});
  assert.equal(repair.status,0,repair.stderr);assert.equal((await fs.lstat(target(home))).isDirectory(),true);assert.equal((await fs.lstat(target(home))).isSymbolicLink(),false);
});

test('pending staged publish recovers after interruption without exposing a partial Skill',async t=>{
  const root=await fixture(t),home=path.join(root,'home'),pkg=await packageRoot(root,'@hcu-lab.me/mcp-device','1.0.12','# desired\n');
  await reconcilePalaceSkill({home,packageRoot:pkg,force:true});
  const ledgerPath=path.join(home,'.mcp-device','palace-skill','owners.json'),ledger=JSON.parse(await fs.readFile(ledgerPath,'utf8')),record=ledger.targets[target(home)],id=crypto.randomUUID();
  const key=crypto.createHash('sha256').update(path.resolve(target(home))).digest('hex').slice(0,24);
  const stage=path.join(home,'.mcp-device','palace-skill','staging',id,key),aside=path.join(home,'.mcp-device','palace-skill','aside',id,key);
  await fs.mkdir(path.dirname(stage),{recursive:true});await fs.cp(path.join(pkg,'skills','palace-cli'),stage,{recursive:true});await fs.writeFile(path.join(stage,'.mcp-device-palace-owned'),'recovered\n');
  await fs.mkdir(path.dirname(aside),{recursive:true});await fs.rename(target(home),aside);
  ledger.pending={id,target:target(home),stage,aside,selectedOwner:record.selectedOwner,version:record.version,files:record.files};await fs.writeFile(ledgerPath,JSON.stringify(ledger,null,2));
  await reconcilePalaceSkill({home,packageRoot:pkg,force:true});assert.equal(await fs.readFile(path.join(target(home),'SKILL.md'),'utf8'),'# desired\n');assert.equal((await palaceSkillStatus({home,packageRoot:pkg})).result[0].state,'owned-pristine');
});
