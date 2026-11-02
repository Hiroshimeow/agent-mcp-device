import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {PalaceStore} from '../../dist/plugins/palace/store.js';
import {PluginHost} from '../../dist/platform/plugin-host.js';
import {bundledPluginManifests} from './optional-palace-fixture.mjs';

const packageRoot=fileURLToPath(new URL('../../',import.meta.url));
const cli=path.join(packageRoot,'dist/plugins/palace/cli.js');
const storeUrl=new URL('../../dist/plugins/palace/store.js',import.meta.url).href;
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-killed-wal-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));return root;}
async function durable(file){return Object.fromEntries(await Promise.all(['','-wal'].map(async suffix=>[suffix,createHash('sha256').update(await fs.readFile(file+suffix)).digest('hex')])));}
async function killWriter(t,root,schema){
 await fs.mkdir(root,{recursive:true});const file=path.join(root,'palace.sqlite');
 new PalaceStore(root,'wal-fixture').close();
 const code=`import{DatabaseSync}from'node:sqlite';const db=new DatabaseSync(${JSON.stringify(file)});db.exec("PRAGMA journal_mode=WAL;PRAGMA wal_autocheckpoint=0;BEGIN IMMEDIATE");db.prepare('UPDATE meta SET value=? WHERE key=?').run(${JSON.stringify(schema)},'schema');db.prepare('INSERT INTO meta VALUES(?,?)').run('committed','survives-kill');db.exec('COMMIT;BEGIN IMMEDIATE');db.prepare('INSERT INTO meta VALUES(?,?)').run('uncommitted','must-rollback');console.log('WAL_READY');setInterval(()=>{},1000);`;
 const child=spawn(process.execPath,['--input-type=module','-e',code],{stdio:['ignore','pipe','pipe'],windowsHide:true});
 const exited=new Promise(resolve=>child.once('exit',resolve));t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}});
 await new Promise((resolve,reject)=>{let output='',stderr='';const timer=setTimeout(()=>reject(new Error('writer readiness timeout: '+stderr)),5000);child.stderr.on('data',x=>stderr+=x);child.stdout.on('data',x=>{output+=x;if(output.includes('WAL_READY')){clearTimeout(timer);resolve();}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error('writer exited before readiness: '+code+' '+stderr));});});
 child.kill('SIGKILL');await exited;assert.ok((await fs.stat(file+'-wal')).size>32,'writer must leave durable non-empty WAL');return file;
}
function reader(root){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,'--data-root',root,'status'],{env:{...process.env,MCP_DEVICE_SKIP_SKILL_INSTALL:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error('reader timeout'));},8000);child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});});}
for(const shm of ['stale','missing'])for(const schema of ['1','2'])test(`killed writer schema ${schema}, ${shm} SHM: concurrent read-only CLIs preserve durable WAL`,{timeout:20000},async t=>{
 const root=await fixture(t),file=await killWriter(t,root,schema);if(shm==='missing')await fs.rm(file+'-shm',{force:true});
 const before=await durable(file),results=await Promise.all(Array.from({length:4},()=>reader(root)));
 for(const result of results){assert.equal(result.code,schema==='1'?0:1,result.stderr);const output=JSON.parse(result.stdout||result.stderr.trim().split(/\r?\n/).filter(x=>x.startsWith('{')).at(-1));assert.equal(schema==='1'?output.ok:output.code,schema==='1'?true:'PALACE_SCHEMA_UNSUPPORTED');}
 assert.deepEqual(await durable(file),before,'read-only CLI schema inspection must not checkpoint durable bytes');
 if(schema==='2'){
  assert.throws(()=>new PalaceStore(root,'wal-reopen'),/PALACE_SCHEMA_UNSUPPORTED/);assert.deepEqual(await durable(file),before);
 }else{
  const runtime=path.join(root,'runtime'),data=path.join(runtime,'plugins/palace/data');await fs.mkdir(data,{recursive:true});
  for(const suffix of ['','-wal'])await fs.copyFile(file+suffix,path.join(data,'palace.sqlite')+suffix);
  const host=new PluginHost({stateRoot:runtime,deviceId:'wal-reopen'});
  try{
   await host.ensureBundled(bundledPluginManifests().filter(x=>x.id==='palace'));
   const started=performance.now();await host.start();assert.equal(host.list()[0].state,'enabled',host.list()[0].error);assert.ok(performance.now()-started<10000,'compatible process provider must initialize within its 10s default deadline');
   const reopened=new PalaceStore(root,'wal-reopen');try{assert.equal(reopened.getMeta('committed'),'survives-kill');assert.equal(reopened.getMeta('uncommitted'),'');}finally{reopened.close();}
  }finally{await host.close();}
 }
 assert.deepEqual((await fs.readdir(root)).filter(x=>x.startsWith('.schema-probe-')),[]);
});

test('crashed owned schema snapshots are reclaimed without touching active peers or unowned paths',{timeout:25000},async t=>{
 const root=await fixture(t),data=path.join(root,'data'),file=await killWriter(t,data,'2'),before=await durable(file);
 const shim=path.join(root,'cleanup-shim.mjs'),loader=path.join(root,'cleanup-loader.mjs');
 await fs.writeFile(shim,`import{DatabaseSync as Real}from'node:sqlite';export class DatabaseSync extends Real{constructor(file,options){if(options?.readOnly&&file===${JSON.stringify(file)})throw Object.assign(new Error('SQLITE_READONLY_RECOVERY'),{code:'SQLITE_READONLY_RECOVERY'});super(file,options);}}`);
 await fs.writeFile(loader,`export async function load(url,context,next){const result=await next(url,context);if(url===${JSON.stringify(storeUrl)})return {...result,source:String(result.source).replace("from 'node:sqlite'",${JSON.stringify('from '+JSON.stringify(pathToFileURL(shim).href))})};return result;}`);
 const prelude=`import fs from'node:fs';import{syncBuiltinESMExports}from'node:module';const copy=fs.copyFileSync;fs.copyFileSync=(...args)=>{copy(...args);console.log('SNAPSHOT_READY:'+args[1]);if(process.env.SNAPSHOT_MODE==='crash')process.exit(86);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);};syncBuiltinESMExports();const{PalaceStore}=await import(${JSON.stringify(storeUrl)});new PalaceStore(${JSON.stringify(data)},'cleanup');`;
 const crash=spawnSync(process.execPath,['--experimental-loader',pathToFileURL(loader).href,'--input-type=module','-e',prelude],{encoding:'utf8',timeout:10000,env:{...process.env,SNAPSHOT_MODE:'crash'}});
 assert.equal(crash.status,86,crash.stderr);const crashed=path.dirname(crash.stdout.trim().split('SNAPSHOT_READY:')[1]);assert.ok((await fs.stat(path.join(crashed,'palace.sqlite'))).size>0);
 const active=spawn(process.execPath,['--experimental-loader',pathToFileURL(loader).href,'--input-type=module','-e',prelude],{stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,SNAPSHOT_MODE:'active'}}),exited=new Promise(resolve=>active.once('exit',resolve));
 t.after(async()=>{active.kill('SIGKILL');await exited;});
 const peer=await new Promise((resolve,reject)=>{let text='',errors='';const timer=setTimeout(()=>reject(new Error('snapshot peer timeout: '+errors)),10000);active.stderr.on('data',x=>errors+=x);active.stdout.on('data',x=>{text+=x;if(text.includes('SNAPSHOT_READY:')){clearTimeout(timer);resolve(path.dirname(text.trim().split('SNAPSHOT_READY:')[1]));}});active.once('error',reject);});
 const unowned=path.join(data,'.schema-probe-unowned');await fs.mkdir(unowned);await fs.writeFile(path.join(unowned,'keep'),'not ours');
 assert.throws(()=>new PalaceStore(data,'cleanup-observer'),/PALACE_SCHEMA_UNSUPPORTED/);
 assert.equal(await fs.stat(crashed).then(()=>true,()=>false),false,'crashed snapshot leaked copied knowledge');assert.ok(await fs.stat(peer));assert.equal(await fs.readFile(path.join(unowned,'keep'),'utf8'),'not ours');assert.deepEqual(await durable(file),before);
});

// Force only the OS-specific read-only-recovery failure, while all SQL and
// snapshot I/O remain real. Native ACL/mount fault reproduction is separate.
for(const lowSpace of [false,true])test(`read-only recovery fallback ${lowSpace?'rejects insufficient space before copying':'uses a private local snapshot and rejects schema without durable mutation'}`,{timeout:15000},async t=>{
 const root=await fixture(t),data=path.join(root,'data'),file=await killWriter(t,data,'2'),before=await durable(file),events=path.join(root,'events.jsonl');
 const shim=path.join(root,'sqlite-shim.mjs'),loader=path.join(root,'loader.mjs');
 await fs.writeFile(shim,`import{DatabaseSync as Real}from'node:sqlite';import fs from'node:fs';export class DatabaseSync extends Real{constructor(file,options){if(options?.readOnly){fs.appendFileSync(${JSON.stringify(events)},JSON.stringify({file,readOnly:true})+'\\n');if(file===${JSON.stringify(file)})throw Object.assign(new Error('SQLITE_READONLY_RECOVERY'),{code:'SQLITE_READONLY_RECOVERY'});}super(file,options);}}`);
 await fs.writeFile(loader,`export async function load(url,context,next){const result=await next(url,context);if(url===${JSON.stringify(storeUrl)})return {...result,source:String(result.source).replace("from 'node:sqlite'",${JSON.stringify('from '+JSON.stringify(pathToFileURL(shim).href))})};return result;}`);
 const prelude=lowSpace?`import fs from'node:fs';import{syncBuiltinESMExports}from'node:module';fs.statfsSync=()=>({bavail:0,bsize:4096});syncBuiltinESMExports();`:'';
 const script=prelude+`const{PalaceStore}=await import(${JSON.stringify(storeUrl)});try{new PalaceStore(${JSON.stringify(data)},'fallback');throw new Error('UNEXPECTED_SCHEMA_ACCEPTANCE');}catch(error){if(!/${lowSpace?'PALACE_SCHEMA_SNAPSHOT_SPACE':'PALACE_SCHEMA_UNSUPPORTED'}/.test(error.message))throw error;console.log(error.message);}`;
 const result=spawnSync(process.execPath,['--experimental-loader',pathToFileURL(loader).href,'--input-type=module','-e',script],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,lowSpace?/PALACE_SCHEMA_SNAPSHOT_SPACE/:/PALACE_SCHEMA_UNSUPPORTED/);
 const opens=(await fs.readFile(events,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(opens.length,lowSpace?1:2);if(!lowSpace)assert.ok(path.dirname(opens[1].file).startsWith(path.join(data,'.schema-probe-')));
 assert.deepEqual(await durable(file),before);assert.deepEqual((await fs.readdir(data)).filter(x=>x.startsWith('.schema-probe-')),[]);
});
