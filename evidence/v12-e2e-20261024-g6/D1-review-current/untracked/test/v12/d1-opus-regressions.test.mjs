import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {PluginHost} from '../../dist/platform/plugin-host.js';
import {processBirth,processNamespace} from '../../dist/platform/process-identity.js';
import {PalaceStore} from '../../dist/plugins/palace/store.js';
import {reconcilePalaceSkill} from '../../dist/plugins/palace/skill-manager.js';
import {bundledPluginManifests} from '../../dist/distribution.js';

const hashFile=async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function tmp(t,prefix){const root=await fs.mkdtemp(path.join(os.tmpdir(),prefix));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:50}));return root;}

test('cancel acknowledgement does not end supervision of responsive work that ignores abort', {timeout:12000}, async t=>{
 const root=await tmp(t,'d1-cancel-'),entry=path.join(root,'ignore.mjs');
 await fs.writeFile(entry,`export const createPlugin=()=>({invoke(n,i){if(i==='wait')return new Promise(r=>setTimeout(()=>r('late'),20000));return 'ok'}});`);
 const host=new PluginHost({stateRoot:root,deviceId:'d1'});t.after(()=>host.close().catch(()=>{}));
 await host.install({id:'ignore-abort',version:'1.0.0',dataSchemaVersion:1,isolation:'process',trusted:false,entry,capabilities:[{name:'d1.cancel',version:'1.0.0'}],timeoutMs:9000},{enabled:true});
 await host.start();
 const controller=new AbortController(),pending=host.invoke('d1.cancel','wait',{signal:controller.signal});
 setTimeout(()=>controller.abort(),50);
 await assert.rejects(pending,{code:'CANCELLED'});
 const earlyDeadline=Date.now()+6500;while(Date.now()<earlyDeadline)await sleep(50);
 assert.equal(host.list()[0].state,'enabled','cancel must not fault the provider before the original 9s request deadline');
 const faultDeadline=Date.now()+3500;while(host.list()[0].state!=='faulted'&&Date.now()<faultDeadline)await sleep(50);
 assert.equal(host.list()[0].state,'faulted','ignored cancelled work remains bounded by its original deadline');
 assert.deepEqual(host.capabilities(),[]);
});

test('old incomplete plugin registry lock requires explicit repair and then lifecycle proceeds',async t=>{
 const root=await tmp(t,'d1-registry-empty-'),plugins=path.join(root,'plugins');await fs.mkdir(plugins,{recursive:true});
 const lock=path.join(plugins,'registry.lock');await fs.writeFile(lock,'');await fs.utimes(lock,new Date(0),new Date(0));
 const entry=path.join(root,'p.mjs');await fs.writeFile(entry,'export const createPlugin=()=>({invoke:()=>true});');
 const manifest={id:'registry-test',version:'1.0.0',dataSchemaVersion:1,isolation:'in-process',trusted:true,entry,capabilities:[{name:'registry.test',version:'1.0.0'}]};
 const host=new PluginHost({stateRoot:root,deviceId:'d1'});t.after(()=>host.close().catch(()=>{}));
 await assert.rejects(host.install(manifest),e=>e?.code==='PLUGIN_REGISTRY_RECOVERY_REQUIRED');
 const repaired=await host.repairRegistryLock();assert.equal(repaired.recovered,true);
 await host.install(manifest);assert.equal(host.list()[0].manifest.id,'registry-test');
});

test('plugin registry repair distinguishes a reused PID by process birth identity',async t=>{
 const root=await tmp(t,'d1-registry-pid-'),plugins=path.join(root,'plugins');await fs.mkdir(plugins,{recursive:true});
 const body={pid:process.pid,token:randomUUID(),processBirth:'fixture-different-birth',namespace:await processNamespace(),createdAt:1};
 await fs.writeFile(path.join(plugins,'registry.lock'),JSON.stringify(body)+'\n');await fs.utimes(path.join(plugins,'registry.lock'),new Date(0),new Date(0));
 const host=new PluginHost({stateRoot:root,deviceId:'d1'});const repaired=await host.repairRegistryLock();assert.equal(repaired.recovered,true);
 assert.notEqual(await processBirth(process.pid),'fixture-different-birth');
});

test('wrong-schema WAL database is rejected without changing durable main/WAL or using shared temp',async t=>{
 const source=await tmp(t,'d1-schema-source-'),target=await tmp(t,'d1-schema-target-');
 const src=path.join(source,'palace.sqlite'),dst=path.join(target,'palace.sqlite'),writer=new DatabaseSync(src);
 writer.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT INTO meta VALUES('schema','2'); CREATE TABLE future_only(x TEXT);");
 const insert=writer.prepare('INSERT INTO future_only(x) VALUES(?)');writer.exec('BEGIN');for(let i=0;i<200;i++)insert.run('row-'+i);writer.exec('COMMIT');
 for(const suffix of ['','-wal','-shm'])await fs.copyFile(src+suffix,dst+suffix);
 const before=Object.fromEntries(await Promise.all(['','-wal'].map(async suffix=>[suffix,await hashFile(dst+suffix)])));
 const tempBefore=new Set((await fs.readdir(os.tmpdir())).filter(x=>x.startsWith('palace-schema-probe-')));
 assert.throws(()=>new PalaceStore(target,'d1'),/PALACE_SCHEMA_UNSUPPORTED/);
 const after=Object.fromEntries(await Promise.all(['','-wal'].map(async suffix=>[suffix,await hashFile(dst+suffix)])));
 assert.deepEqual(after,before);assert.deepEqual((await fs.readdir(os.tmpdir())).filter(x=>x.startsWith('palace-schema-probe-')&&!tempBefore.has(x)),[]);
 assert.deepEqual((await fs.readdir(target)).filter(x=>x.startsWith('.schema-probe-')),[]);writer.close();
});

test('non-empty SQLite without Palace meta is rejected without adoption or WAL creation',async t=>{
 const root=await tmp(t,'d1-nonpalace-'),file=path.join(root,'palace.sqlite'),db=new DatabaseSync(file);
 db.exec("CREATE TABLE foreign_table(x TEXT); INSERT INTO foreign_table VALUES('keep')");db.close();
 const before=await hashFile(file);
 assert.throws(()=>new PalaceStore(root,'d1'),/PALACE_SCHEMA_UNSUPPORTED/);
 assert.equal(await hashFile(file),before);await assert.rejects(fs.lstat(file+'-wal'),{code:'ENOENT'});
});

test('Device bundled Palace uninstall remediation reinstalls tombstone and preserves data', {timeout:15000}, async t=>{
 const root=await tmp(t,'d1-bundled-reinstall-'),palace=bundledPluginManifests().find(x=>x.id==='palace');assert.ok(palace);
 const host=new PluginHost({stateRoot:root,deviceId:'d1'});await host.ensureBundled([palace]);await host.start();
 const marker=path.join(host.dataRoot('palace'),'d1-marker');await fs.writeFile(marker,'keep');await host.uninstall('palace');await host.close();
 const palaceCli=path.resolve('dist/plugins/palace/cli.js'),deviceCli=path.resolve('dist/mcp-device.js');
 const status=spawnSync(process.execPath,[palaceCli,'--runtime-dir',root,'status'],{encoding:'utf8'});
 assert.equal(status.status,1,status.stderr);const failure=JSON.parse(status.stdout);assert.equal(failure.code,'PALACE_UNINSTALLED');assert.match(failure.remediation,/install palace --bundled --enable/);
 const repair=spawnSync(process.execPath,[deviceCli,'plugins','--runtime-dir',root,'install','palace','--bundled','--enable'],{encoding:'utf8'});
 assert.equal(repair.status,0,repair.stderr);
 const check=new PluginHost({stateRoot:root,deviceId:'d1'});await check.load();const record=check.list().find(x=>x.manifest.id==='palace');
 assert.equal(record.installed,true);assert.equal(record.enabled,true);assert.equal(record.installationSource,'distribution');assert.equal(await fs.readFile(marker,'utf8'),'keep');await check.close();
 const after=spawnSync(process.execPath,[palaceCli,'--runtime-dir',root,'status'],{encoding:'utf8'});assert.equal(after.status,0,after.stderr);assert.equal(JSON.parse(after.stdout).ok,true);
});

test('real PluginHost lifecycle records are enforced by Palace CLI', {timeout:15000},async t=>{
 const root=await tmp(t,'d1-real-lifecycle-'),palace=bundledPluginManifests().find(x=>x.id==='palace');assert.ok(palace);
 const host=new PluginHost({stateRoot:root,deviceId:'d1'});await host.ensureBundled([palace]);await host.start();await host.disable('palace');
 const cli=path.resolve('dist/plugins/palace/cli.js');
 let out=spawnSync(process.execPath,[cli,'--runtime-dir',root,'status'],{encoding:'utf8'});assert.equal(out.status,1);assert.equal(JSON.parse(out.stdout).code,'PALACE_DISABLED');
 await host.uninstall('palace');await host.close();
 out=spawnSync(process.execPath,[cli,'--runtime-dir',root,'status'],{encoding:'utf8'});assert.equal(out.status,1);assert.equal(JSON.parse(out.stdout).code,'PALACE_UNINSTALLED');
});

test('privileged package install never writes a root-owned Skill into another uid home',{skip:process.platform==='win32'||process.geteuid?.()!==0},async t=>{
 const root=await tmp(t,'d1-root-install-'),packageRoot=path.join(root,'node_modules','@hcu-lab.me','mcp-device'),home=path.join(root,'user-home');
 await fs.mkdir(path.join(packageRoot,'skills','palace-cli'),{recursive:true});await fs.writeFile(path.join(packageRoot,'package.json'),JSON.stringify({name:'@hcu-lab.me/mcp-device',version:'1.0.12'}));await fs.writeFile(path.join(packageRoot,'skills','palace-cli','SKILL.md'),'# Palace\n');
 await fs.mkdir(home,{recursive:true});await fs.chown(home,1000,1000);
 const result=await reconcilePalaceSkill({packageRoot,home});assert.equal(result.skipped,'privileged-install');assert.match(result.remediation,/agent user/);
 await assert.rejects(fs.lstat(path.join(home,'.mcp-device')),{code:'ENOENT'});await assert.rejects(fs.lstat(path.join(home,'.agents')),{code:'ENOENT'});
});
