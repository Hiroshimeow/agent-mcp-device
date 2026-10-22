import test from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeRouter } from '../../dist/platform/knowledge-router.js';

function fixture() {
  const capabilities=['knowledge.search','knowledge.read','knowledge.stat','knowledge.import'];
  const devices=[{deviceId:'A',accountId:'owner',online:true,capabilities},{deviceId:'B',accountId:'owner',online:true,capabilities}];
  const old={id:'K',version:1,contentHash:'revision-1',summary:'Shared fix',body:'Original shared body.',status:'observed',originDeviceId:'B',servingDeviceId:'B',scope:{visibility:'account'},evidence:[],derivedFrom:[],provenance:['B'],updatedAt:1,lastVerifiedAt:1};
  const state={preview:structuredClone(old),local:{...structuredClone(old),servingDeviceId:'A'},origin:structuredClone(old),metadata:undefined,readError:undefined,statError:undefined};
  const imports=[],calls=[];
  const transport={
    async devices(){return devices;},
    async call(accountId,deviceId,capability,input){
      calls.push({accountId,deviceId,capability});
      if(capability==='knowledge.search')return{items:[state.preview]};
      if(capability==='knowledge.stat'){if(state.statError)throw Object.assign(new Error(state.statError),{code:state.statError});return state.metadata??state.origin;}
      if(capability==='knowledge.import'){imports.push(structuredClone(input.card));return{imported:true};}
      if(deviceId==='A')return{card:structuredClone(state.local)};
      if(state.readError)throw Object.assign(new Error(state.readError),{code:state.readError});
      return{card:structuredClone(state.origin)};
    }
  };
  const router=new KnowledgeRouter(transport,{secret:Buffer.alloc(32,7)});
  const context={accountId:'owner',requesterDeviceId:'A',sessionId:'fixture'};
  const search=()=>router.search(context,{providerDeviceId:'B'});
  const revision=(values={})=>({...structuredClone(old),version:2,contentHash:'revision-2',updatedAt:2,...values});
  return{router,context,search,state,imports,calls,devices,revision};
}

test('origin scope revocation cannot return/import the old local or cached card',async()=>{
  const f=fixture(),found=await f.search(),ref=found.items[0].read_ref;
  await f.router.read(f.context,{ref});f.imports.length=0;
  f.state.origin=f.revision({scope:{visibility:'local'}});
  await assert.rejects(f.router.read(f.context,{ref}),{code:'ACCESS_DENIED'});
  assert.equal(f.imports.length,0);assert.equal(f.router.cacheStats().entries,0);
  f.devices[1].online=false;
  await assert.rejects(f.router.read(f.context,{ref}),{code:'ACCESS_DENIED'});
  assert.equal(f.imports.length,0);
});

test('known correction read failure is explicit and its revision floor survives the next offline read',async()=>{
  const f=fixture(),found=await f.search(),ref=found.items[0].read_ref;
  await f.router.read(f.context,{ref});f.imports.length=0;
  f.state.origin=f.revision({status:'withdrawn'});f.state.readError='KNOWLEDGE_BUDGET_EXCEEDED';
  await assert.rejects(f.router.read(f.context,{ref}),{code:'KNOWLEDGE_BUDGET_EXCEEDED'});
  assert.equal(f.imports.length,0);assert.equal(f.router.cacheStats().entries,0);
  f.devices[1].online=false;
  await assert.rejects(f.router.read(f.context,{ref}),{code:'KNOWLEDGE_REVISION_UNAVAILABLE'});
  assert.equal(f.imports.length,0);
  f.devices[1].online=true;f.state.readError=undefined;
  const corrected=await f.router.read(f.context,{ref});
  assert.equal(corrected.card.version,2);assert.equal(corrected.card.status,'withdrawn');
  assert.equal(f.imports.at(-1).status,'withdrawn');
});

for(const code of ['ACCESS_DENIED','KNOWLEDGE_NOT_FOUND','KNOWLEDGE_SCOPE_MISMATCH'])test('authoritative '+code+' never degrades into stale success',async()=>{
  const f=fixture(),found=await f.search(),ref=found.items[0].read_ref;
  f.state.statError=code;
  await assert.rejects(f.router.read(f.context,{ref}),{code});
  f.devices[1].online=false;
  await assert.rejects(f.router.read(f.context,{ref}),{code});
  assert.equal(f.imports.length,0);
  f.devices[1].online=true;f.state.statError=undefined;f.state.origin=f.revision();
  const current=await f.router.read(f.context,{ref});
  assert.equal(current.card.version,2);assert.equal(current.freshness.status,'current');
});

test('a signed v2 preview never reads an older v1 copy even while origin is offline',async()=>{
  const f=fixture();f.state.preview=f.revision();
  const found=await f.router.search(f.context,{providerDeviceId:'A'}),ref=found.items[0].read_ref;
  f.devices[1].online=false;
  await assert.rejects(f.router.read(f.context,{ref}),{code:'KNOWLEDGE_REVISION_UNAVAILABLE'});
  assert.equal(f.imports.length,0);
});

test('origin metadata v2 followed by v1 bytes is rejected; a racing newer v3 is accepted',async()=>{
  const f=fixture(),found=await f.search(),ref=found.items[0].read_ref;
  f.state.metadata=f.revision();
  await assert.rejects(f.router.read(f.context,{ref}),{code:'KNOWLEDGE_REVISION_UNAVAILABLE'});
  assert.equal(f.imports.length,0);
  f.state.origin=f.revision({version:3,contentHash:'revision-3'});
  const current=await f.router.read(f.context,{ref});
  assert.equal(current.card.version,3);assert.equal(current.freshness.status,'current');
  assert.equal(f.imports.at(-1).version,3);
});

test('serving Device identity is normalized from authenticated transport',async()=>{
  const f=fixture();f.state.local.servingDeviceId='foreign-unowned-device';
  const found=await f.search(),read=await f.router.read(f.context,{ref:found.items[0].read_ref});
  assert.equal(read.card.servingDeviceId,'A');
  const again=await f.router.read(f.context,{ref:read.read_ref});
  assert.equal(again.card.servingDeviceId,'A');
});
