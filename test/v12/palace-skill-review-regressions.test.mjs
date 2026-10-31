import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {reconcilePalaceSkill,palaceSkillStatus} from '../../dist/plugins/palace/skill-manager.js';
import {PalaceStore} from '../../dist/plugins/palace/store.js';

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-opus-regression-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:6,retryDelay:50}));
 const home=path.join(root,'home'),state=path.join(home,'.mcp-device','palace-skill');
 const target=path.join(home,'.agents','skills','palace-cli'),ledgerPath=path.join(state,'owners.json');
 async function pkg(label,name='@hcu-lab.me/palace',version='1.0.12'){
  const dir=path.join(root,label,'node_modules',...name.split('/'));
  await fs.mkdir(path.join(dir,'skills','palace-cli'),{recursive:true});
  await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name,version}));
  await fs.writeFile(path.join(dir,'skills','palace-cli','SKILL.md'),label+' '+version+'\n');return dir;
 }
 const packageRoot=await pkg('initial');
 const run=(options={})=>reconcilePalaceSkill({home,packageRoot,...options});
 const ledger=()=>fs.readFile(ledgerPath,'utf8').then(JSON.parse);
 async function count(dir){let n=0;try{for(const e of await fs.readdir(dir,{withFileTypes:true})){n++;if(e.isDirectory())n+=await count(path.join(dir,e.name));}}catch(e){if(e.code!=='ENOENT')throw e;}return n;}
 return {root,home,state,target,ledgerPath,packageRoot,pkg,run,ledger,count};
}

test('M1 other package owners refresh after an upgrade with install scripts disabled',async t=>{
 const f=await fixture(t),other=await f.pkg('other','@hcu-lab.me/mcp-device','1.0.13');
 await f.run();await f.run({packageRoot:other});
 await fs.writeFile(path.join(f.target,'notes.txt'),'preserve');
 await fs.writeFile(path.join(other,'package.json'),JSON.stringify({name:'@hcu-lab.me/mcp-device',version:'1.0.14'}));
 await fs.writeFile(path.join(other,'skills','palace-cli','SKILL.md'),'other changed offline\n');
 const first=await f.run(),offered=first.result.find(x=>x.target===f.target).pending;
 assert.equal(await fs.readFile(path.join(offered,'SKILL.md'),'utf8'),'other changed offline\n');
 const count=await f.count(f.state);await f.run();await f.run();assert.equal(await f.count(f.state),count);
 assert.ok(Object.values((await f.ledger()).owners).some(x=>x.version==='1.0.14'));
});

test('M2 package aliases identify one owner and share the same removal preference',async t=>{
 const f=await fixture(t);await f.run();const alias=path.join(f.root,'package-alias');
 await fs.symlink(f.packageRoot,alias,process.platform==='win32'?'junction':'dir');
 await f.run({packageRoot:alias,force:true});assert.equal(Object.keys((await f.ledger()).owners).length,1);
 const alternate=process.platform==='win32'?f.packageRoot.toUpperCase():alias;
 await f.run({packageRoot:alternate,force:true,removeCurrentOwner:true});
 await f.run();await assert.rejects(fs.lstat(f.target),{code:'ENOENT'});
});

test('M3 an old empty lock reports recovery required and explicit repair can recover it',async t=>{
 const f=await fixture(t);await fs.mkdir(f.state,{recursive:true});const lock=path.join(f.state,'owners.lock');
 await fs.writeFile(lock,'');await fs.utimes(lock,new Date(0),new Date(0));
 await assert.rejects(f.run(),error=>error.code==='PALACE_SKILL_LOCK_RECOVERY_REQUIRED');
 await f.run({force:true,breakLock:true});assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'initial 1.0.12\n');
});

test('M3 recovery never steals a live owner lock even when explicitly requested',async t=>{
 const f=await fixture(t);await fs.mkdir(f.state,{recursive:true});const lock=path.join(f.state,'owners.lock');
 const bytes=JSON.stringify({pid:process.pid,token:randomUUID()});await fs.writeFile(lock,bytes);
 await assert.rejects(f.run({force:true,breakLock:true}),error=>['PALACE_SKILL_LOCK_ACTIVE','PALACE_SKILL_BUSY'].includes(error.code));
 assert.equal(await fs.readFile(lock,'utf8'),bytes);
});

test('M4 corrupt ledgers remain intact until explicit lossless recovery',async t=>{
 const f=await fixture(t);await f.run();await fs.writeFile(f.ledgerPath,'{"interrupted":');
 await assert.rejects(f.run(),error=>error.code==='PALACE_SKILL_LEDGER_CORRUPT');
 const result=await f.run({force:true,abandonPending:true});
 const backups=(await fs.readdir(f.state)).filter(x=>x.startsWith('owners.json.corrupt-'));assert.equal(backups.length,1);
 assert.equal(await fs.readFile(path.join(f.state,backups[0]),'utf8'),'{"interrupted":');
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'initial 1.0.12\n');
 // Explicit lossless reset can recover an unchanged JSON-marked copy only after
 // verifying all bytes against the installed package; it must not remain foreign.
 assert.equal(result.result.find(x=>x.target===f.target).state,'updated');
 const recovered=await f.ledger();assert.ok(recovered.targets[f.target]);
 assert.equal(recovered.targets[f.target].version,'1.0.12');
});

test('M4 missing stage for a new target is recoverable without a fictional prior tree',async t=>{
 const f=await fixture(t);await f.run();const ledger=await f.ledger(),record=ledger.targets[f.target];
 await fs.rename(f.target,path.join(f.root,'saved-test-copy'));delete ledger.targets[f.target];
 const id=randomUUID(),key=createHash('sha256').update(path.resolve(f.target)).digest('hex').slice(0,24);
 ledger.pending={id,target:f.target,stage:path.join(f.state,'staging',id,key),aside:path.join(f.state,'aside',id,key),hadPrior:false,...record};
 await fs.writeFile(f.ledgerPath,JSON.stringify(ledger));await f.run();
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'initial 1.0.12\n');assert.equal((await f.ledger()).pending,undefined);
});

test('M5 one unsafe agent-home parent does not block the other target',async t=>{
 const f=await fixture(t),external=path.join(f.root,'external');await fs.mkdir(external);await fs.mkdir(f.home,{recursive:true});
 await fs.symlink(external,path.join(f.home,'.pi'),process.platform==='win32'?'junction':'dir');
 const result=await f.run();assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'initial 1.0.12\n');
 assert.equal(result.result.find(x=>x.target.includes(path.join('.pi','agent'))).state,'unsafe-parent');
 assert.deepEqual(await fs.readdir(external),[]);
});

for(const kind of ['directory','live-link','dangling-link'])test('M6 explicit adoption preserves an unowned '+kind,async t=>{
 const f=await fixture(t);await fs.mkdir(path.dirname(f.target),{recursive:true});const foreign=path.join(f.root,'foreign');
 if(kind==='directory') {await fs.mkdir(f.target);await fs.writeFile(path.join(f.target,'notes.txt'),'user bytes');}
 else {if(kind==='live-link'){await fs.mkdir(foreign);await fs.writeFile(path.join(foreign,'notes.txt'),'user bytes');}await fs.symlink(foreign,f.target,process.platform==='win32'?'junction':'dir');}
 const oldLink=kind==='directory'?null:await fs.readlink(f.target);
 const result=await f.run({force:true,adoptTarget:'agents'}),item=result.result.find(x=>x.target===f.target);
 assert.equal(item.state,'adopted');assert.ok(item.saved);assert.equal((await fs.lstat(f.target)).isSymbolicLink(),false);
 if(oldLink)assert.equal(await fs.readlink(item.saved),oldLink);else assert.equal(await fs.readFile(path.join(item.saved,'notes.txt'),'utf8'),'user bytes');
 if(kind==='live-link')assert.equal(await fs.readFile(path.join(foreign,'notes.txt'),'utf8'),'user bytes');
});

test('M7 explicit opt-out persists when a package moves to a new prefix',async t=>{
 const f=await fixture(t);await f.run();await f.run({removeCurrentOwner:true,force:true});
 const relocated=await f.pkg('relocated');const result=await f.run({packageRoot:relocated});
 assert.equal(result.optedOut,true);await assert.rejects(fs.lstat(f.target),{code:'ENOENT'});
 await f.run({packageRoot:relocated,force:true,install:true});await fs.access(path.join(f.target,'SKILL.md'));
});

test('read-only CLI does not wait for an occupied Skill management lock',async t=>{
 const f=await fixture(t);await fs.mkdir(f.state,{recursive:true});await fs.writeFile(path.join(f.state,'owners.lock'),JSON.stringify({pid:process.pid,token:randomUUID()}));
 const data=path.join(f.root,'data'),store=new PalaceStore(data,'busy-fixture');
 store.atomic(()=>store.put({id:'card',version:1,contentHash:'fixture',summary:'needle',body:'needle',status:'observed',originDeviceId:'busy-fixture',servingDeviceId:'busy-fixture',scope:{visibility:'account'},evidence:[],derivedFrom:[],provenance:[],updatedAt:1,lastVerifiedAt:null}));store.close();
 const cli=fileURLToPath(new URL('../../dist/plugins/palace/cli.js',import.meta.url)),began=performance.now();
 const result=spawnSync(process.execPath,[cli,'--data-root',data,'search','needle'],{encoding:'utf8',timeout:10000,env:{...process.env,MCP_DEVICE_SKILL_HOME:f.home,MCP_DEVICE_INSTALL_SKILLS_FORCE:'1'}});
 const elapsedMs=performance.now()-began;assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).returned,1);assert.ok(elapsedMs<1500,'Skill lock delayed read: '+elapsedMs+'ms');
 t.diagnostic(JSON.stringify({elapsedMs}));
});
