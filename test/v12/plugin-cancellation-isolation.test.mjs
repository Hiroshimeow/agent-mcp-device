import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PluginHost } from '../../dist/platform/plugin-host.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('cancelling queued request B never kills unrelated running request A',{timeout:16000},async ()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'d1-cancel-isolation-')),entry=path.join(root,'serial.mjs');
 await fs.writeFile(entry,`const delay=ms=>new Promise(r=>setTimeout(r,ms));let tail=Promise.resolve();export const createPlugin=()=>({invoke(_n,input,{signal}){const run=tail.then(async()=>{if(input==='A'){await delay(6500);return 'A';}if(signal.aborted)throw Object.assign(new Error('cancelled before queued work'),{code:'CANCELLED'});return input;});tail=run.catch(()=>{});return run;}});`);
 const host=new PluginHost({stateRoot:root,deviceId:'d1'});
 try{
  await host.install({id:'serial',version:'1.0.0',dataSchemaVersion:1,isolation:'process',entry,timeoutMs:9000,capabilities:[{name:'d1.serial',version:'1.0.0'}]},{enabled:true});await host.start();
  const a=host.invoke('d1.serial','A');await sleep(100);
  const controller=new AbortController(),b=host.invoke('d1.serial','B',{signal:controller.signal});await sleep(900);
  const cancelledAt=Date.now();controller.abort();await assert.rejects(b,{code:'CANCELLED'});assert.ok(Date.now()-cancelledAt<200,'caller cancellation was not prompt');
  assert.equal(await a,'A');assert.equal(host.list()[0].state,'enabled');assert.equal(await host.invoke('d1.serial','C'),'C');
 }finally{
  await host.close().catch(()=>{});
  await fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50});
 }
});
