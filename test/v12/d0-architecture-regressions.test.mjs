import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { PalaceStore } from '../../dist/plugins/palace/store.js';
import { createPalaceProvider } from '../../dist/plugins/palace/index.js';
import { PluginHost } from '../../dist/platform/plugin-host.js';
import { processNamespace } from '../../dist/platform/process-identity.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const cli=path.join(root,'dist/plugins/palace/cli.js');
const deviceEntry=path.join(root,'dist/mcp-device.js');
const sha=async file=>crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
async function temp(_t,name){return await fs.mkdtemp(path.join(os.tmpdir(),name));}
const cleanup=dir=>fs.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:50});
function card(id,summary,body=summary){return {id,version:1,contentHash:crypto.createHash('sha256').update(id+summary+body).digest('hex'),summary,body,status:'validated',originDeviceId:'fixture',servingDeviceId:'fixture',scope:{visibility:'account'},evidence:[],derivedFrom:[],provenance:['fixture'],updatedAt:1,lastVerifiedAt:1};}

async function wrongSchemaFixture(t){
  const dir=await temp(t,'palace-wrong-schema-'),filename=path.join(dir,'palace.sqlite');
  const db=new DatabaseSync(filename);db.exec("CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);INSERT INTO meta(key,value) VALUES('schema','2');CREATE TABLE v2_only(value TEXT);");db.close();
  return {dir,filename,before:await sha(filename)};
}

test('wrong Palace schema is rejected before WAL pragmas or DDL mutate the database',async t=>{
  const f=await wrongSchemaFixture(t);t.after(()=>cleanup(f.dir));
  assert.throws(()=>new PalaceStore(f.dir,'fixture'),/PALACE_SCHEMA_UNSUPPORTED/);
  assert.equal(await sha(f.filename),f.before);
  await assert.rejects(fs.stat(f.filename+'-wal'),{code:'ENOENT'});
  const run=spawnSync(process.execPath,[cli,'--data-root',f.dir,'status'],{encoding:'utf8'});
  assert.equal(run.status,1,run.stdout);
  assert.match(run.stderr,/"code":"PALACE_SCHEMA_UNSUPPORTED"/);
  assert.equal(await sha(f.filename),f.before);
  await assert.rejects(fs.stat(f.filename+'-wal'),{code:'ENOENT'});
});

test('pre-existing Palace metadata without a schema version is rejected without adoption',async t=>{
  const dir=await temp(t,'palace-missing-schema-'),filename=path.join(dir,'palace.sqlite');t.after(()=>cleanup(dir));
  const db=new DatabaseSync(filename);db.exec('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE partial_state(value TEXT);');db.close();
  const before=await sha(filename);
  assert.throws(()=>new PalaceStore(dir,'fixture'),/PALACE_SCHEMA_UNSUPPORTED/);
  assert.equal(await sha(filename),before);
  await assert.rejects(fs.stat(filename+'-wal'),{code:'ENOENT'});
  const run=spawnSync(process.execPath,[cli,'--data-root',dir,'status'],{encoding:'utf8'});
  assert.equal(run.status,1,run.stdout);assert.match(run.stderr,/"code":"PALACE_SCHEMA_UNSUPPORTED"/);
  assert.equal(await sha(filename),before);await assert.rejects(fs.stat(filename+'-wal'),{code:'ENOENT'});
});

test('CLI and provider share the same relevance candidate pipeline beyond 300 matches',async t=>{
  const debug=value=>{if(process.env.DEBUG_D0_TEST==='1')process.stderr.write('[d0-search] '+value+'\n');};
  debug('temp');const dir=await temp(t,'palace-search-parity-'),dataRoot=path.join(dir,'data');
  debug('store');const store=new PalaceStore(dataRoot,'fixture');
  store.atomic(()=>{
    for(let i=0;i<399;i++)store.put(card('a'+String(i).padStart(3,'0'),'alpha common','alpha filler'),'procedure');
    store.put(card('z999','alpha critical unique','alpha critical unique critical unique'),'procedure');
  });
  debug('close');store.close();
  debug('provider-start');const provider=createPalaceProvider({dataRoot,deviceId:'fixture',discoverKnownSources:false,autoIndex:false});await provider.start();t.after(async()=>{await provider.stop();await cleanup(dir);});
  debug('provider-search');const canonical=await provider.invoke('knowledge.search',{query:'alpha critical unique',limit:5,maxBytes:65536});
  assert.equal(canonical.items[0].id,'z999');
  debug('cli');const run=spawnSync(process.execPath,[cli,'--data-root',dataRoot,'search','alpha critical unique','--limit','5','--max-bytes','65536'],{encoding:'utf8'});
  debug('assert');assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).items.map(item=>item.id),canonical.items.map(item=>item.id));
  debug('done');
});

test('platform plugins and knowledge commands default to the server state root',async t=>{
  const home=await temp(t,'platform-default-root-');t.after(()=>cleanup(home));const env={...process.env,HOME:home,USERPROFILE:home};
  delete env.MCP_DEVICE_CONFIG_DIR;
  const plugins=spawnSync(process.execPath,[deviceEntry,'plugins','list'],{env,encoding:'utf8',timeout:20000});
  assert.equal(plugins.status,0,plugins.stderr);
  assert.equal(path.resolve(JSON.parse(plugins.stdout).runtime_dir),path.resolve(home,'.mcp-device','server'));
  const knowledge=spawnSync(process.execPath,[deviceEntry,'knowledge','list','{}'],{env,encoding:'utf8',timeout:30000});
  assert.equal(knowledge.status,1,knowledge.stderr);
  assert.match(knowledge.stderr,/CAPABILITY_UNAVAILABLE/);
  await assert.rejects(fs.stat(path.join(home,'.mcp-device','server','plugins','registry.json')),{code:'ENOENT'});
  await assert.rejects(fs.stat(path.join(home,'.mcp-device','plugins','registry.json')),{code:'ENOENT'});
});

test('Palace CLI refuses disabled runtime state with an actionable typed limitation',async t=>{
  const runtime=await temp(t,'palace-disabled-runtime-');t.after(()=>cleanup(runtime));const dataRoot=path.join(runtime,'plugins','palace','data');
  const store=new PalaceStore(dataRoot,'fixture');store.atomic(()=>store.put(card('known','known procedure')),'procedure');store.close();
  await fs.mkdir(path.join(runtime,'plugins'),{recursive:true});
  await fs.writeFile(path.join(runtime,'plugins','registry.json'),JSON.stringify({version:1,revision:1,plugins:{palace:{manifest:{id:'palace',version:'1.0.12',dataSchemaVersion:1,isolation:'process',entry:'unused',capabilities:[{name:'knowledge.search',version:'1.0.0'}]},installed:true,enabled:false,schemaVersion:1,state:'disabled',installationSource:'distribution'}}}));
  const run=spawnSync(process.execPath,[cli,'--runtime-dir',runtime,'status'],{encoding:'utf8'});
  assert.equal(run.status,1,run.stdout);
  const failure=JSON.parse(run.stdout||run.stderr);
  assert.equal(failure.code,'PALACE_DISABLED');
  assert.match(failure.remediation,/plugins .*enable palace/);
});

test('cooperative cancellation does not fault the isolated plugin process',async t=>{
  const state=await temp(t,'plugin-cancel-'),entry=path.join(state,'cancel.mjs'),started=path.join(state,'started');
  await fs.writeFile(entry,`import fs from 'node:fs/promises';export const createPlugin=()=>({invoke(_n,input,c){if(input==='status')return 'alive';return new Promise((resolve,reject)=>{fs.writeFile(${JSON.stringify(started)},'yes');const timer=setTimeout(()=>resolve('late'),10000);c.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Object.assign(new Error('cancelled'),{code:'CANCELLED'}))},{once:true})})}});`);
  const host=new PluginHost({stateRoot:state,deviceId:'fixture'});t.after(async()=>{await host.close();await cleanup(state);});
  await host.install({id:'cancel-fixture',version:'1.0.0',dataSchemaVersion:1,isolation:'process',entry,timeoutMs:10000,capabilities:[{name:'test.cancel',version:'1.0.0'}]},{enabled:true});await host.start();
  const controller=new AbortController(),pending=host.invoke('test.cancel','wait',{signal:controller.signal});
  const deadline=Date.now()+5000;while(Date.now()<deadline){try{await fs.access(started);break}catch{await new Promise(r=>setTimeout(r,20));}}
  controller.abort();await assert.rejects(pending,{code:'CANCELLED'});
  assert.equal(await host.invoke('test.cancel','status'),'alive');
  assert.equal(host.list()[0].state,'enabled');
});

test('version-only bundled updates repin without a migration gate',async t=>{
  const state=await temp(t,'plugin-repin-'),entry=path.join(state,'bundle.mjs');
  await fs.writeFile(entry,'export const createPlugin=()=>({invoke:()=>1});');
  const manifest=version=>({id:'bundle',version,dataSchemaVersion:1,isolation:'in-process',trusted:true,entry,capabilities:[{name:'bundle.value',version:'1.0.0'}]});
  const first=new PluginHost({stateRoot:state,deviceId:'fixture'});await first.ensureBundled([manifest('1.0.0')]);await first.start();assert.equal(await first.invoke('bundle.value',{}),1);await first.close();
  await fs.writeFile(entry,'export const createPlugin=()=>({invoke:()=>2});');
  const second=new PluginHost({stateRoot:state,deviceId:'fixture'});t.after(async()=>{await second.close();await cleanup(state);});await second.ensureBundled([manifest('1.0.1')]);await second.start();
  assert.equal(second.list()[0].manifest.version,'1.0.1');assert.equal(second.list()[0].bundleUpgradeRequired,undefined);assert.equal(await second.invoke('bundle.value',{}),2);
});

test('disabled and faulted capabilities return specific lifecycle errors',async t=>{
  const state=await temp(t,'plugin-state-errors-'),entry=path.join(state,'value.mjs');await fs.writeFile(entry,'export const createPlugin=()=>({invoke:()=>true});');
  const host=new PluginHost({stateRoot:state,deviceId:'fixture'});t.after(async()=>{await host.close();await cleanup(state);});
  await host.install({id:'stateful',version:'1.0.0',dataSchemaVersion:1,isolation:'in-process',trusted:true,entry,capabilities:[{name:'state.value',version:'1.0.0'}]},{enabled:false});await host.start();
  await assert.rejects(host.invoke('state.value',{}),{code:'PLUGIN_DISABLED'});
  await host.uninstall('stateful');await assert.rejects(host.invoke('state.value',{}),{code:'PLUGIN_UNINSTALLED'});
});

test('external plugin upgrade changes provenance to manual',async t=>{
  const state=await temp(t,'plugin-provenance-'),v1=path.join(state,'v1.mjs'),v2=path.join(state,'v2.mjs');
  await fs.writeFile(v1,'export const createPlugin=()=>({invoke:()=>1});');await fs.writeFile(v2,'export const createPlugin=()=>({invoke:()=>2});');
  const m=(entry,version)=>({id:'bundle',version,dataSchemaVersion:1,isolation:'in-process',trusted:true,entry,capabilities:[{name:'bundle.value',version:'1.0.0'}]});
  const host=new PluginHost({stateRoot:state,deviceId:'fixture'});t.after(async()=>{await host.close();await cleanup(state);});await host.ensureBundled([m(v1,'1.0.0')]);
  await host.upgrade(m(v2,'1.0.1'),{installationSource:'manual'});
  assert.equal(host.list()[0].installationSource,'manual');
});

test('registry stale-lock recovery never steals a fresh lock or loses a successful update',{timeout:120000},async t=>{
  const root=await temp(t,'plugin-registry-race-');t.after(()=>cleanup(root));
  const manifest=(id,entry)=>({id,version:'1.0.0',dataSchemaVersion:1,isolation:'in-process',trusted:true,entry,capabilities:[{name:'test.'+id,version:'1.0.0'}]});
  for(let iteration=0;iteration<200;iteration++){
    const state=path.join(root,String(iteration)),plugins=path.join(state,'plugins');await fs.mkdir(plugins,{recursive:true});
    await fs.writeFile(path.join(plugins,'registry.lock'),JSON.stringify({pid:2147483646,token:'stale-'+iteration,processBirth:'dead-fixture',namespace:await processNamespace()}));
    const entryA=path.join(state,'a.mjs'),entryB=path.join(state,'b.mjs');await fs.writeFile(entryA,'export const createPlugin=()=>({invoke:()=>"a"});');await fs.writeFile(entryB,'export const createPlugin=()=>({invoke:()=>"b"});');
    const a=new PluginHost({stateRoot:state,deviceId:'fixture'}),b=new PluginHost({stateRoot:state,deviceId:'fixture'});
    const outcomes=await Promise.allSettled([a.install(manifest('alpha',entryA)),b.install(manifest('bravo',entryB))]);
    const succeeded=['alpha','bravo'].filter((_,index)=>outcomes[index].status==='fulfilled');assert.ok(succeeded.length>=1);
    const finalHost=new PluginHost({stateRoot:state,deviceId:'fixture'});await finalHost.load();const ids=finalHost.list().map(item=>item.manifest.id);
    for(const id of succeeded)assert.ok(ids.includes(id),`successful install ${id} was lost at iteration ${iteration}`);
    await finalHost.close();await a.close();await b.close();
    await assert.rejects(fs.stat(path.join(plugins,'registry.lock')),{code:'ENOENT'});await assert.rejects(fs.stat(path.join(plugins,'registry.lock.recovery')),{code:'ENOENT'});
  }
});

test('unresponsive synchronous child is killed only at its original request deadline after cancellation', {timeout:16000},async t=>{
  const state=await temp(t,'plugin-cancel-hung-'),entry=path.join(state,'hung.mjs'),started=path.join(state,'started');
  await fs.writeFile(entry,`import fs from 'node:fs';export const createPlugin=()=>({invoke(){fs.writeFileSync(${JSON.stringify(started)},'yes');while(true){}}});`);
  const host=new PluginHost({stateRoot:state,deviceId:'fixture'});t.after(async()=>{await host.close();await cleanup(state);});
  await host.install({id:'hung',version:'1.0.0',dataSchemaVersion:1,isolation:'process',entry,timeoutMs:10000,capabilities:[{name:'test.hung',version:'1.0.0'}]},{enabled:true});await host.start();
  const controller=new AbortController(),began=Date.now(),pending=host.invoke('test.hung',{}, {signal:controller.signal});
  const deadline=Date.now()+4000;while(Date.now()<deadline){try{await fs.access(started);break}catch{await new Promise(resolve=>setTimeout(resolve,20));}}
  controller.abort();await assert.rejects(pending,{code:'CANCELLED'});assert.ok(Date.now()-began<2000,'caller cancellation was not prompt');
  const earlyDeadline=began+8500;while(Date.now()<earlyDeadline)await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(host.list()[0].state,'enabled','cancel must not tighten the original 10s request deadline');
  const faultDeadline=began+12000;while(Date.now()<faultDeadline&&host.list()[0].state!=='faulted')await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(host.list()[0].state,'faulted');assert.deepEqual(host.capabilities(),[]);
});

test('standalone assembly includes license, plugin manifest, installer and closed imports',async t=>{
  const script=path.join(root,'scripts','v12','build-palace-package.mjs');
  const run=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stderr);
  const result=JSON.parse(run.stdout),output=result.output,manifest=JSON.parse(await fs.readFile(path.join(output,'package.json'),'utf8'));
  for(const file of ['LICENSE','palace.plugin.json','scripts/install-palace-skill.cjs'])await fs.access(path.join(output,file));
  assert.equal(manifest.scripts.postinstall,'node scripts/install-palace-skill.cjs');
  assert.equal(result.importClosure.ok,true);assert.equal(result.importClosure.unresolved.length,0);
});
