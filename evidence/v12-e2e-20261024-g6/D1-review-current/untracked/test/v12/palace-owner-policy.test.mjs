import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {reconcilePalaceSkill} from '../../dist/plugins/palace/skill-manager.js';
import {PalaceStore,searchPalaceCards} from '../../dist/plugins/palace/store.js';

async function setup(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-owner-policy-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));
 const home=path.join(root,'home'),target=path.join(home,'.agents','skills','palace-cli');
 async function pkg(label,version){const p=path.join(root,label,'node_modules','@hcu-lab.me','palace');await fs.mkdir(path.join(p,'skills','palace-cli'),{recursive:true});await fs.writeFile(path.join(p,'package.json'),JSON.stringify({name:'@hcu-lab.me/palace',version}));await fs.writeFile(path.join(p,'skills','palace-cli','SKILL.md'),label);return p;}
 return {root,home,target,pkg};
}

test('explicit Skill removal remains an opt-out until an explicit repair',async t=>{
 const f=await setup(t),p=await f.pkg('package','1.0.12');
 await reconcilePalaceSkill({home:f.home,packageRoot:p,force:true});
 await reconcilePalaceSkill({home:f.home,packageRoot:p,force:true,removeCurrentOwner:true});
 await reconcilePalaceSkill({home:f.home,packageRoot:p});
 await assert.rejects(fs.lstat(f.target),{code:'ENOENT'});
 await reconcilePalaceSkill({home:f.home,packageRoot:p,force:true,install:true});
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'package');
});

test('release versions outrank their prereleases when selecting a Skill owner',async t=>{
 const f=await setup(t),beta=await f.pkg('beta','1.0.12-beta.10'),stable=await f.pkg('stable','1.0.12');
 await reconcilePalaceSkill({home:f.home,packageRoot:beta,force:true});
 await reconcilePalaceSkill({home:f.home,packageRoot:stable,force:true});
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'stable');
});

test('prerelease numeric identifiers compare numerically, and build metadata has no precedence',async t=>{
 const f=await setup(t),two=await f.pkg('rc-two','1.0.12-rc.2+z'),ten=await f.pkg('rc-ten','1.0.12-rc.10+a');
 await reconcilePalaceSkill({home:f.home,packageRoot:two,force:true});
 await reconcilePalaceSkill({home:f.home,packageRoot:ten,force:true});
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'rc-ten');
});

test('read-ahead search uses the same bounded corpus and first results as ordinary search',async t=>{
 const f=await setup(t),store=new PalaceStore(path.join(f.root,'data'),'fixture');
 try {
 store.atomic(()=>{for(let i=0;i<120;i++){const id=String(i).padStart(3,'0');store.put({id,version:1,contentHash:id,summary:'alpha beta',body:'alpha beta',status:'observed',originDeviceId:'fixture',servingDeviceId:'fixture',scope:{visibility:'account'},evidence:[],derivedFrom:[],provenance:[],updatedAt:1,lastVerifiedAt:null});}});
 const common={query:'alpha beta',limit:0,resultLimit:8};
 const direct=searchPalaceCards(store.db,'fixture',common),ahead=searchPalaceCards(store.db,'fixture',{...common,lookahead:true});
 assert.equal(direct.candidates,64);assert.equal(ahead.candidates,direct.candidates);assert.equal(ahead.items.length,9);
 assert.deepEqual(ahead.items.slice(0,8),direct.items);
 } finally {store.close();}
});
