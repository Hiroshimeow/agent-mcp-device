import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createPluginDriver} from '../../dist/platform/plugin-driver.js';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

for(const code of ['PLUGIN_DELAYED_FAULT','CANCELLED'])test('cancelled work delayed '+code+' response is classified correctly',{timeout:8000},async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'d1-delayed-fault-')),child=path.join(root,'child.mjs'),faults=[];
 await fs.writeFile(child,`import readline from 'node:readline';let target;const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='invoke'){if(m.params.input==='ping')send({id:m.id,result:'pong'});else target=m.id;}else if(m.method==='cancel'){send({id:m.id,result:true});setTimeout(()=>{send({id:target,error:{code:${JSON.stringify(code)},message:'late failure'}});setTimeout(()=>process.stderr.write('x'.repeat(5000)+'DIAGNOSTIC_END'),20);},80);}else send({id:m.id,result:true});});`);
 const driver=createPluginDriver({id:'delayed',entry:child,executable:process.execPath,args:[child],version:'1.0.0',dataSchemaVersion:1,isolation:'process',timeoutMs:4000,capabilities:[]},{deviceId:'fixture',dataRoot:root,projectRoots:[],sourceRoots:[]},error=>faults.push(error));
 t.after(async()=>{await driver.stop();await fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50});});
 await driver.start();const controller=new AbortController(),call=driver.invoke('fixture',{},controller.signal);
 await sleep(30);controller.abort();await assert.rejects(call,{code:'CANCELLED'});
 if(code.startsWith('PLUGIN_')){
  const deadline=Date.now()+2200;while(!faults.length&&Date.now()<deadline)await sleep(20);
  assert.equal(faults.length,1,'cancelled PLUGIN_* response was discarded');assert.equal(faults[0].code,code);
  assert.match(faults[0].message,/DIAGNOSTIC_END/);assert.ok(faults[0].message.length<4300);
 }else{
  await sleep(250);assert.equal(faults.length,0);assert.equal(await driver.invoke('fixture','ping'),'pong');
 }
});
