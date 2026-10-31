import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {PluginHost} from '../../dist/platform/plugin-host.js';
import {PalaceStore} from '../../dist/plugins/palace/store.js';
import {reconcilePalaceSkill} from '../../dist/plugins/palace/skill-manager.js';
import {processBirth,processNamespace} from '../../dist/platform/process-identity.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function tmp(t,prefix){const root=await fs.mkdtemp(path.join(os.tmpdir(),prefix));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));return root;}
function childEnv(home){const env={...process.env,HOME:home,USERPROFILE:home};delete env.MCP_DEVICE_CONFIG_DIR;delete env.PALACE_DATA_ROOT;delete env.MCP_DEVICE_SKILL_HOME;return env;}
async function writePalaceRuntime(root,state='enabled'){
 await fs.mkdir(path.join(root,'plugins','palace','data'),{recursive:true});
 new PalaceStore(path.join(root,'plugins','palace','data'),'d1-root').close();
 const entry=path.resolve('dist/plugins/palace/plugin.js');
 const record={manifest:{id:'palace',version:'1.0.12',dataSchemaVersion:1,isolation:'process',entry,capabilities:[{name:'knowledge.search',version:'1.0.0'}]},installed:true,enabled:state!=='disabled',schemaVersion:1,state,installationSource:'distribution'};
 await fs.mkdir(path.join(root,'plugins'),{recursive:true});
 await fs.writeFile(path.join(root,'plugins','registry.json'),JSON.stringify({version:1,revision:1,plugins:{palace:record}},null,2)+'\n');
}

test('runtime discovery prefers the active Device-only root and shared CLIs agree',{timeout:15000},async t=>{
 const home=await tmp(t,'d1-runtime-root-'),device=path.join(home,'.mcp-device'),server=path.join(device,'server');
 await writePalaceRuntime(device);await fs.mkdir(server,{recursive:true});
 await fs.writeFile(path.join(server,'plugins-placeholder'),'x');
 const birth=await processBirth(process.pid),namespace=await processNamespace();await fs.writeFile(path.join(device,'server-runtime.lock'),JSON.stringify({pid:process.pid,token:'d1-active',startedAt:Date.now(),processBirth:birth,namespace})+'\n');
 const env=childEnv(home),palace=path.resolve('dist/plugins/palace/cli.js'),mcp=path.resolve('dist/mcp-device.js');
 const status=spawnSync(process.execPath,[palace,'status'],{cwd:path.resolve('.'),env,encoding:'utf8'});
 assert.equal(status.status,0,status.stderr);assert.equal(path.resolve(JSON.parse(status.stdout).runtimeDir),path.resolve(device));
 const list=spawnSync(process.execPath,[mcp,'plugins','list'],{cwd:path.resolve('.'),env,encoding:'utf8'});
 assert.equal(list.status,0,list.stderr);assert.equal(path.resolve(JSON.parse(list.stdout).runtime_dir),path.resolve(device));
});

test('runtime discovery fails typed when server and Device-only roots are both active',async t=>{
 const home=await tmp(t,'d1-runtime-ambiguous-'),device=path.join(home,'.mcp-device'),server=path.join(device,'server');
 await fs.mkdir(server,{recursive:true});const birth=await processBirth(process.pid),namespace=await processNamespace();for(const root of [device,server])await fs.writeFile(path.join(root,'server-runtime.lock'),JSON.stringify({pid:process.pid,token:'active-'+path.basename(root),startedAt:Date.now(),processBirth:birth,namespace})+'\n');
 const out=spawnSync(process.execPath,[path.resolve('dist/plugins/palace/cli.js'),'status'],{env:childEnv(home),encoding:'utf8'});
 assert.equal(out.status,1);const line=out.stderr.trim().split(/\r?\n/).filter(x=>x.trim().startsWith('{')).at(-1);assert.ok(line,out.stderr);assert.equal(JSON.parse(line).code,'RUNTIME_AMBIGUOUS');assert.match(line,/--runtime-dir/);
});

test('Windows registry replacement retries share-delete contention without faulting a healthy plugin',{skip:process.platform!=='win32',timeout:15000},async t=>{
 const root=await tmp(t,'d1-registry-share-'),entry=path.join(root,'plugin.mjs');await fs.writeFile(entry,'export const createPlugin=()=>({invoke:()=>true});');
 const host=new PluginHost({stateRoot:root,deviceId:'d1'});t.after(()=>host.close().catch(()=>{}));
 await host.install({id:'palace',version:'1.0.0',dataSchemaVersion:1,isolation:'in-process',trusted:true,entry,capabilities:[{name:'d1.registry',version:'1.0.0'}]},{enabled:true});
 const registry=path.join(root,'plugins','registry.json'),ps=path.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const escaped=registry.replace(/'/g,"''"),child=spawn(ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',`$f=[IO.File]::Open('${escaped}',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);[Console]::Out.WriteLine('LOCKED');Start-Sleep -Milliseconds 300;$f.Dispose()`],{stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise((resolve,reject)=>{let out='';child.stdout.setEncoding('utf8');child.stdout.on('data',x=>{out+=x;if(out.includes('LOCKED'))resolve();});child.once('error',reject);setTimeout(()=>reject(new Error('lock fixture timeout')),3000).unref();});
 await host.start();assert.equal(host.list()[0].state,'enabled');assert.equal(await host.invoke('d1.registry',{}),true);
});

test('process plugin faults persist bounded stderr and Palace CLI gives executable remediation',{timeout:15000},async t=>{
 const root=await tmp(t,'d1-fault-remediation-'),entry=path.join(root,'fault.mjs');
 await fs.writeFile(entry,`export const createPlugin=()=>({start(){console.error('D1_STDERR_MARKER');throw Object.assign(new Error('fixture start failed'),{code:'PLUGIN_START_FAILED'});},invoke(){return true;}});`);
 const host=new PluginHost({stateRoot:root,deviceId:'d1'});
 await host.install({id:'palace',version:'1.0.0',dataSchemaVersion:1,isolation:'process',entry,capabilities:[{name:'knowledge.search',version:'1.0.0'}]},{enabled:true,installationSource:'manual'});await host.start();
 const fault=host.list()[0];assert.equal(fault.state,'faulted');assert.match(fault.error??'',/D1_STDERR_MARKER/);await host.close();
 const cli=path.resolve('dist/plugins/palace/cli.js');
 let out=spawnSync(process.execPath,[cli,'--runtime-dir',root,'status'],{encoding:'utf8'});assert.equal(out.status,1);let body=JSON.parse(out.stdout);
 assert.equal(body.code,'PALACE_FAULTED');assert.match(body.recordedError,/D1_STDERR_MARKER/);assert.match(body.remediation,/mcp-device plugins .* enable palace/);
 const file=path.join(root,'plugins','registry.json'),registry=JSON.parse(await fs.readFile(file,'utf8'));registry.plugins.palace.error='ENOENT: manual entry missing';registry.plugins.palace.state='faulted';await fs.writeFile(file,JSON.stringify(registry,null,2)+'\n');
 out=spawnSync(process.execPath,[cli,'--runtime-dir',root,'status'],{encoding:'utf8'});body=JSON.parse(out.stdout);assert.match(body.remediation,/upgrade palace --bundled/);
});


test('actual Palace CLI process probe stays within 20 ms p95 incremental overhead',{timeout:180000},async t=>{
 const root=await tmp(t,'d1-cli-probe-'),home=path.join(root,'home'),data=path.join(root,'data'),packageRoot=path.resolve('.');
 await reconcilePalaceSkill({home,packageRoot,force:true,install:true});
 new PalaceStore(data,'d1-probe').close();
 const cli=path.resolve('dist/plugins/palace/cli.js'),normal=[],skipped=[];
 const run=skip=>{
  const env={...process.env,MCP_DEVICE_SKILL_HOME:home,PALACE_DATA_ROOT:data};if(skip)env.MCP_DEVICE_SKIP_SKILL_INSTALL='1';else delete env.MCP_DEVICE_SKIP_SKILL_INSTALL;
  const started=performance.now(),out=spawnSync(process.execPath,[cli,'--data-root',data,'status'],{env,encoding:'utf8',timeout:10000});
  const elapsed=performance.now()-started;assert.equal(out.status,0,out.stderr);return elapsed;
 };
 for(let i=0;i<200;i++){normal.push(run(false));skipped.push(run(true));}
 normal.sort((a,b)=>a-b);skipped.sort((a,b)=>a-b);const p95=normal[189],baselineP95=skipped[189],delta=p95-baselineP95;
 t.diagnostic(JSON.stringify({samplesPerArm:200,p95Ms:p95,skipP95Ms:baselineP95,p95IncrementalMs:delta,acceptanceP95IncrementalMs:20}));
 assert.ok(delta<=20,`actual CLI probe p95 incremental overhead ${delta.toFixed(2)} ms exceeded 20 ms`);
});


test('upgrade intent is visible to the read-only CLI instead of stale enabled state',async t=>{
 const root=await tmp(t,'d1-upgrade-visible-');await writePalaceRuntime(root);
 await fs.mkdir(path.join(root,'plugins','palace'),{recursive:true});await fs.writeFile(path.join(root,'plugins','palace','upgrade-intent.json'),'{"version":1}\n');
 const out=spawnSync(process.execPath,[path.resolve('dist/plugins/palace/cli.js'),'--runtime-dir',root,'status'],{encoding:'utf8'});
 assert.equal(out.status,1);const body=JSON.parse(out.stdout);assert.equal(body.code,'PALACE_UPGRADE_IN_PROGRESS');assert.match(body.remediation,/mcp-device plugins/);
});

test('skills include-candidates excludes withdrawn stale and superseded procedures',async t=>{
 const root=await tmp(t,'d1-skills-filter-'),store=new PalaceStore(root,'d1');
 const db=store.db,now=Date.now();
 const add=(id,status,summary)=>{const card={id,version:1,contentHash:id,summary,body:summary,status,originDeviceId:'d1',servingDeviceId:'d1',scope:{visibility:'account'},evidence:[],derivedFrom:[],provenance:['d1'],updatedAt:now,lastVerifiedAt:now};db.prepare('INSERT INTO cards(id,version,status,kind,visibility,project_id,summary,body,json) VALUES(?,?,?,?,?,?,?,?,?)').run(id,1,status,'procedure','account',null,summary,summary,JSON.stringify(card));db.prepare('INSERT INTO card_fts(id,summary,body) VALUES(?,?,?)').run(id,summary,summary);};
 add('p-valid','validated','validated procedure');add('p-candidate','hypothesis','candidate procedure');add('p-withdrawn','withdrawn','withdrawn procedure');add('p-stale','stale','stale procedure');add('p-super','superseded','superseded procedure');store.close();
 const out=spawnSync(process.execPath,[path.resolve('dist/plugins/palace/cli.js'),'--data-root',root,'skills','--include-candidates','--max-bytes','16000'],{encoding:'utf8'});
 assert.equal(out.status,0,out.stderr);const body=JSON.parse(out.stdout),ids=body.items.map(x=>x.id).sort();assert.deepEqual(ids,['p-candidate','p-valid']);assert.equal(body.candidates,2);
});

test('explicit archive cannot bypass lifecycle through a symlinked Palace database',{timeout:10000},async t=>{
 const managed=await tmp(t,'d1-managed-db-'),archive=await tmp(t,'d1-archive-link-');new PalaceStore(managed,'d1').close();
 try{await fs.symlink(path.join(managed,'palace.sqlite'),path.join(archive,'palace.sqlite'),'file');}catch(error){if(error.code==='EPERM'){t.skip('Windows file symlink privilege unavailable');return;}throw error;}
 const out=spawnSync(process.execPath,[path.resolve('dist/plugins/palace/cli.js'),'--data-root',archive,'status'],{encoding:'utf8'});
 assert.equal(out.status,1);const line=out.stderr.trim().split(/\r?\n/).filter(x=>x.startsWith('{')).at(-1);assert.ok(line,out.stderr);assert.equal(JSON.parse(line).code,'PALACE_MANAGED_PATH_UNSAFE');
});

test('Windows service-account postinstall does not write Skill state',{skip:process.platform!=='win32'},async t=>{
 const home=await tmp(t,'d1-service-profile-'),script=path.resolve('scripts/v12/install-palace-skill.cjs');
 const out=spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,USERNAME:'SYSTEM',USERPROFILE:home,HOME:home,MCP_DEVICE_SKILL_HOME:home}});
 assert.equal(out.status,0,out.stderr);const body=JSON.parse(out.stdout);assert.equal(body.skipped,'service-profile');await assert.rejects(fs.lstat(path.join(home,'.agents')),{code:'ENOENT'});await assert.rejects(fs.lstat(path.join(home,'.mcp-device')),{code:'ENOENT'});
});
