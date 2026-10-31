import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createHook} from 'node:async_hooks';
import {reconcilePalaceSkill,palaceSkillProbe,palaceSkillStatus} from '../../dist/plugins/palace/skill-manager.js';
const digest=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-probe-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));
 const home=path.join(root,'home'),pkg=path.join(root,'node_modules/@hcu-lab.me/palace'),source=path.join(pkg,'skills/palace-cli'),state=path.join(home,'.mcp-device/palace-skill'),target=path.join(home,'.agents/skills/palace-cli'),ledgerPath=path.join(state,'owners.json');
 await fs.mkdir(source,{recursive:true});await fs.writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'@hcu-lab.me/palace',version:'1.0.12'}));await fs.writeFile(path.join(source,'SKILL.md'),'managed initial\n');
 const options={home,packageRoot:pkg},run=o=>reconcilePalaceSkill({...options,...o}),ledger=()=>fs.readFile(ledgerPath,'utf8').then(JSON.parse);
 return {root,home,pkg,source,state,target,ledgerPath,options,run,ledger};
}

test('metadata probes do not hash source bodies, publish, acquire locks, or change the ledger',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.source,'large-reference.txt'),'x'.repeat(2*1024*1024));await f.run();
 const before=await fs.readFile(f.ledgerPath),original={};const forbidden=[];
 for(const name of ['writeFile','rename','cp','rm','mkdir','open']){original[name]=fs[name];fs[name]=async(...args)=>{forbidden.push(name);throw new Error('Read-only probe attempted '+name);};}
 original.readFile=fs.readFile;fs.readFile=async(filename,...args)=>{
   if(path.resolve(String(filename)).startsWith(path.resolve(f.source)+path.sep))throw new Error('Read-only probe hashed source content');
   return original.readFile(filename,...args);
 };
 const timings=[],baseline=[];let children=0;const hook=createHook({init(_id,type){if(type==='PROCESSWRAP')children++;}}).enable();
 const skip=process.env.MCP_DEVICE_SKIP_SKILL_INSTALL;
 try{
  for(let i=0;i<200;i++){
   delete process.env.MCP_DEVICE_SKIP_SKILL_INSTALL;
   let start=performance.now();const result=await palaceSkillProbe(f.options);timings.push(performance.now()-start);
   assert.equal(result.state,'present-recorded');assert.equal(result.verification,'metadata-only');assert.equal(result.observational,true);
   process.env.MCP_DEVICE_SKIP_SKILL_INSTALL='1';start=performance.now();await palaceSkillProbe(f.options);baseline.push(performance.now()-start);
  }
 }finally{hook.disable();for(const [name,method] of Object.entries(original))fs[name]=method;if(skip===undefined)delete process.env.MCP_DEVICE_SKIP_SKILL_INSTALL;else process.env.MCP_DEVICE_SKIP_SKILL_INSTALL=skip;}
 assert.deepEqual(forbidden,[]);assert.equal(children,0);assert.equal(digest(await fs.readFile(f.ledgerPath)),digest(before));
 timings.sort((a,b)=>a-b);baseline.sort((a,b)=>a-b);
 const p95Delta=timings[189]-baseline[189];
 t.diagnostic(JSON.stringify({samples:timings.length,p50Ms:timings[99],p95Ms:timings[189],maxMs:timings.at(-1),baselineP95Ms:baseline[189],p95IncrementalMs:p95Delta,measurement:'in-process cache diagnostic only; actual CLI process latency is asserted separately',bytesInSourceTree:2*1024*1024,sourceBodyReads:0,filesystemWrites:0,children}));
});

test('an aged or abandoned lock is reported for inspection rather than silently skipped forever',async t=>{
 const f=await fixture(t);await fs.mkdir(f.state,{recursive:true});const lock=path.join(f.state,'owners.lock');
 const body=JSON.stringify({pid:process.pid,token:randomUUID(),processBirth:'unknown-fixture-identity',createdAt:1});await fs.writeFile(lock,body);await fs.utimes(lock,new Date(0),new Date(0));
 const result=await palaceSkillProbe(f.options);assert.equal(result.state,'repair-required');assert.equal(result.code,'PALACE_SKILL_LOCK_INSPECTION_REQUIRED');
 assert.equal(await fs.readFile(lock,'utf8'),body);await assert.rejects(fs.stat(f.ledgerPath),{code:'ENOENT'});
});

test('a recent active installer is reported as busy without lock mutation',async t=>{
 const f=await fixture(t);await fs.mkdir(f.state,{recursive:true});const lock=path.join(f.state,'owners.lock'),body=JSON.stringify({pid:process.pid,token:randomUUID()});await fs.writeFile(lock,body);
 const result=await palaceSkillProbe(f.options);assert.equal(result.state,'busy');assert.equal(await fs.readFile(lock,'utf8'),body);
});

test('explicit prune deletes only recorded byte-identical backups and preserves edited backups',async t=>{
 const f=await fixture(t);await f.run();await fs.writeFile(path.join(f.pkg,'package.json'),JSON.stringify({name:'@hcu-lab.me/palace',version:'1.0.13'}));await fs.writeFile(path.join(f.source,'SKILL.md'),'managed updated\n');await f.run();
 const ledger=await f.ledger(),backups=Object.keys(ledger.retainedFiles);assert.equal(backups.length,2);
 const edited=backups[0];await fs.writeFile(path.join(edited,'my-notes.txt'),'preserve these later edits\n');
 const before=await fs.readFile(path.join(f.target,'SKILL.md'));const result=await f.run({force:true,prune:true});
 assert.equal(result.pruned.length,1);assert.deepEqual(result.preserved,[edited]);assert.equal(await fs.readFile(path.join(edited,'my-notes.txt'),'utf8'),'preserve these later edits\n');
 assert.deepEqual(await fs.readFile(path.join(f.target,'SKILL.md')),before);
});

test('abandon-pending records the preserved stage and aside, not only the ledger backup',async t=>{
 const f=await fixture(t);await f.run();const ledger=await f.ledger(),record=ledger.targets[f.target],id=randomUUID(),key=createHash('sha256').update(f.target).digest('hex').slice(0,24);
 const stage=path.join(f.state,'staging',id,key),aside=path.join(f.state,'aside',id,key);await fs.mkdir(stage,{recursive:true});await fs.mkdir(aside,{recursive:true});await fs.writeFile(path.join(stage,'notes.txt'),'staged user bytes');await fs.writeFile(path.join(aside,'notes.txt'),'prior user bytes');
 ledger.pending={id,target:f.target,stage,aside,selectedOwner:record.selectedOwner,version:record.version,files:record.files,hadPrior:true};await fs.writeFile(f.ledgerPath,JSON.stringify(ledger));
 const result=await f.run({force:true,repair:true,abandonPending:true});
 assert.match(result.retained[stage],/abandoned intent/);assert.match(result.retained[aside],/abandoned intent/);
 assert.equal(await fs.readFile(path.join(stage,'notes.txt'),'utf8'),'staged user bytes');assert.equal(await fs.readFile(path.join(aside,'notes.txt'),'utf8'),'prior user bytes');
});

test('full status diagnoses a missing owner without mutating the saved ownership state',async t=>{
 const f=await fixture(t);await f.run();const ledger=await f.ledger(),key=Object.keys(ledger.owners)[0],missing=path.join(f.root,'temporarily-absent');
 ledger.owners[key].root=missing;ledger.owners[key].source=path.join(missing,'skills/palace-cli');await fs.writeFile(f.ledgerPath,JSON.stringify(ledger));const before=await fs.readFile(f.ledgerPath);
 const result=await palaceSkillStatus(f.options);assert.equal(result.ownerProblems.length,1);assert.equal(result.stillProvidedBy,null);assert.deepEqual(await fs.readFile(f.ledgerPath),before);
});
