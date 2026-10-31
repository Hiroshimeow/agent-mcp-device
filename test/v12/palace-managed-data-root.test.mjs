import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PalaceStore} from '../../dist/plugins/palace/store.js';
const cli=fileURLToPath(new URL('../../dist/plugins/palace/cli.js',import.meta.url));
async function fixture(t,state){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-data-binding-')),runtime=path.join(root,'runtime'),data=path.join(runtime,'plugins/palace/data');
 t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:50}));
 new PalaceStore(data,'binding-fixture').close();
 const record={installed:state!=='uninstalled',enabled:state!=='disabled',state,manifest:{id:'palace',version:'1.0.12'},...(state==='upgrade-required'?{bundleUpgradeRequired:{version:'1.0.13'}}:{})};
 const registry=path.join(runtime,'plugins/registry.json');await fs.writeFile(registry,JSON.stringify({version:1,revision:1,plugins:{palace:record}}));
 const run=(args,extra={})=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...process.env,MCP_DEVICE_SKIP_SKILL_INSTALL:'1',...extra},timeout:10000});
 return {root,runtime,data,run,registry};
}
for(const [state,code] of [['disabled','PALACE_DISABLED'],['uninstalled','PALACE_UNINSTALLED'],['faulted','PALACE_FAULTED'],['upgrade-required','PALACE_UPGRADE_REQUIRED']]){
 test('an explicit managed data root retains '+state+' lifecycle restrictions',async t=>{
  const f=await fixture(t,state),before=await fs.readFile(path.join(f.data,'palace.sqlite'));
  for(const args of [['--data-root',f.data,'status'],['--data-root',f.data,'search','anything']]){
   const r=f.run(args);assert.equal(r.status,1,JSON.stringify({stdout:r.stdout,stderr:r.stderr}));
   assert.match(r.stdout+r.stderr,new RegExp(code));
  }
  const viaEnv=f.run(['status'],{PALACE_DATA_ROOT:f.data});assert.equal(viaEnv.status,1);assert.match(viaEnv.stdout, new RegExp(code));
  assert.deepEqual(await fs.readFile(path.join(f.data,'palace.sqlite')),before);
 });
}
test('an alias to a managed Palace data directory cannot hide its disabled registry',async t=>{
 const f=await fixture(t,'disabled'),alias=path.join(f.root,'archive-looking-alias');
 await fs.symlink(f.data,alias,process.platform==='win32'?'junction':'dir');
 const result=f.run(['--data-root',alias,'status']);assert.equal(result.status,1);assert.match(result.stdout,/PALACE_DISABLED/);
});
test('a separately copied archive is readable but makes no runtime or write authority claim',async t=>{
 const f=await fixture(t,'disabled'),archive=path.join(f.root,'offline-archive');await fs.mkdir(archive);
 await fs.copyFile(path.join(f.data,'palace.sqlite'),path.join(archive,'palace.sqlite'));
 const result=f.run(['--data-root',archive,'status']);assert.equal(result.status,0,result.stderr);
 const status=JSON.parse(result.stdout);assert.equal(status.pluginState,'unknown');assert.equal(status.runtimeActive,null);assert.equal(status.writePath,null);assert.equal(status.runtimeBinding,'unmanaged-archive');
});
