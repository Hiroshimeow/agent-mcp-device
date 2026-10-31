import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {reconcilePalaceSkill} from '../../dist/plugins/palace/skill-manager.js';

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-recovery-guard-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));
 const home=path.join(root,'home'),pkg=path.join(root,'node_modules','@hcu-lab.me','mcp-device');
 const source=path.join(pkg,'skills','palace-cli'),target=path.join(home,'.agents','skills','palace-cli');
 await fs.mkdir(source,{recursive:true});await fs.writeFile(path.join(source,'SKILL.md'),'# original\n');
 await fs.writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'@hcu-lab.me/mcp-device',version:'1.0.12'}));
 const run=()=>reconcilePalaceSkill({home,packageRoot:pkg,force:true});
 const ledgerPath=path.join(home,'.mcp-device','palace-skill','owners.json');
 return {root,home,pkg,source,target,run,ledgerPath};
}

test('an unowned link is not adopted merely because its target resembles our package',async t=>{
 const f=await fixture(t);await fs.mkdir(path.dirname(f.target),{recursive:true});
 await fs.symlink(f.source,f.target,process.platform==='win32'?'junction':'dir');
 const before=await fs.readlink(f.target);const result=await f.run();
 assert.equal((await fs.lstat(f.target)).isSymbolicLink(),true);
 assert.equal(await fs.readlink(f.target),before);
 assert.match(result.result.find(x=>x.target===f.target).state,/preserved/);
});

test('user-created empty directories are modifications, not disposable install content',async t=>{
 const f=await fixture(t);await f.run();const empty=path.join(f.target,'my-empty-workspace');await fs.mkdir(empty);
 await fs.writeFile(path.join(f.source,'SKILL.md'),'# upgraded\n');await f.run();
 assert.equal((await fs.stat(empty)).isDirectory(),true);
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'# original\n');
});

test('an owned path replaced by a foreign link is not taken back on reconcile',async t=>{
 const f=await fixture(t);await f.run();await fs.rename(f.target,f.target+'-saved-by-user');
 const other=path.join(f.root,'foreign');await fs.mkdir(other);await fs.writeFile(path.join(other,'SKILL.md'),'# foreign\n');
 await fs.symlink(other,f.target,process.platform==='win32'?'junction':'dir');const before=await fs.readlink(f.target);
 await f.run();assert.equal((await fs.lstat(f.target)).isSymbolicLink(),true);assert.equal(await fs.readlink(f.target),before);
 assert.equal(await fs.readFile(path.join(other,'SKILL.md'),'utf8'),'# foreign\n');
});

async function interrupted(f,{corruptStage=false,editAside=false}={}){
 await f.run();const ledger=JSON.parse(await fs.readFile(f.ledgerPath,'utf8')),record=ledger.targets[f.target],id=randomUUID();
 const key=createHash('sha256').update(path.resolve(f.target)).digest('hex').slice(0,24);
 const base=path.dirname(f.ledgerPath),stage=path.join(base,'staging',id,key),aside=path.join(base,'aside',id,key);
 await fs.mkdir(path.dirname(stage),{recursive:true});await fs.cp(f.source,stage,{recursive:true});
 await fs.mkdir(path.dirname(aside),{recursive:true});await fs.rename(f.target,aside);
 if(corruptStage)await fs.writeFile(path.join(stage,'SKILL.md'),'partial');
 if(editAside)await fs.writeFile(path.join(aside,'my-notes.txt'),'user edit during interrupted upgrade');
 ledger.pending={id,target:f.target,stage,aside,selectedOwner:record.selectedOwner,version:record.version,files:record.files};
 await fs.writeFile(f.ledgerPath,JSON.stringify(ledger));return {stage,aside};
}

test('interrupted update recovery does not publish an unchecked partial staging tree',async t=>{
 const f=await fixture(t);await interrupted(f,{corruptStage:true});
 await f.run().catch(error=>assert.match(error.message,/SKILL|RECOVERY/));
 const body=await fs.readFile(path.join(f.target,'SKILL.md'),'utf8').catch(()=>null);
 assert.notEqual(body,'partial');assert.equal(body,'# original\n','complete prior generation must be restored');
});

test('user edits to an aside tree survive completion of an interrupted publish',async t=>{
 const f=await fixture(t),pending=await interrupted(f,{editAside:true});await f.run();
 assert.equal(await fs.readFile(path.join(pending.aside,'my-notes.txt'),'utf8'),'user edit during interrupted upgrade');
});

test('recovery validates managed paths before touching any ledger-supplied path',async t=>{
 const f=await fixture(t);await f.run();const ledger=JSON.parse(await fs.readFile(f.ledgerPath,'utf8')),record=ledger.targets[f.target];
 const foreign=path.join(f.root,'must-not-delete');await fs.mkdir(foreign);await fs.writeFile(path.join(foreign,'notes.txt'),'keep');
 ledger.pending={id:randomUUID(),target:f.target,stage:path.join(f.root,'missing-stage'),aside:foreign,selectedOwner:record.selectedOwner,version:record.version,files:record.files};
 await fs.writeFile(f.ledgerPath,JSON.stringify(ledger));await assert.rejects(f.run(),/SKILL|RECOVERY/);
 assert.equal(await fs.readFile(path.join(foreign,'notes.txt'),'utf8'),'keep');
});
