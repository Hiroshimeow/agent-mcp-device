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
import {processNamespace,processBirth} from '../../dist/plugins/palace/process-birth.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-d1r2-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));
 const home=path.join(root,'home'),state=path.join(home,'.mcp-device/palace-skill'),target=path.join(home,'.agents/skills/palace-cli'),ledgerPath=path.join(state,'owners.json');
 async function pkg(label,name='@hcu-lab.me/palace',version='1.0.12'){
  const dir=path.join(root,label,'node_modules',...name.split('/'));await fs.mkdir(path.join(dir,'skills/palace-cli'),{recursive:true});
  await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name,version,type:'module'}));
  await fs.writeFile(path.join(dir,'skills/palace-cli/SKILL.md'),label+' '+version+'\n');return dir;
 }
 const packageRoot=await pkg('initial'),run=(options={})=>reconcilePalaceSkill({home,packageRoot,...options});
 const ledger=()=>fs.readFile(ledgerPath,'utf8').then(JSON.parse);
 async function leaves(dir){try{let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())out.push(...await leaves(file));else out.push(file);}return out;}catch(error){if(error.code==='ENOENT')return [];throw error;}}
 return {root,home,state,target,ledgerPath,packageRoot,pkg,run,ledger,leaves};
}

test('D1 B1 repeated failed publication does not accumulate unmodified staging or pending intents',async t=>{
 const f=await fixture(t);await f.run();
 const prior=await fs.readFile(path.join(f.target,'SKILL.md'));
 await fs.writeFile(path.join(f.packageRoot,'package.json'),JSON.stringify({name:'@hcu-lab.me/palace',version:'1.0.13'}));
 await fs.writeFile(path.join(f.packageRoot,'skills/palace-cli/SKILL.md'),'new package bytes\n');
 const rename=fs.rename;fs.rename=async(a,b)=>{if(path.resolve(a)===path.resolve(f.target))throw Object.assign(new Error('fixture cross-device rename refusal'),{code:'EXDEV'});return rename(a,b);};
 t.after(()=>{fs.rename=rename;});
 const seen=[];for(let i=0;i<50;i++)try{seen.push(await f.run());}catch(error){seen.push({error:error.code});}
 fs.rename=rename;
 assert.deepEqual(await fs.readFile(path.join(f.target,'SKILL.md')),prior);
 assert.deepEqual(await f.leaves(path.join(f.state,'staging')),[],'Unpublished staging must not grow on repeated failure');
 const ledger=await f.ledger();assert.equal(ledger.pending,undefined);
 assert.ok(Object.keys(ledger.retained??{}).length<=1,'Only the other successfully updated target may have a retained prior tree');
 assert.ok(seen.every(result=>result.result?.some(row=>row.target===f.target&&row.state==='publish-failed')),'Each refusal must be an actionable per-target publish-failed result');
});

test('D1 B2 explicit repair distinguishes a reused PID from the original process birth identity',async t=>{
 const f=await fixture(t);await fs.mkdir(f.state,{recursive:true});
 await fs.writeFile(path.join(f.state,'owners.lock'),JSON.stringify({pid:process.pid,token:randomUUID(),processBirth:'fixture-known-different-birth',namespace:await processNamespace(),createdAt:1}));
 await f.run({force:true,breakLock:true,repair:true});
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'initial 1.0.12\n');
});

test('D1 B2 old timestamps never authorize stealing a matching live lock holder',async t=>{
 const f=await fixture(t);let entered,release;const ready=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});
 const cp=fs.cp;fs.cp=async(a,b,o)=>{if(path.resolve(a)===path.resolve(path.join(f.packageRoot,'skills/palace-cli'))){entered();await gate;}return cp(a,b,o);};
 t.after(()=>{fs.cp=cp;release();});
 const first=f.run();await ready;
 const lock=path.join(f.state,'owners.lock'),before=await fs.readFile(lock,'utf8');await fs.utimes(lock,new Date(0),new Date(0));
 await assert.rejects(f.run({force:true,breakLock:true}),error=>error.code==='PALACE_SKILL_LOCK_ACTIVE');
 assert.equal(await fs.readFile(lock,'utf8'),before);release();await first;fs.cp=cp;
});

test('D1 B3 an invalid other owner is diagnosed without blocking the verified owner',async t=>{
 const f=await fixture(t),other=await f.pkg('other','@hcu-lab.me/mcp-device','1.0.13');await f.run();await f.run({packageRoot:other});
 await fs.writeFile(path.join(other,'package.json'),JSON.stringify({name:'@foreign/replacement',version:'9.0.0'}));
 const result=await f.run();assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'initial 1.0.12\n');
 assert.equal(result.ownerProblems.length,1);assert.equal(result.ownerProblems[0].code,'PALACE_SKILL_OWNER_IDENTITY_CHANGED');
 const before=await fs.readFile(path.join(f.target,'SKILL.md'));
 const forgotten=await f.run({force:true,repair:true,forgetOwner:result.ownerProblems[0].owner});
 assert.equal(forgotten.forgottenOwner,result.ownerProblems[0].owner);assert.deepEqual(await fs.readFile(path.join(f.target,'SKILL.md')),before);
 assert.equal(Object.keys((await f.ledger()).owners).length,1);
});

test('D1 M1 a temporarily absent package remains discoverable after it returns with scripts disabled',async t=>{
 const f=await fixture(t),other=await f.pkg('other','@hcu-lab.me/mcp-device','1.0.13');await f.run();await f.run({packageRoot:other});
 const parked=other+'-updating';await fs.rename(other,parked);const absent=await f.run();
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'other 1.0.13\n','temporary absence must not downgrade the installed Skill');
 assert.ok(absent.ownerProblems.some(problem=>problem.code==='ENOENT'&&!problem.expired));
 assert.ok(absent.result.every(row=>row.state==='owner-unavailable'),'each target must expose the unavailable owner before it returns');
 await fs.rename(parked,other);await f.run();
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'other 1.0.13\n');
});

test('D1 M2 actual platform case aliases retain one owner and exactly two target identities',async t=>{
 const f=await fixture(t);await f.run();
 if(process.platform!=='win32'){
  const upper=await f.pkg('INITIAL','@hcu-lab.me/palace','1.0.12');await f.run({packageRoot:upper});assert.equal(Object.keys((await f.ledger()).owners).length,2,'Case-sensitive filesystems retain distinct package paths');return;
 }
 const result=await f.run({packageRoot:f.packageRoot.toUpperCase(),home:f.home.toUpperCase(),force:true});
 assert.equal(Object.keys((await f.ledger()).owners).length,1);assert.equal(Object.keys((await f.ledger()).targets).length,2);
 assert.ok(result.result.every(row=>row.state==='already-installed'));
});

test('D1 M4 lossless ledger reset recognizes byte-identical JSON-marked managed copies',async t=>{
 const f=await fixture(t);await f.run();await fs.writeFile(f.ledgerPath,'{broken');
 const result=await f.run({force:true,repair:true,abandonPending:true});
 assert.ok(result.result.every(row=>['updated','already-installed'].includes(row.state)));
 assert.ok((await palaceSkillStatus({home:f.home,packageRoot:f.packageRoot})).result.every(row=>row.state==='owned-pristine'));
});

test('D1 B4 a read-only CLI probe never publishes an upgrade or changes the ownership ledger',async t=>{
 const f=await fixture(t);await fs.mkdir(path.join(f.packageRoot,'dist/plugins'),{recursive:true});
 await fs.cp(path.join(root,'dist/plugins/palace'),path.join(f.packageRoot,'dist/plugins/palace'),{recursive:true});
 await fs.cp(path.join(root,'dist/platform'),path.join(f.packageRoot,'dist/platform'),{recursive:true});
 await fs.cp(path.join(root,'dist/log-palace'),path.join(f.packageRoot,'dist/log-palace'),{recursive:true});
 await fs.copyFile(path.join(root,'dist/config.js'),path.join(f.packageRoot,'dist/config.js'));
 await f.run();
 await fs.writeFile(path.join(f.packageRoot,'package.json'),JSON.stringify({name:'@hcu-lab.me/palace',version:'1.0.13',type:'module'}));
 await fs.writeFile(path.join(f.packageRoot,'skills/palace-cli/SKILL.md'),'updated source\n');
 const data=path.join(f.root,'archive');new PalaceStore(data,'probe-fixture').close();
 const before=await fs.readFile(f.ledgerPath),target=await fs.readFile(path.join(f.target,'SKILL.md'));
 const run=spawnSync(process.execPath,[path.join(f.packageRoot,'dist/plugins/palace/cli.js'),'--data-root',data,'status'],{encoding:'utf8',env:{...process.env,MCP_DEVICE_SKILL_HOME:f.home},timeout:15000});
 assert.equal(run.status,0,run.stderr);const out=JSON.parse(run.stdout);
 assert.equal(digest(await fs.readFile(f.ledgerPath)),digest(before));assert.deepEqual(await fs.readFile(path.join(f.target,'SKILL.md')),target);
 assert.equal(out.skillState,'update-available');assert.match(out.skill.remediation,/skill repair/);
});
