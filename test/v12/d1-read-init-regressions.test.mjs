import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {PalaceStore} from '../../dist/plugins/palace/store.js';
import {processNamespace} from '../../dist/platform/process-identity.js';

async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'d1-read-init-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));return root;}
test('interrupted first WAL initialization resumes, but foreign objects remain rejected',async t=>{
 const root=await fixture(t),file=path.join(root,'palace.sqlite');
 const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL');db.close();
 const store=new PalaceStore(root,'fixture');try{assert.equal(store.getMeta('schema'),'1');assert.equal(store.count(),0);}finally{store.close();}
 const foreign=path.join(root,'foreign');await fs.mkdir(foreign);const other=new DatabaseSync(path.join(foreign,'palace.sqlite'));other.exec('CREATE TABLE unrelated(value TEXT)');other.close();
 const before=await fs.readFile(path.join(foreign,'palace.sqlite'));assert.throws(()=>new PalaceStore(foreign,'fixture'),/PALACE_SCHEMA_UNSUPPORTED/);assert.deepEqual(await fs.readFile(path.join(foreign,'palace.sqlite')),before);
 const deceptive=path.join(root,'deceptive');await fs.mkdir(deceptive);const foreignDb=new DatabaseSync(path.join(deceptive,'palace.sqlite'));foreignDb.exec('CREATE TABLE sqliteXforeign(value TEXT)');foreignDb.close();
 const bytes=await fs.readFile(path.join(deceptive,'palace.sqlite'));assert.throws(()=>new PalaceStore(deceptive,'fixture'),/PALACE_SCHEMA_UNSUPPORTED/);assert.deepEqual(await fs.readFile(path.join(deceptive,'palace.sqlite')),bytes);
});
test('active read inspection uses PID and namespace without spawning children, never grants takeover',async t=>{
 const root=await fixture(t),runtime=path.join(root,'runtime');await fs.mkdir(runtime);
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});const exited=new Promise(resolve=>child.once('exit',resolve));t.after(async()=>{child.kill();await exited;});
 await fs.writeFile(path.join(runtime,'server-runtime.lock'),JSON.stringify({pid:child.pid,namespace:await processNamespace(),processBirth:'deliberately-not-birth-verified'}));
 const store=new PalaceStore(path.join(runtime,'plugins/palace/data'),'fixture');store.close();
 const hook=path.join(root,'no-spawn.cjs');await fs.writeFile(hook,`const cp=require('node:child_process');for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=()=>{throw Error('READ_PATH_SPAWN:'+key)};require('node:module').syncBuiltinESMExports();`);
 const out=spawnSync(process.execPath,['--require',hook,path.resolve(new URL('../../dist/plugins/palace/cli.js',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),'--runtime-dir',runtime,'status'],{encoding:'utf8',timeout:10000,env:{...process.env,MCP_DEVICE_SKIP_SKILL_INSTALL:'1'}});
 assert.equal(out.status,0,out.stderr);const body=JSON.parse(out.stdout);assert.equal(body.runtimeActive,true);assert.equal(body.leaseVerification,'pid-namespace');assert.equal(body.writePath,null);
});
test('explicit archive reads do not discover ambiguous home runtimes',async t=>{
 const root=await fixture(t),data=path.join(root,'archive');const store=new PalaceStore(data,'fixture');store.close();
 for(const runtime of [path.join(root,'.mcp-device'),path.join(root,'.mcp-device/server')]){await fs.mkdir(path.join(runtime,'plugins'),{recursive:true});await fs.writeFile(path.join(runtime,'plugins/registry.json'),JSON.stringify({plugins:{palace:{}}}));}
 const hook=path.join(root,'home.cjs');await fs.writeFile(hook,`require('node:os').homedir=()=>${JSON.stringify(root)};require('node:module').syncBuiltinESMExports();delete process.env.MCP_DEVICE_CONFIG_DIR;`);
 const out=spawnSync(process.execPath,['--require',hook,path.resolve(new URL('../../dist/plugins/palace/cli.js',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),'--data-root',data,'status'],{encoding:'utf8',timeout:10000,env:{...process.env,MCP_DEVICE_SKIP_SKILL_INSTALL:'1'}});
 assert.equal(out.status,0,out.stderr);assert.equal(JSON.parse(out.stdout).runtimeBinding,'unmanaged-archive');
});
