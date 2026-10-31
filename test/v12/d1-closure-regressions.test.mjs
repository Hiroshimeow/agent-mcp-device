import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PluginHost} from '../../dist/platform/plugin-host.js';

const packageRoot=fileURLToPath(new URL('../../',import.meta.url));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'d1-closure-'));
 const hosts=[];t.after(async()=>{for(const host of hosts)await host.close();await fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50});});
 const host=()=>{const value=new PluginHost({stateRoot:root,deviceId:'d1-closure'});hosts.push(value);return value;};
 const manifest=(id,entry,capability,extra={})=>({id,entry,version:'1.0.0',dataSchemaVersion:1,isolation:'process',capabilities:[{name:capability,version:'1.0.0'}],...extra});
 return {root,host,manifest};
}
async function until(check,message){const deadline=Date.now()+6000;while(Date.now()<deadline){if(await check())return;await sleep(25);}assert.fail(message);}
for(const action of ['disable','uninstall'])test('pending registry persistence reconciles external '+action+' and stops the old child',{timeout:12000},async t=>{
 const f=await fixture(t),entry=path.join(f.root,'provider.mjs');
 await fs.writeFile(entry,'export const createPlugin=()=>({invoke:()=>({pid:process.pid})});');
 const runtime=f.host();await runtime.install(f.manifest('provider',entry,'closure.provider'),{enabled:true});
 // Inject only the post-start persistence failure, not driver creation or the
 // external lifecycle write. Exercise the real revision check on retry.
 const save=runtime.save.bind(runtime);let injected=false;
 runtime.save=async()=>{if(!injected&&runtime.list()[0].state==='enabled'){injected=true;throw Object.assign(new Error('fixture share-delete contention'),{code:'EPERM'});}return save();};
 await runtime.start();assert.equal(injected,true);assert.equal(runtime.registrySavePending,true);
 const {pid}=await runtime.invoke('closure.provider',{});assert.doesNotThrow(()=>process.kill(pid,0));
 const external=f.host();await external[action]('provider');
 await until(()=>!runtime.capabilities().includes('closure.provider'),'external lifecycle change was trapped behind pending stale save');
 await until(()=>{try{process.kill(pid,0);return false;}catch(error){return error.code==='ESRCH';}},'old provider child remains alive');
 assert.equal(runtime.list()[0].enabled,false);assert.equal(runtime.list()[0].installed,action!=='uninstall');
 assert.equal(runtime.registrySavePending,false);
 const registry=JSON.parse(await fs.readFile(runtime.registryPath,'utf8'));assert.equal(registry.plugins.provider.enabled,false);
});

test('faulted dependency stays sticky across restart and dependent activation until explicit enable',{timeout:15000},async t=>{
 const f=await fixture(t),entry=path.join(f.root,'provider.mjs'),marker=path.join(f.root,'starts.txt'),consumer=path.join(f.root,'consumer.mjs');
 await fs.writeFile(entry,`import fs from 'node:fs';export const createPlugin=()=>{fs.appendFileSync(${JSON.stringify(marker)},'start\\n');return {invoke:()=>true}};`);
 await fs.writeFile(consumer,"export const createPlugin=()=>({invoke:(n,i,c)=>c.services.invoke('closure.base',i)});");
 const setup=f.host();await setup.install(f.manifest('provider',entry,'closure.base'),{enabled:true});
 await setup.install(f.manifest('consumer',consumer,'closure.derived',{requires:[{name:'closure.base',version:'1.x'}]}),{enabled:true});
 const registry=JSON.parse(await fs.readFile(setup.registryPath,'utf8'));registry.revision++;registry.plugins.provider.state='faulted';registry.plugins.provider.error='PLUGIN_START_FAILED: persisted fixture';await fs.writeFile(setup.registryPath,JSON.stringify(registry));
 const runtime=f.host();await runtime.start();
 assert.equal(runtime.list().find(x=>x.manifest.id==='provider').state,'faulted');
 await assert.rejects(fs.stat(marker),{code:'ENOENT'});assert.deepEqual(runtime.capabilities(),[]);
 await runtime.enable('provider');assert.equal(await runtime.invoke('closure.base',{}),true);
 await runtime.enable('consumer');assert.equal(await runtime.invoke('closure.derived',{}),true);
 assert.equal((await fs.readFile(marker,'utf8')).split('start').length-1,1);
});

test('missing-entry upgrade remediation explicitly requires a stopped runtime and never agent-owned shutdown',async t=>{
 const f=await fixture(t),host=f.host();
 await host.install(f.manifest('palace',path.join(f.root,'missing.mjs'),'knowledge.search'),{enabled:true});await host.start();
 const out=spawnSync(process.execPath,[path.join(packageRoot,'dist/plugins/palace/cli.js'),'--runtime-dir',f.root,'status'],{encoding:'utf8',timeout:10000});
 assert.equal(out.status,1,out.stderr);const body=JSON.parse(out.stdout);assert.equal(body.code,'PALACE_FAULTED');
 assert.match(body.remediation,/Stop the runtime.*reviewed.*manifest/);assert.doesNotMatch(body.remediation,/--bundled/);
 assert.match(body.remediation,/agent.*(?:must not|never).*stop/i);
});
