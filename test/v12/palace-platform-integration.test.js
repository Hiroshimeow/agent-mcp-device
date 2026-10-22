import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPalaceProvider } from '../../dist/plugins/palace/index.js';
import { KnowledgeRouter } from '../../dist/platform/knowledge-router.js';
import { ActivityJournal } from '../../dist/platform/activity-journal.js';

async function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'mcp-v12-palace-platform-'));
  const runtime=join(root,'runtime'),logs=join(runtime,'logs');mkdirSync(logs,{recursive:true});
  const providers=[];
  const open=async(deviceId,sourceRoots=[logs])=>{
    const p=createPalaceProvider({deviceId,dataRoot:join(root,'provider-'+deviceId),sourceRoots,autoIndex:false});
    await p.start();providers.push(p);return p;
  };
  t.after(async()=>{for(const p of providers)await p.stop();rmSync(root,{recursive:true,force:true});});
  return{root,runtime,logs,open};
}

test('retained activity segments remain discoverable and exact evidence survives rollover without path churn',async t=>{
  const f=await fixture(t);
  const initial=new ActivityJournal(f.runtime,'B','initial-fixture',400);
  initial.record('repair-fixture-selected',{path:join(f.root,'selected.txt')},{exitCode:0});
  await initial.close();
  const selectedSegment=readdirSync(f.logs)[0],selectedPath=join(f.logs,selectedSegment);
  assert.match(selectedSegment,/^device-activity-\d+-[0-9a-f-]+\.jsonl$/);
  const originalBytes=readFileSync(selectedPath);
  const b=await f.open('B');
  await b.invoke('knowledge.ingest',{maxFiles:16,maxRecords:32,maxBytes:65536});
  const search=await b.invoke('knowledge.search',{query:'repair-fixture-selected'});
  assert.equal(search.items.length,1);
  const before=await b.invoke('knowledge.read',{ref:search.items[0].id,evidence:true});
  assert.equal(before.evidence[0].available,true);assert.equal(before.evidence[0].verifiedBytes,true);
  assert.match(before.evidence[0].text,/repair-fixture-selected/);
  const next=new ActivityJournal(f.runtime,'B','rollover-fixture',400);
  for(let i=1;i<=3;i++)next.record('retained-rollover-'+i,{}, {exitCode:0});
  await next.close();
  const names=readdirSync(f.logs);
  assert.equal(names.length,4);assert.ok(names.every(name=>name.endsWith('.jsonl')));
  assert.ok(existsSync(selectedPath));assert.deepEqual(readFileSync(selectedPath),originalBytes);
  await b.invoke('knowledge.ingest',{maxFiles:16,maxRecords:32,maxBytes:65536});
  const after=await b.invoke('knowledge.read',{ref:before.card.id,evidence:true});
  assert.equal(after.card.status,'observed');assert.equal(after.card.version,before.card.version);
  assert.equal(after.card.contentHash,before.card.contentHash);
  assert.equal(after.card.evidence[0].sourceRef,before.card.evidence[0].sourceRef);
  assert.equal(after.evidence[0].available,true);assert.equal(after.evidence[0].text,before.evidence[0].text);
  assert.equal((await b.invoke('knowledge.list',{})).items.length,4);
  assert.equal((await b.invoke('knowledge.skills',{})).items.length,0);
});

for(const mutation of ['rewrite','delete'])test('selected federation read revalidates origin evidence after source '+mutation+' without background ingest',async t=>{
  const f=await fixture(t),source=join(f.logs,'origin.jsonl');
  writeFileSync(source,JSON.stringify({toolName:'fixture-runner',arguments:{},output:'Error FRESH_MARKER: preserve the atomic idempotency key.'})+'\n');
  const a=await f.open('A',[]),b=await f.open('B');
  await b.invoke('knowledge.ingest',{});
  const capabilities=['knowledge.search','knowledge.list','knowledge.read','knowledge.stat','knowledge.import'];
  const devices=[{deviceId:'A',accountId:'owner',online:true,capabilities},{deviceId:'B',accountId:'owner',online:true,capabilities}];
  const providers={A:a,B:b},calls=[];
  const router=new KnowledgeRouter({
    async devices(){return devices;},
    async call(accountId,deviceId,capability,input){calls.push({accountId,deviceId,capability});return providers[deviceId].invoke(capability,input);}
  },{secret:Buffer.alloc(32,23)});
  const context={accountId:'owner',requesterDeviceId:'A',sessionId:'freshness-fixture'};
  const found=await router.search(context,{query:'FRESH_MARKER',providerDeviceId:'B'});
  assert.equal(found.items.length,1);
  const first=await router.read(context,{ref:found.items[0].read_ref});
  assert.equal(first.card.status,'observed');assert.equal(first.imported,true);
  const dependent=await a.invoke('knowledge.learn',{summary:'Atomic key procedure',steps:['Preserve the idempotency key'],evidenceRefs:[first.card.id]});
  assert.equal(dependent.card.status,'hypothesis');
  if(mutation==='delete')rmSync(source);
  else writeFileSync(source,JSON.stringify({toolName:'fixture-runner',arguments:{},output:'Error UPDATED_MARKER: previous source has changed and no longer proves the old advice.'})+'\n');
  const before=calls.length;
  const updated=await router.read(context,{ref:found.items[0].read_ref});
  assert.equal(updated.card.status,'stale');assert.ok(updated.card.version>first.card.version);
  assert.equal(updated.card.evidence[0].sourceAvailable,false);
  assert.equal((await a.invoke('knowledge.read',{ref:first.card.id})).card.status,'stale');
  assert.equal((await a.invoke('knowledge.read',{ref:dependent.card.id})).card.status,'withdrawn');
  assert.equal(calls.slice(before).some(call=>call.capability==='knowledge.ingest'),false);
  assert.ok(calls.slice(before).some(call=>call.deviceId==='B'&&call.capability==='knowledge.stat'));
});
