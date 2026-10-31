import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {processBirth,processNamespace} from '../../dist/plugins/palace/process-birth.js';
import {reconcilePalaceSkill} from '../../dist/plugins/palace/skill-manager.js';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-lock-identity-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));
 const home=path.join(root,'home'),packageRoot=path.join(root,'node_modules/@hcu-lab.me/palace'),state=path.join(home,'.mcp-device/palace-skill'),lock=path.join(state,'owners.lock');
 await fs.mkdir(path.join(packageRoot,'skills/palace-cli'),{recursive:true});await fs.writeFile(path.join(packageRoot,'package.json'),JSON.stringify({name:'@hcu-lab.me/palace',version:'1.0.12'}));await fs.writeFile(path.join(packageRoot,'skills/palace-cli/SKILL.md'),'owned Skill\n');await fs.mkdir(state,{recursive:true});
 return {root,home,packageRoot,state,lock,run:options=>reconcilePalaceSkill({home,packageRoot,...options})};
}
test('kernel creation identity is stable and available on supported Windows/Linux hosts',async()=>{
 const first=await processBirth(process.pid),second=await processBirth(process.pid),ns=await processNamespace();
 assert.ok(first,'No safe process creation identity is available on this claimed supported platform');assert.equal(second,first);assert.equal(ns.platform,process.platform);assert.equal(ns.hostname,os.hostname());
 if(process.platform==='linux'){assert.match(ns.bootId,/^[a-f0-9-]{36}$/i);assert.match(ns.pidNamespace,/^pid:\[\d+\]$/);}
 if(process.platform==='win32')assert.match(first,/^win32:\d+$/);
});
test('an abandoned PID in another OS namespace never authorizes explicit or ordinary takeover',async t=>{
 const f=await fixture(t),child=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(child.status,0);
 const ns=await processNamespace(),body=JSON.stringify({pid:child.pid,token:randomUUID(),processBirth:'foreign-creation',namespace:{...ns,platform:process.platform==='win32'?'linux':'win32'},createdAt:1});
 await fs.writeFile(f.lock,body);await fs.utimes(f.lock,new Date(0),new Date(0));
 await assert.rejects(f.run({force:true,repair:true,breakLock:true}),error=>error.code==='PALACE_SKILL_LOCK_ACTIVE');
 assert.equal(await fs.readFile(f.lock,'utf8'),body);await assert.rejects(fs.stat(path.join(f.state,'owners.json')),{code:'ENOENT'});
});
test('a legacy dead PID without namespace identity is not automatically treated as this host',async t=>{
 const f=await fixture(t),child=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(child.status,0);
 const body=JSON.stringify({pid:child.pid,token:randomUUID(),processBirth:'legacy-without-namespace'});await fs.writeFile(f.lock,body);
 await assert.rejects(f.run({force:true,breakLock:true}),error=>error.code==='PALACE_SKILL_LOCK_ACTIVE');assert.equal(await fs.readFile(f.lock,'utf8'),body);
});
test('a complete coordination body is published atomically with no empty canonical-file window',async t=>{
 const f=await fixture(t),original=fs.link;let observed=0;
 fs.link=async(source,destination)=>{
  if(path.resolve(destination)===path.resolve(f.lock)){
   await assert.rejects(fs.stat(f.lock),{code:'ENOENT'});const body=JSON.parse(await fs.readFile(source,'utf8'));
   assert.equal(body.pid,process.pid);assert.ok(body.token);assert.equal(body.processBirth,await processBirth(process.pid));assert.deepEqual(body.namespace,await processNamespace());observed++;
  }
  return original(source,destination);
 };
 try{await f.run();}finally{fs.link=original;}
 assert.equal(observed,1);await assert.rejects(fs.stat(f.lock),{code:'ENOENT'});
 assert.equal((await fs.readdir(f.state)).some(name=>name.includes('.claim-')),false);
});
