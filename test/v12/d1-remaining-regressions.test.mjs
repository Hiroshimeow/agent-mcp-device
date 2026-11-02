import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {reconcilePalaceSkill,palaceSkillQuickProbe,palaceSkillStatus} from '../../dist/plugins/palace/skill-manager.js';
const cli=fileURLToPath(new URL('../../dist/plugins/palace/cli.js',import.meta.url));
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'d1-remaining-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));return root;}
async function packageFixture(root){const pkg=path.join(root,'node_modules','@hcu-lab.me','palace');await fs.mkdir(path.join(pkg,'skills/palace-cli'),{recursive:true});await fs.writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'@hcu-lab.me/palace',version:'1.0.12'}));await fs.writeFile(path.join(pkg,'skills/palace-cli/SKILL.md'),'fixture guidance');return pkg;}
async function status(root,record){const runtime=path.join(root,'runtime');await fs.mkdir(path.join(runtime,'plugins'),{recursive:true});await fs.writeFile(path.join(runtime,'plugins/registry.json'),JSON.stringify({plugins:{palace:record}}));const out=spawnSync(process.execPath,[cli,'--runtime-dir',runtime,'status'],{encoding:'utf8',timeout:10000,env:{...process.env,MCP_DEVICE_SKIP_SKILL_INSTALL:'1'}});assert.equal(out.status,1,out.stdout+out.stderr);return JSON.parse(out.stdout||out.stderr.trim().split(/\r?\n/).find(x=>x.startsWith('{')));}
for(const source of ['distribution','manual'])test(`fault remediation inspects missing entry and preserves ${source} installation provenance`,async t=>{
 const root=await fixture(t),entry=path.join(root,'missing-provider.mjs');
 const body=await status(root,{installed:true,enabled:true,state:'faulted',installationSource:source,error:'PLUGIN_START_FAILED: module import failed',manifest:{entry}});
 assert.equal(body.code,'PALACE_FAULTED');assert.match(body.remediation,/Stop the runtime/);assert.match(body.remediation,/must not stop the runtime itself/);
 if(source==='distribution')assert.match(body.remediation,/upgrade .*palace\.plugin\.json/);else{assert.doesNotMatch(body.remediation,/--bundled/);assert.match(body.remediation,/reviewed.*manifest/i);}
});
test('unrelated ENOENT with existing entry recommends enable, not a package replacement',async t=>{
 const root=await fixture(t),entry=path.join(root,'provider.mjs');await fs.writeFile(entry,'export {};');
 const body=await status(root,{installed:true,enabled:true,state:'faulted',installationSource:'distribution',error:'ENOENT: user import /documents/missing.txt',manifest:{entry}});
 assert.match(body.remediation,/enable palace/);assert.doesNotMatch(body.remediation,/upgrade|--bundled/);
});
test('upgrade-required remediation explicitly reserves stopping the runtime to the operator',async t=>{
 const root=await fixture(t),body=await status(root,{installed:true,enabled:true,state:'enabled',installationSource:'distribution',bundleUpgradeRequired:true,manifest:{entry:path.join(root,'old.mjs')}});
 assert.equal(body.code,'PALACE_UPGRADE_REQUIRED');assert.match(body.remediation,/Stop the runtime/);assert.match(body.remediation,/must not stop the runtime itself/);
});
test('Skill guidance distinguishes knowledge no-write reads from SQLite SHM read marks',async()=>{
 const text=await fs.readFile(new URL('../../skills/palace-cli/SKILL.md',import.meta.url),'utf8');
 assert.match(text,/shared.memory|SHM/i);assert.match(text,/read marks/i);assert.match(text,/main.*WAL|main\/WAL/i);
});
test('quick probe canonicalizes package and home aliases like full Skill context without broad checks',async t=>{
 const root=await fixture(t),pkg=await packageFixture(root),home=path.join(root,'home');await fs.mkdir(home);
 await reconcilePalaceSkill({packageRoot:pkg,home,force:true});
 const pkgAlias=path.join(root,'package-alias'),homeAlias=path.join(root,'home-alias');await fs.symlink(pkg,pkgAlias,process.platform==='win32'?'junction':'dir');await fs.symlink(home,homeAlias,process.platform==='win32'?'junction':'dir');
 const original=palaceSkillQuickProbe({packageRoot:pkg,home,force:true},{name:'@hcu-lab.me/palace',version:'1.0.12'});
 const aliased=palaceSkillQuickProbe({packageRoot:pkgAlias,home:homeAlias,force:true},{name:'@hcu-lab.me/palace',version:'1.0.12'});
 assert.equal(aliased.state,original.state);assert.equal(aliased.verification,'ledger-only');assert.equal(aliased.observational,true);
 assert.equal((await palaceSkillStatus({packageRoot:pkgAlias,home:homeAlias,force:true})).home,await fs.realpath(home));
});
for(const username of ['SYSTEM','LOCAL SERVICE','NETWORK SERVICE'])test(`automatic Skill reconcile skips Windows ${username} before any ownership write`,async t=>{
 const root=await fixture(t),pkg=await packageFixture(root),home=path.join(root,'absent-home'),platform=Object.getOwnPropertyDescriptor(process,'platform'),oldUser=process.env.USERNAME,oldForce=process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE;
 Object.defineProperty(process,'platform',{value:'win32'});process.env.USERNAME=username;delete process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE;
 try{const result=await reconcilePalaceSkill({packageRoot:pkg,home});assert.equal(result.skipped,'service-profile');assert.equal(await fs.stat(home).then(()=>true,()=>false),false);}
 finally{Object.defineProperty(process,'platform',platform);if(oldUser===undefined)delete process.env.USERNAME;else process.env.USERNAME=oldUser;if(oldForce===undefined)delete process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE;else process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE=oldForce;}
});
test('explicit Skill install and forced automatic service reconcile remain available',async t=>{
 const root=await fixture(t),pkg=await packageFixture(root),platform=Object.getOwnPropertyDescriptor(process,'platform'),oldUser=process.env.USERNAME,oldForce=process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE;
 Object.defineProperty(process,'platform',{value:'win32'});process.env.USERNAME='SYSTEM';
 try{delete process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE;const explicit=await reconcilePalaceSkill({packageRoot:pkg,home:path.join(root,'explicit'),force:true});assert.notEqual(explicit.skipped,'service-profile');process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE='1';const forced=await reconcilePalaceSkill({packageRoot:pkg,home:path.join(root,'forced')});assert.notEqual(forced.skipped,'service-profile');}
 finally{Object.defineProperty(process,'platform',platform);if(oldUser===undefined)delete process.env.USERNAME;else process.env.USERNAME=oldUser;if(oldForce===undefined)delete process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE;else process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE=oldForce;}
});
