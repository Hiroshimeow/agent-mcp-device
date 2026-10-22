import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createPalaceProvider, cardHash } from '../../dist/plugins/palace/index.js';
import { LogPalace } from '../../dist/log-palace/store.js';
import { SourceCatalog } from '../../dist/plugins/palace/sources.js';

const sha=x=>createHash('sha256').update(x).digest('hex');
async function fixture(t,extra={}) {
  const root=mkdtempSync(join(tmpdir(),'mcp-v12-palace-'));
  const logs=join(root,'logs');mkdirSync(logs);
  const providers=[];
  const open=async(deviceId='A',options={})=>{
    const provider=createPalaceProvider({dataRoot:join(root,'data-'+deviceId),deviceId,sourceRoots:[logs],autoIndex:false,...extra,...options});
    await provider.start();providers.push(provider);return provider;
  };
  t.after(async()=>{for(const p of providers)await p.stop();rmSync(root,{recursive:true,force:true});});
  return {root,logs,open};
}
const search=(p,query,more={})=>p.invoke('knowledge.search',{query,...more});
async function seed(p,logs,text='Error SQLITE_BUSY: configure bounded retry; the attempt failed.') {
  writeFileSync(join(logs,'session.log'),text+'\n');
  await p.invoke('knowledge.ingest',{});
  const results=await search(p,'SQLITE_BUSY');
  assert.equal(results.items.length,1);
  return (await p.invoke('knowledge.read',{ref:results.items[0].read_ref})).card;
}
function tableCount(dataRoot,table) {
  const db=new DatabaseSync(join(dataRoot,'palace.sqlite'),{readOnly:true});
  try{return db.prepare('SELECT count(*) n FROM '+table).get().n;}finally{db.close();}
}

test('runtime roots preserve bounded known-source discovery; explicit isolated roots stay narrow',()=>{
  const dataRoot=join(tmpdir(),'mcp-v12-catalog-only'),runtimeLogs=join(dataRoot,'logs');
  const isolated=new SourceCatalog({dataRoot,deviceId:'fixture',sourceRoots:[runtimeLogs]});
  assert.deepEqual(isolated.sources,[runtimeLogs]);assert.equal(isolated.defaults,false);
  const configured=new SourceCatalog({dataRoot,deviceId:'fixture',sourceRoots:[runtimeLogs],discoverKnownSources:true});
  assert.ok(configured.sources.includes(runtimeLogs));assert.equal(configured.sources.length,5);assert.equal(configured.defaults,true);
});

test('P1 observation feed is bounded, read-only, resumable and does not claim verification',async t=>{
  const root=mkdtempSync(join(tmpdir(),'mcp-v12-p1feed-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,'events.log');writeFileSync(path,'Error FIRST\nError SECOND\nError THIRD\n');
  const original=sha(readFileSync(path)),logs=new LogPalace(join(root,'index'));
  try{
    logs.add(path);logs.index({maxFiles:8,maxBytes:32768});
    const before=logs.sources(),seen=new Set();let cursor;
    do{
      const page=logs.observations({cursor,limit:1,maxBytes:2048});
      assert.ok(Buffer.byteLength(JSON.stringify(page))<=2048);
      for(const row of page.items){
        assert.match(row.hash,/^[a-f0-9]{64}$/);assert.equal(row.source_available,true);
        assert.equal(row.verified,undefined);assert.ok(!seen.has(row.ref));seen.add(row.ref);
        assert.match(logs.read(row.ref).text,/Error/);
      }
      cursor=page.nextCursor;
    }while(cursor);
    assert.equal(seen.size,3);assert.deepEqual(logs.sources(),before);assert.equal(sha(readFileSync(path)),original);
  }finally{logs.close();}
});

test('offline cards survive restart; append is incremental and incomplete tails wait',async t=>{
  const f=await fixture(t),p=await f.open();
  const path=join(f.logs,'events.log');
  writeFileSync(path,'Error FIRST: missing configuration.\nError SECOND: waiting for complete source');
  const initial=sha(readFileSync(path));
  await p.invoke('knowledge.ingest',{});
  assert.equal((await search(p,'FIRST')).items.length,1);
  assert.equal((await search(p,'SECOND')).items.length,0);
  assert.equal(sha(readFileSync(path)),initial);
  const before=tableCount(join(f.root,'data-A'),'cards');
  await p.invoke('knowledge.ingest',{});
  assert.equal(tableCount(join(f.root,'data-A'),'cards'),before);
  appendFileSync(path,'\n');
  await p.invoke('knowledge.ingest',{});
  const found=await search(p,'SECOND');assert.equal(found.items.length,1);
  const selected=(await p.invoke('knowledge.read',{ref:found.items[0].id,evidence:true})).card;
  assert.equal(selected.status,'hypothesis');assert.equal(selected.contentHash,cardHash(selected));
  await p.stop();
  const restarted=await f.open();
  const read=await restarted.invoke('knowledge.read',{ref:selected.id,evidence:true});
  assert.equal(read.card.id,selected.id);assert.equal(read.card.version,selected.version);
  assert.equal(read.evidence[0].verifiedBytes,true);
});

test('source rewrite, deletion and invalid UTF-8 are never presented as current verified source',async t=>{
  const f=await fixture(t),p=await f.open(),card=await seed(p,f.logs);
  const path=join(f.logs,'session.log');
  writeFileSync(path,'Error NEW_VERSION: use a different remedy; prior source was replaced and length increased.\n');
  await p.invoke('knowledge.ingest',{});
  assert.equal((await search(p,'SQLITE_BUSY')).items.length,0);
  assert.equal((await p.invoke('knowledge.read',{ref:card.id})).card.status,'stale');
  const next=(await search(p,'NEW_VERSION')).items[0];assert.ok(next);
  rmSync(path);
  await p.invoke('knowledge.ingest',{});
  assert.equal((await p.invoke('knowledge.read',{ref:next.id})).card.status,'stale');
  writeFileSync(path,Buffer.concat([Buffer.from('Error INVALID_UTF8 '),Buffer.from([255]),Buffer.from('\n')]));
  await p.invoke('knowledge.ingest',{});
  assert.equal((await search(p,'INVALID_UTF8')).items.length,0);
});

test('scope is applied before ranking; project docs are constructed into cards',async t=>{
  const f=await fixture(t),privateRoot=join(f.root,'private-vault'),publicRoot=join(f.root,'public-web');
  mkdirSync(privateRoot);mkdirSync(publicRoot);
  writeFileSync(join(privateRoot,'README.md'),'# Private database constraint\nError VAULT_MARKER: requires encrypted local state.\n');
  writeFileSync(join(publicRoot,'README.md'),'# Public web\nConstraint: cache static assets.\n');
  const p=await f.open('A',{projectRoots:[privateRoot,publicRoot],sourceRoots:[]});
  await p.invoke('knowledge.ingest',{});
  assert.equal((await search(p,'VAULT_MARKER',{projectId:'public-web'})).items.length,0);
  assert.equal((await search(p,'VAULT_MARKER')).items.length,0);
  const match=(await search(p,'VAULT_MARKER',{projectId:'private-vault'})).items[0];assert.ok(match);
  await assert.rejects(p.invoke('knowledge.read',{ref:match.id,projectId:'public-web'}),/SCOPE_MISMATCH/);
  assert.match((await p.invoke('knowledge.read',{ref:match.id,projectId:'private-vault'})).card.body,/encrypted/);
});

test('normalized duplicate observations consolidate without crossing project scope or inflating trust',async t=>{
  const f=await fixture(t),alpha=join(f.root,'alpha'),beta=join(f.root,'beta');
  for(const project of [alpha,beta])mkdirSync(join(project,'.mcp-palace'),{recursive:true});
  const first=join(alpha,'.mcp-palace','events.log'),second=join(beta,'.mcp-palace','events.log');
  writeFileSync(first,'Error CONNECTION_RESET: retry after reconnecting.\nError   CONNECTION_RESET:  retry after reconnecting.\n');
  writeFileSync(second,'Error CONNECTION_RESET: retry after reconnecting.\n');
  const p=await f.open('A',{projectRoots:[alpha,beta],sourceRoots:[]});
  await p.invoke('knowledge.ingest',{});
  const a=await search(p,'CONNECTION_RESET',{projectId:'alpha'}),b=await search(p,'CONNECTION_RESET',{projectId:'beta'});
  assert.equal(a.items.length,1);assert.equal(b.items.length,1);assert.notEqual(a.items[0].id,b.items[0].id);
  const card=(await p.invoke('knowledge.read',{ref:a.items[0].id,projectId:'alpha'})).card;
  assert.equal(card.evidence.length,2);assert.equal(new Set(card.evidence.map(e=>e.id)).size,2);
  assert.equal(card.status,'hypothesis');assert.equal((await p.invoke('knowledge.skills',{projectId:'alpha'})).items.length,0);
  await p.invoke('knowledge.ingest',{});
  assert.equal((await p.invoke('knowledge.read',{ref:card.id})).card.version,card.version);
});

test('search/list neither import nor write cards; metadata and full read have hard budgets',async t=>{
  const f=await fixture(t),p=await f.open(),card=await seed(p,f.logs,'Error SQLITE_BUSY: '+('large output evidence '.repeat(600)));
  const dataRoot=join(f.root,'data-A'),count=tableCount(dataRoot,'cards'),versions=tableCount(dataRoot,'versions');
  const response=await search(p,'SQLITE_BUSY',{maxBytes:512});
  assert.ok(Buffer.byteLength(JSON.stringify(response))<=512);assert.equal(response.items.length,0);assert.equal(response.truncated,true);
  await p.invoke('knowledge.list',{});
  assert.equal(tableCount(dataRoot,'cards'),count);assert.equal(tableCount(dataRoot,'versions'),versions);
  await assert.rejects(p.invoke('knowledge.read',{ref:card.id,maxBytes:1024}),/BUDGET_TOO_SMALL/);
  const full=(await p.invoke('knowledge.read',{ref:card.id,maxBytes:65536})).card;
  assert.equal(cardHash(full),full.contentHash);
});

test('B -> A -> C -> A imports preserve original identity and cannot create corroboration',async t=>{
  const f=await fixture(t),b=await f.open('B'),a=await f.open('A',{sourceRoots:[]}),c=await f.open('C',{sourceRoots:[]});
  const original=await seed(b,f.logs);
  assert.equal((await search(a,'SQLITE_BUSY')).items.length,0);
  await a.invoke('knowledge.import',{card:original});
  const aCopy=(await a.invoke('knowledge.read',{ref:original.id})).card;
  await c.invoke('knowledge.import',{card:aCopy});
  const cCopy=(await c.invoke('knowledge.read',{ref:original.id})).card;
  const back=await a.invoke('knowledge.import',{card:cCopy});
  assert.equal(back.deduplicated,true);assert.equal(back.imported,false);
  assert.equal(back.card.originDeviceId,'B');assert.equal(back.card.servingDeviceId,'A');
  assert.equal(back.card.version,original.version);assert.equal(back.card.contentHash,original.contentHash);
  assert.deepEqual(back.card.evidence.map(e=>e.id),original.evidence.map(e=>e.id));
  assert.equal(tableCount(join(f.root,'data-A'),'cards'),1);
  const tampered={...original,body:'forged body'};
  await assert.rejects(a.invoke('knowledge.import',{card:tampered}),/HASH_MISMATCH/);
});

test('automatic ingestion proposes a recurring explicit fix without trusting the source verdict',async t=>{
  const f=await fixture(t);
  const text='Error RETRYABLE_WRITE: process failed. Fix: preserve the request idempotency key before a bounded retry.';
  writeFileSync(join(f.logs,'automatic.log'),text+'\n'+text+'\n');
  const p=await f.open('A',{autoIndex:true,indexBudget:{maxRecords:8,maxFiles:4,maxBytes:65536,intervalMs:60000}});
  const candidates=await p.invoke('knowledge.skills',{includeCandidates:true});
  assert.equal(candidates.items.length,1);assert.equal(candidates.items[0].status,'hypothesis');
  assert.equal((await p.invoke('knowledge.skills',{})).items.length,0);
  const selected=await p.invoke('knowledge.skills',{action:'read',ref:candidates.items[0].id,includeCandidates:true});
  assert.match(selected.body,/preserve the request idempotency key/);
  assert.equal(selected.card.evidence.length,2);
  await assert.rejects(p.invoke('knowledge.skills',{action:'read',ref:selected.card.id,includeCandidates:true,maxBytes:1024}),/BUDGET_TOO_SMALL/);
});

test('fake refs and caller success claims cannot activate a Skill',async t=>{
  const f=await fixture(t),p=await f.open(),source=await seed(p,f.logs);
  await assert.rejects(p.invoke('knowledge.learn',{summary:'Fake success',steps:['Never executed'],evidenceRefs:['fake:one','fake:two'],
    outcome:'success',exitCode:0,promoteImmediately:true}),/EVIDENCE_NOT_FOUND/);
  const learned=await p.invoke('knowledge.learn',{summary:'Bounded retry candidate',steps:['Configure bounded retries'],evidenceRefs:[source.id],
    outcome:'success',exitCode:0,validation:{passed:true},promoteImmediately:true});
  assert.equal(learned.activated,false);assert.equal(learned.card.status,'hypothesis');
  assert.equal(learned.reason,'VALIDATION_POLICY_NOT_CONFIGURED');
  assert.equal((await p.invoke('knowledge.skills',{})).items.length,0);
  const candidates=await p.invoke('knowledge.skills',{includeCandidates:true});
  assert.equal(candidates.items.length,1);assert.equal(candidates.items[0].body,undefined);
});

test('configured validator executes a real fixture and postcondition; corrections withdraw transitively',async t=>{
  const f=await fixture(t),outputPath=join(f.root,'verified-output.txt');
  let calls=0;
  const validationRunner=async()=>{
    calls++;
    const run=spawnSync(process.execPath,['-e','require("fs").writeFileSync(process.argv[1],"verified fixture result")',outputPath],{encoding:'utf8',timeout:5000});
    return {executionId:'fixture-'+calls,exitCode:run.status??99,postconditionPassed:existsSync(outputPath)&&readFileSync(outputPath,'utf8')==='verified fixture result',
      output:run.stdout+run.stderr,validatorVersion:'fixture/1'};
  };
  const p=await f.open('A',{validationRunner}),source=await seed(p,f.logs);
  const first=await p.invoke('knowledge.learn',{key:'retry',summary:'Validated retry',steps:['Run the fixture repair'],evidenceRefs:[source.id]});
  assert.equal(first.activated,true);assert.equal(first.card.status,'validated');assert.equal(calls,1);
  const second=await p.invoke('knowledge.learn',{key:'derived',summary:'Derived workflow',steps:['Follow tested retry'],evidenceRefs:[first.card.id]});
  assert.equal(second.activated,true);assert.equal((await p.invoke('knowledge.skills',{})).items.length,2);
  const selected=await p.invoke('knowledge.skills',{action:'read',ref:first.card.id});
  assert.match(selected.body,/fixture repair/);assert.equal(selected.active,true);
  const corrected=await p.invoke('knowledge.correct',{ref:source.id,body:'The retry claim was wrong for this version.',reason:'Fixture correction'});
  assert.ok(corrected.invalidated.includes(first.card.id));assert.ok(corrected.invalidated.includes(second.card.id));
  assert.equal((await p.invoke('knowledge.skills',{})).items.length,0);
  assert.equal((await p.invoke('knowledge.read',{ref:second.card.id})).card.status,'withdrawn');
  await assert.rejects(p.invoke('knowledge.skills',{action:'read',ref:first.card.id}),/SKILL_NOT_ACTIVE/);
  await assert.rejects(p.invoke('knowledge.skills',{action:'rollback',ref:first.card.id,version:first.card.version}),/CORRECTED_EVIDENCE/);
  assert.ok(tableCount(join(f.root,'data-A'),'versions')>tableCount(join(f.root,'data-A'),'cards'));
});

test('exit zero alone and a nonzero exit with claimed success both fail configured validation',async t=>{
  const f=await fixture(t);
  const p=await f.open('A',{validationRunner:async()=>{const run=spawnSync(process.execPath,['-e','process.exit(0)'],{encoding:'utf8'});
    return {executionId:'zero-without-postcondition',exitCode:run.status,postconditionPassed:false,output:'claimed success',validatorVersion:'fixture/1'};}});
  const source=await seed(p,f.logs);
  const zero=await p.invoke('knowledge.learn',{summary:'No postcondition',steps:['Unchecked task'],evidenceRefs:[source.id]});
  assert.equal(zero.activated,false);assert.equal(zero.reason,'VALIDATION_FAILED');
  const q=await f.open('B',{validationRunner:async()=>{const run=spawnSync(process.execPath,['-e','process.stdout.write("success");process.exit(99)'],{encoding:'utf8'});
    return {executionId:'failed-with-claim',exitCode:run.status,postconditionPassed:true,output:run.stdout,validatorVersion:'fixture/1'};}});
  await q.invoke('knowledge.ingest',{});const qSource=(await search(q,'SQLITE_BUSY')).items[0];
  const failed=await q.invoke('knowledge.learn',{summary:'False success',steps:['Failed fixture'],evidenceRefs:[qSource.id]});
  assert.equal(failed.activated,false);assert.equal((await q.invoke('knowledge.skills',{})).items.length,0);
});

test('imported correction withdraws local derivatives and stale version cannot roll back authority',async t=>{
  const f=await fixture(t),b=await f.open('B'),a=await f.open('A',{sourceRoots:[]});
  const original=await seed(b,f.logs);await a.invoke('knowledge.import',{card:original});
  const learned=await a.invoke('knowledge.learn',{summary:'Remote source candidate',steps:['Use selected knowledge'],evidenceRefs:[original.id]});
  const correction=await b.invoke('knowledge.correct',{ref:original.id,body:'Original advice superseded.',reason:'New version evidence'});
  await a.invoke('knowledge.import',{card:correction.card});
  assert.equal((await a.invoke('knowledge.read',{ref:learned.card.id})).card.status,'withdrawn');
  await a.invoke('knowledge.import',{card:original});
  const fresh=await a.invoke('knowledge.stat',{ref:original.id});
  assert.equal(fresh.version,correction.card.version);assert.equal(fresh.contentHash,correction.card.contentHash);
});

test('complete plugin snapshot restores managed correction evidence under a different root',async t=>{
  const f=await fixture(t),p=await f.open(),source=await seed(p,f.logs);
  const correction=await p.invoke('knowledge.correct',{ref:source.id,body:'Durable corrected source.',reason:'Restore fixture'});
  const before=await p.invoke('knowledge.read',{ref:source.id,evidence:true});
  assert.equal(before.evidence[0].verifiedBytes,true);
  await p.stop();
  const restoredRoot=join(f.root,'restored');cpSync(join(f.root,'data-A'),restoredRoot,{recursive:true});
  rmSync(join(f.root,'data-A'),{recursive:true,force:true});rmSync(f.logs,{recursive:true,force:true});
  const restored=createPalaceProvider({dataRoot:restoredRoot,deviceId:'A',sourceRoots:[],autoIndex:false});
  await restored.start();t.after(()=>restored.stop());
  const after=await restored.invoke('knowledge.read',{ref:source.id,evidence:true});
  assert.equal(after.card.contentHash,correction.card.contentHash);assert.equal(after.evidence[0].verifiedBytes,true);
  assert.match(after.evidence[0].text,/Durable corrected source/);
  await restored.stop();
});
