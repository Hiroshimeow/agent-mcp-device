import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PluginHost} from '../../dist/platform/plugin-host.js';

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'d1-fault-persist-')),hosts=[];
 t.after(async()=>{for(const host of hosts)await host.close();await fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50});});
 const entry=path.join(root,'provider.mjs');
 await fs.writeFile(entry,'export const createPlugin=()=>({invoke:()=>process.pid});');
 const host=()=>{const h=new PluginHost({stateRoot:root,deviceId:'fault-persist'});hosts.push(h);return h;};
 const runtime=host();
 await runtime.install({id:'provider',entry,version:'1.0.0',dataSchemaVersion:1,isolation:'process',capabilities:[{name:'fault.provider',version:'1.0.0'}]},{enabled:true});
 return {root,runtime,host};
}
function blockFaultSave(runtime){
 const save=runtime.save.bind(runtime);let blocked=true;
 runtime.save=async()=>{if(blocked)throw Object.assign(new Error('injected registry write failure'),{code:'EIO'});return save();};
 return ()=>{blocked=false;};
}
const fault=()=>Object.assign(new Error('fixture fault'),{code:'PLUGIN_FIXTURE_FAILED'});

test('failed fault persistence survives direct load and unrelated external revision without resurrecting child',async t=>{
 const {runtime,host}=await fixture(t);await runtime.start();clearInterval(runtime.refreshTimer);
 const pid=await runtime.invoke('fault.provider',{}),release=blockFaultSave(runtime);
 await runtime.markFault('provider',fault());
 await runtime.load();assert.equal(runtime.list()[0].state,'faulted','direct load discarded unpersisted fault');
 const external=host();await external.load();
 await external.install({...external.list()[0].manifest,id:'unrelated',capabilities:[]});
 release();await runtime.refresh();
 assert.equal(runtime.list().find(r=>r.manifest.id==='provider').state,'faulted');
 assert.deepEqual(runtime.capabilities(),[]);
 assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
 assert.equal(JSON.parse(await fs.readFile(runtime.registryPath,'utf8')).plugins.provider.state,'faulted');
 const restarted=host();await restarted.start();assert.deepEqual(restarted.capabilities(),[]);
});

test('failed activation save followed by failed fault save preserves sticky fault on reload',async t=>{
 const {runtime,host}=await fixture(t),release=blockFaultSave(runtime);
 await runtime.start();clearInterval(runtime.refreshTimer);
 assert.equal(runtime.registrySavePending,true);
 await runtime.markFault('provider',fault());await runtime.load();
 assert.equal(runtime.list()[0].state,'faulted');
 const external=host();await external.load();await external.install({...external.list()[0].manifest,id:'other',capabilities:[]});
 release();await runtime.refresh();assert.equal(runtime.list().find(r=>r.manifest.id==='provider').state,'faulted');
 assert.deepEqual(runtime.capabilities(),[]);
});

for(const action of ['enable','disable','uninstall'])test('unpersisted startup fault respects newer explicit '+action,async t=>{
 const {runtime,host}=await fixture(t);
 // The on-disk state is already installed/enabled. An explicit enable may write
 // the very same state: revision alone cannot distinguish it from another ID.
 const release=blockFaultSave(runtime);await runtime.markFault('provider',fault());
 const external=host();await external[action]('provider');release();
 await runtime.load();
 const record=runtime.list()[0];
 assert.equal(record.state,action==='enable'?'installed':action==='disable'?'disabled':'uninstalled');
 assert.equal(record.enabled,action==='enable');assert.equal(record.installed,action!=='uninstall');
 assert.equal(record.error,undefined);
});

test('POSIX registry rename syncs parent and keeps published revision after directory sync failure',async t=>{
 const {runtime}=await fixture(t),originalPlatform=Object.getOwnPropertyDescriptor(process,'platform'),open=fs.open;
 let directoryOpens=0,closed=0,fail=true;
 fs.open=async function(filename,...args){
  if(filename===runtime.root){directoryOpens++;return {sync:async()=>{if(fail)throw Object.assign(new Error('directory sync failure'),{code:'EIO'});},close:async()=>{closed++;}};}
  return open.call(this,filename,...args);
 };
 Object.defineProperty(process,'platform',{value:'linux'});
 try{
  const before=runtime.registry.revision;
  await assert.rejects(runtime.save(),{code:'EIO'});
  assert.equal(runtime.registry.revision,before+1,'rename already published this revision');
  fail=false;await runtime.save();assert.equal(runtime.registry.revision,before+2);
  assert.equal(directoryOpens,2);assert.equal(closed,2);
 }finally{fs.open=open;Object.defineProperty(process,'platform',originalPlatform);}
});
