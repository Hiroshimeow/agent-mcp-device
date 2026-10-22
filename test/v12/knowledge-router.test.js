import test from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeRouter } from '../../dist/platform/knowledge-router.js';

function network() {
  const capabilities = ['knowledge.search','knowledge.list','knowledge.read','knowledge.stat','knowledge.import'];
  const devices = [{ deviceId:'A',accountId:'owner',online:true,capabilities,projects:[] },{ deviceId:'B',accountId:'owner',online:true,capabilities,projects:['project'] },{ deviceId:'C',accountId:'owner',online:true,capabilities:[] },{ deviceId:'D',accountId:'other',online:true,capabilities }];
  const card = { id:'K',version:1,contentHash:'revision-1',summary:'Fix ERR_LOCK with a transaction',body:'Observed transaction repair with a checked postcondition.',status:'observed',originDeviceId:'B',servingDeviceId:'B',scope:{projectId:'project',visibility:'project'},evidence:[{id:'original-evidence',originDeviceId:'B',sourceId:'source',sourceRef:'source-ref',recordHash:'source-hash',kind:'source_trace',sourceAvailable:true,observedAt:1}],derivedFrom:[],provenance:['B'],updatedAt:1,lastVerifiedAt:1 };
  const stores = new Map([['A',new Map()],['B',new Map([['K',structuredClone(card)]])],['D',new Map()]]), calls = [];
  const transport = { async devices(){ return devices; }, async call(accountId,deviceId,capability,input){
    calls.push({accountId,deviceId,capability,input}); const device=devices.find(d=>d.deviceId===deviceId);
    if(!device || device.accountId!==accountId) throw Object.assign(new Error('owner'),{code:'ACCESS_DENIED'});
    if(!device.online) throw new Error('offline'); const store=stores.get(deviceId);
    if(capability==='knowledge.search'||capability==='knowledge.list') return {items:[...store.values()].map(c=>({...c,evidenceCount:c.evidence.length,read_ref:c.id}))};
    if(capability==='knowledge.import'){const prior=store.get(input.card.id);store.set(input.card.id,{...structuredClone(input.card),servingDeviceId:deviceId});return{imported:!prior||prior.version!==input.card.version};}
    const found=store.get(input.ref); if(!found) throw Object.assign(new Error('missing'),{code:'KNOWLEDGE_NOT_FOUND'});
    return capability==='knowledge.stat'?{id:found.id,version:found.version,contentHash:found.contentHash,status:found.status}:{card:structuredClone(found)};
  }};
  const router=new KnowledgeRouter(transport,{secret:Buffer.alloc(32,7)}), ctx=(requesterDeviceId='C',accountId='owner')=>({accountId,requesterDeviceId,sessionId:'session'});
  return {router,devices,stores,calls,card,ctx};
}

test('C without Palace searches one relevant provider and reads with bounded session cache only',async()=>{
  const {router,stores,calls,ctx}=network(); const search=await router.search(ctx(),{query:'ERR_LOCK',projectId:'project'});
  assert.equal(search.items.length,1);assert.deepEqual(search.queried,['B']);assert.equal(calls.filter(c=>c.capability==='knowledge.import').length,0);
  const read=await router.read(ctx(),{ref:search.items[0].read_ref});assert.equal(read.card.id,'K');assert.equal(read.imported,false);assert.equal(stores.has('C'),false);
  assert.equal(router.cacheStats().entries,1);const before=calls.filter(c=>c.capability==='knowledge.read').length;
  await router.read(ctx(),{ref:search.items[0].read_ref});assert.equal(calls.filter(c=>c.capability==='knowledge.read').length,before);assert.equal(calls.filter(c=>c.capability==='knowledge.import').length,0);
});

test('search/list never import; selected read imports once with original evidence identity',async()=>{
  const {router,stores,calls,ctx}=network();const search=await router.search(ctx('A'),{query:'ERR_LOCK',projectId:'project'});
  await router.search(ctx('A'),{projectId:'project'},'list');assert.equal(stores.get('A').size,0);
  await router.read(ctx('A'),{ref:search.items[0].read_ref});assert.equal(stores.get('A').size,1);assert.equal(stores.get('A').get('K').originDeviceId,'B');
  assert.deepEqual(stores.get('A').get('K').evidence.map(e=>e.id),['original-evidence']);
  const fromA=await router.search(ctx(),{projectId:'project',providerDeviceId:'A'});await router.read(ctx(),{ref:fromA.items[0].read_ref});
  assert.equal(calls.filter(c=>c.deviceId==='C'&&c.capability==='knowledge.import').length,0);
});

test('on-demand origin correction updates imported copy; offline origin is explicitly stale',async()=>{
  const {router,stores,devices,calls,ctx}=network();const search=await router.search(ctx('A'),{projectId:'project'},'list');await router.read(ctx('A'),{ref:search.items[0].read_ref});
  Object.assign(stores.get('B').get('K'),{version:2,contentHash:'revision-2',status:'withdrawn'});
  const corrected=await router.read(ctx('A'),{ref:search.items[0].read_ref});assert.equal(corrected.card.status,'withdrawn');assert.equal(stores.get('A').get('K').version,2);
  devices.find(d=>d.deviceId==='B').online=false;const before=calls.length;
  const offline=await router.read(ctx('A'),{ref:search.items[0].read_ref});assert.equal(offline.freshness.status,'stale');assert.equal(offline.card.version,2);
  assert.ok(calls.slice(before).every(c=>c.deviceId==='A'));
});

test('another account, tampered refs, wrong requester and project boundaries are rejected',async()=>{
  const {router,ctx,calls}=network();const search=await router.search(ctx(),{projectId:'project'});const ref=search.items[0].read_ref;
  await assert.rejects(router.read(ctx('D','other'),{ref}),{code:'ACCESS_DENIED'});
  await assert.rejects(router.read(ctx(),{ref:ref.slice(0,-5)+'abcde'}),{code:'KNOWLEDGE_REF_INVALID'});
  await assert.rejects(router.search(ctx('D'),{}),{code:'ACCESS_DENIED'});
  await assert.rejects(router.read(ctx(),{ref,projectId:'private-other'}),{code:'ACCESS_DENIED'});
  const none=await router.search(ctx(),{projectId:'different'});assert.equal(none.items.length,0);
  assert.equal(calls.some(c=>c.accountId==='other'&&c.deviceId==='B'),false);
});

test('remote local-only cards never leave provider and first candidate cannot exceed search budget',async()=>{
  const {router,stores,ctx}=network();stores.get('B').get('K').scope.visibility='local';assert.equal((await router.search(ctx(),{projectId:'project'})).items.length,0);
  stores.get('B').get('K').scope.visibility='project';stores.get('B').get('K').summary='large '.repeat(10000);
  const result=await router.search(ctx(),{projectId:'project',maxBytes:1024});assert.ok(Buffer.byteLength(JSON.stringify(result))<=1024);assert.equal(result.truncated,true);
});
