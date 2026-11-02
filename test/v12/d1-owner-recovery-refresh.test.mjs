import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {acquireServerLease} from '../../dist/platform/runtime-lease.js';
import {withCoordinationLock,repairCoordinationLock,createCoordinationLock,releaseCoordinationLock} from '../../dist/platform/coordination-lock.js';
import {processBirth,processNamespace} from '../../dist/platform/process-identity.js';
import {PluginHost} from '../../dist/platform/plugin-host.js';

const codes={busy:'FIXTURE_BUSY',active:'FIXTURE_ACTIVE',recoveryRequired:'FIXTURE_RECOVERY_REQUIRED'};
const options={codes,attempts:20,retainAbandoned:false};
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'d1-owner-recovery-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));
 return root;
}
async function deadBody(){
 const child=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(child.status,0);
 assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
 return {pid:child.pid,token:randomUUID(),processBirth:'exited-child',namespace:await processNamespace()};
}
async function liveBody(){return {pid:process.pid,token:randomUUID(),processBirth:await processBirth(process.pid),namespace:await processNamespace()};}

for(const identity of ['foreign','legacy'])test('runtime lease preserves '+identity+' dead PID owner',async t=>{
 const root=await fixture(t),lock=path.join(root,'server-runtime.lock'),body=await deadBody();
 if(identity==='foreign')body.namespace={...body.namespace,hostname:'foreign-'+os.hostname()};else delete body.namespace;
 const text=JSON.stringify(body);await fs.writeFile(lock,text);
 let release;
 try{await assert.rejects(async()=>{release=await acquireServerLease(root);},{code:'RUNTIME_ALREADY_RUNNING'});}
 finally{if(release)await release();}
 assert.equal(await fs.readFile(lock,'utf8'),text);
});
test('runtime lease recovers a reused local PID with a different process birth',async t=>{
 const root=await fixture(t),lock=path.join(root,'server-runtime.lock'),body=await liveBody();
 body.processBirth='previous-process-creation';await fs.writeFile(lock,JSON.stringify(body));
 const release=await acquireServerLease(root);assert.notEqual(JSON.parse(await fs.readFile(lock,'utf8')).token,body.token);
 await release();await assert.rejects(fs.stat(lock),{code:'ENOENT'});
});
for(const mode of ['ordinary','explicit'])test(mode+' coordination recovery reclaims abandoned recovery guard',async t=>{
 const root=await fixture(t),lock=path.join(root,'registry.lock');
 await fs.writeFile(lock,JSON.stringify(await deadBody()));await fs.writeFile(lock+'.recovery',JSON.stringify(await deadBody()));
 if(mode==='explicit')assert.equal((await repairCoordinationLock(lock,options)).recovered,true);
 let calls=0;await withCoordinationLock(lock,async()=>{calls++;},options);assert.equal(calls,1);
 await assert.rejects(fs.stat(lock+'.recovery'),{code:'ENOENT'});
});
for(const identity of ['live','foreign','incomplete'])test('coordination recovery preserves '+identity+' guard',async t=>{
 const root=await fixture(t),lock=path.join(root,'registry.lock');await fs.writeFile(lock,JSON.stringify(await deadBody()));
 const guard=await liveBody();if(identity==='foreign'){Object.assign(guard,await deadBody());guard.namespace={...guard.namespace,hostname:'foreign-'+os.hostname()};}
 const text=identity==='incomplete'?'':JSON.stringify(guard);await fs.writeFile(lock+'.recovery',text);
 await assert.rejects(withCoordinationLock(lock,async()=>assert.fail('must not enter'),{...options,attempts:2}),{code:codes.busy});
 await assert.rejects(repairCoordinationLock(lock,options),{code:codes.recoveryRequired});
 assert.equal(await fs.readFile(lock+'.recovery','utf8'),text);
});
test('concurrent nested abandoned-guard recovery serializes critical sections',async t=>{
 const root=await fixture(t),lock=path.join(root,'registry.lock');
 await fs.writeFile(lock,JSON.stringify(await deadBody()));await fs.writeFile(lock+'.recovery',JSON.stringify(await deadBody()));
 await fs.writeFile(lock+'.recovery.recovery',JSON.stringify(await deadBody()));
 let active=0,entered=0;
 await Promise.all(Array.from({length:4},()=>withCoordinationLock(lock,async()=>{
  assert.equal(++active,1);entered++;await new Promise(resolve=>setTimeout(resolve,5));active--;
 },{...options,attempts:100})));
 assert.equal(entered,4);
});
test('a stale recovery observation cannot remove a replacement live guard',{timeout:15000},async t=>{
 const root=await fixture(t),lock=path.join(root,'registry.lock'),guardPath=lock+'.recovery';
 await fs.writeFile(lock,JSON.stringify(await deadBody()));await fs.writeFile(guardPath,JSON.stringify(await deadBody()));
 let observed, resume, leave;
 const observation=new Promise(resolve=>{observed=resolve;}),resumeRead=new Promise(resolve=>{resume=resolve;}),leaveWork=new Promise(resolve=>{leave=resolve;});
 const readFile=fs.readFile;let paused=false,replacement,second;
 fs.readFile=async function(filename,...args){
  const value=await readFile.call(this,filename,...args);
  if(filename===guardPath&&!paused){paused=true;observed();await resumeRead;}
  return value;
 };
 const stale=assert.rejects(withCoordinationLock(lock,async()=>assert.fail('stale contender must not enter'),{...options,attempts:2}),{code:codes.busy});
 try{
  await observation;
  let entered;const inside=new Promise(resolve=>{entered=resolve;});
  second=withCoordinationLock(lock,async()=>{entered();await leaveWork;},options);await inside;
  replacement=await createCoordinationLock(guardPath);
  resume();await stale;
  assert.equal(JSON.parse(await fs.readFile(guardPath,'utf8')).token,replacement.token);
 }finally{
  resume();leave();fs.readFile=readFile;
  await stale;await second;if(replacement)await releaseCoordinationLock(replacement,guardPath);
 }
});
test('runtime lease recovers abandoned coordination guard and retains exclusive ownership',async t=>{
 const root=await fixture(t),lock=path.join(root,'server-runtime.lock');
 await fs.writeFile(lock,JSON.stringify(await deadBody()));await fs.writeFile(lock+'.recovery',JSON.stringify(await deadBody()));
 const release=await acquireServerLease(root);
 try{await assert.rejects(acquireServerLease(root),{code:'RUNTIME_ALREADY_RUNNING'});}finally{await release();}
});

for(const changeSettings of [false,true])for(const preload of [false,true])test('refresh applies coalesced lifecycle intent'+(changeSettings?' with new settings':' with unchanged settings')+(preload?' after direct load':''),async t=>{
 const root=await fixture(t),runtime=new PluginHost({stateRoot:root,deviceId:'settings'}),external=new PluginHost({stateRoot:root,deviceId:'settings'});
 t.after(async()=>{await runtime.close();await external.close();});
 const entry=path.join(root,'settings.mjs');
 await fs.writeFile(entry,'export const createPlugin=context=>({invoke:()=>context.settings});');
 await runtime.install({id:'settings',entry,version:'1.0.0',dataSchemaVersion:1,isolation:'in-process',trusted:true,capabilities:[{name:'fixture.settings',version:'1.0.0'}]});
 await runtime.configure('settings',{value:'old'});await runtime.enable('settings');await runtime.start();clearInterval(runtime.refreshTimer);
 await runtime.refresh();
 assert.deepEqual(await runtime.invoke('fixture.settings',{}),{value:'old'});const old=runtime.drivers.get('settings');
 await external.disable('settings');if(changeSettings)await external.configure('settings',{value:'new'});await external.enable('settings');
 if(preload)await runtime.load();await runtime.refresh();
 assert.deepEqual(await runtime.invoke('fixture.settings',{}),{value:changeSettings?'new':'old'});
 assert.notEqual(runtime.drivers.get('settings'),old);
 const current=runtime.drivers.get('settings');await runtime.refresh();
 assert.equal(runtime.drivers.get('settings'),current,'unchanged revision must not restart a healthy generation');
 await external.load();await external.save();await runtime.refresh();
 assert.equal(runtime.drivers.get('settings'),current,'unrelated revision must not restart a healthy generation');
});
