import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPalaceProvider } from '../../dist/plugins/palace/index.js';

// Fixed corpus and independently worded requests are held apart. The invocation only receives
// the request, project scope and budget; expected answers and labels never enter provider input.
const corpus = [
  {project:'orders', key:'sqlite-lock', body:'Error SQLITE_BUSY in the settlement writer: a second transaction holds the database lock. Use a bounded busy timeout, retry the whole transaction, and retain the original idempotency key.', query:'How can the settlement writer recover from SQLITE_BUSY while preventing duplicate charges?'},
  {project:'orders', key:'cursor', body:'Constraint: order pagination uses an immutable created_at plus order_id cursor. Sorting by a mutable status duplicates or skips rows when fulfillment changes during traversal.', query:'Why does order pagination skip rows when fulfillment status changes?'},
  {project:'orders', key:'retry', body:'Decision: payment retries must reuse the first request idempotency key. A network disconnect after submission does not prove that the charge failed; query the payment receipt before another attempt.', query:'A payment request disconnected after submission; what evidence is needed before retrying?'},
  {project:'orders', key:'node-runtime', body:'Error node:sqlite import failed under Node 20 in the order worker. The package requires Node 22.13 or newer. Upgrade the actual service executable and verify process.execPath, not just the interactive terminal.', query:'The order worker cannot load node:sqlite although my terminal was upgraded; what should I inspect?'},
  {project:'gateway', key:'auth-loopback', body:'Error HTTP 401 for a localhost MCP client is expected until account login and device pairing finish. Loopback traffic uses the same account authentication and authorization checks as remote traffic.', query:'Why is a localhost MCP connection rejected with HTTP 401?'},
  {project:'gateway', key:'port', body:'Error EADDRINUSE starting the isolated gateway: the chosen port already has a listener. Use the assigned test port after inspecting its owner. Production and backup listeners must not be terminated.', query:'How should an isolated gateway test handle EADDRINUSE without interrupting another listener?'},
  {project:'gateway', key:'proxy', body:'Decision: a reverse proxy must forward WebSocket upgrades and preserve the original Host and authorization headers. Missing Upgrade routing causes the device tunnel handshake to fail after the HTTP page loads.', query:'The reverse proxy serves the page but the device WebSocket handshake fails; which routing is required?'},
  {project:'gateway', key:'revoke', body:'Constraint: revoking a paired device invalidates its routing permission immediately. Cached tunnel presence must never override a revoked account relationship; reconnect requires a new authorized pairing.', query:'Can a connected device keep its tunnel permission after the account revokes pairing?'},
  {project:'assets', key:'rename', body:'Error EXDEV while moving an attachment across volumes: atomic rename cannot cross a filesystem boundary. Copy to a temporary file on the destination volume, verify its hash, then rename locally and remove the old file.', query:'How do I safely move an attachment when rename reports EXDEV across volumes?'},
  {project:'assets', key:'utf8', body:'Error invalid UTF-8 in a log evidence range: return an explicit decoding failure instead of replacement characters. Preserve byte offsets and the original source hash so a later exact read can be audited.', query:'What should an exact evidence read return for malformed UTF-8 bytes?'},
  {project:'assets', key:'tail', body:'Decision: incremental JSONL ingestion checkpoints only complete newline-terminated records. An unfinished final line remains pending until appended bytes complete it; file growth alone is not proof of append-only content.', query:'When should the ingester advance its checkpoint for an unfinished JSONL tail?'},
  {project:'assets', key:'backup', body:'Constraint: a portable knowledge backup includes SQLite state and managed evidence files. Stop writes, checkpoint WAL, then copy the complete plugin root. External sources remain provenance references and must be reported unavailable if absent.', query:'Which data is necessary to restore knowledge evidence after moving to another machine?'}
];
const distractorTopics = [
  'Error image thumbnail conversion: preserve the original aspect ratio and reject zero-width dimensions.',
  'Constraint: email notification templates require an explicit locale and a plain text fallback.',
  'Decision: metric histogram buckets describe elapsed request durations; counters must not be reset during aggregation.',
  'Error CSS font download timeout: a system font fallback keeps the navigation readable.',
  'Constraint: CSV exports quote commas and embedded line breaks; spreadsheet formulas need separate handling.',
  'Decision: release notes list user-visible behavior and link the matching change receipt.',
  'Error calendar recurrence: daylight saving transitions shift the UTC instant while local meeting time stays fixed.',
  'Constraint: a resized avatar must preserve alpha transparency and strip metadata before upload.',
  'Decision: inventory reconciliation compares warehouse receipts and counts missing serial numbers.',
  'Error printer paper size mismatch: choose the destination tray profile before repeating the job.',
  'Constraint: shipping labels include the postal code and country-specific address ordering.',
  'Decision: audio normalization measures integrated loudness and avoids clipping transient peaks.'
];
const noAnswerRequests = [
  {project:'orders',query:'How do I repair a Rust Cargo checksum mismatch in the package registry?'},
  {project:'gateway',query:'Which PostgreSQL replication slot retains WAL after a subscriber disconnects?'},
  {project:'assets',query:'How should a Kubernetes pod recover from an expired image pull credential?'}
];
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]??0;
function treeBytes(root) {
  let bytes=0;
  for(const entry of readdirSync(root,{withFileTypes:true})){
    const path=join(root,entry.name);
    if(entry.isDirectory())bytes+=treeBytes(path);else if(entry.isFile())bytes+=statSync(path).size;
  }
  return bytes;
}

test('held-out scoped retrieval benchmark reports quality, stale errors, bytes, latency and storage',async t=>{
  const root=mkdtempSync(join(tmpdir(),'mcp-v12-palace-benchmark-'));
  const projects=['orders','gateway','assets'],projectRoots=projects.map(p=>join(root,p));
  const dataRoot=join(root,'provider'),deviceId='benchmark-device';
  const rawBytes={};let sourceRecords=0;
  for(const project of projects){
    const logRoot=join(root,project,'.mcp-palace');mkdirSync(logRoot,{recursive:true});
    const records=[...corpus.filter(x=>x.project===project).map(x=>x.body)];
    for(let batch=0;batch<3;batch++)for(let i=0;i<distractorTopics.length;i++)
      records.push(distractorTopics[i]+' Incident '+(batch*12+i+1)+' in '+project+' archive.');
    const text=records.join('\n')+'\n';
    rawBytes[project]=Buffer.byteLength(text);sourceRecords+=records.length;
    writeFileSync(join(logRoot,'session.log'),text);
  }
  const stalePath=join(projectRoots[1],'.mcp-palace','old-claim.log');
  writeFileSync(stalePath,'Error DEPRECATED_ROUTE_CACHE: this obsolete route workaround must be withdrawn after deleting its source.\n');
  sourceRecords++;
  const provider=createPalaceProvider({dataRoot,deviceId,projectRoots,sourceRoots:[],autoIndex:false});
  await provider.start();
  t.after(async()=>{await provider.stop();rmSync(root,{recursive:true,force:true});});
  const indexStart=performance.now();let ingestRounds=0,created=0;
  for(let i=0;i<6;i++){
    const receipt=await provider.invoke('knowledge.ingest',{maxRecords:256,maxFiles:32,maxBytes:4*1024*1024});
    created+=receipt.created;ingestRounds++;
    if(receipt.complete)break;
  }
  const indexMs=performance.now()-indexStart;
  const expected=new Map();
  for(const project of projects){
    const list=await provider.invoke('knowledge.list',{projectId:project,limit:50,maxBytes:65536});
    for(const item of list.items)for(const record of corpus.filter(x=>x.project===project))
      if(item.summary.includes(record.body.slice(0,70)))expected.set(record.key,item.id);
  }
  assert.equal(expected.size,corpus.length,'Every target must actually have been indexed before measuring retrieval');
  const latencies=[],responses=[];let top1=0,hit3=0,relevantReturned=0,totalReturned=0,scopeLeaks=0,budgetErrors=0;
  for(const request of corpus){
    const start=performance.now();
    const response=await provider.invoke('knowledge.search',{query:request.query,projectId:request.project,limit:3,maxBytes:4096});
    latencies.push(performance.now()-start);
    const bytes=Buffer.byteLength(JSON.stringify(response));
    const ids=response.items.map(item=>item.id),wanted=expected.get(request.key);
    if(ids[0]===wanted)top1++;if(ids.includes(wanted))hit3++;
    relevantReturned+=ids.filter(id=>id===wanted).length;totalReturned+=ids.length;
    scopeLeaks+=response.items.filter(item=>item.scope.visibility==='project'&&item.scope.projectId!==request.project).length;
    if(bytes>4096)budgetErrors++;
    responses.push({key:request.key,query:request.query,top1:ids[0]===wanted,hit3:ids.includes(wanted),returned:ids.length,bytes,
      retrievedSummaries:response.items.map(x=>x.summary)});
  }
  // Warm latency samples do not alter quality scores or learn from the answers.
  for(let round=0;round<5;round++)for(const request of corpus){
    const start=performance.now();
    await provider.invoke('knowledge.search',{query:request.query,projectId:request.project,limit:3,maxBytes:4096});
    latencies.push(performance.now()-start);
  }
  const negativeResults=[];
  for(const request of noAnswerRequests){
    const response=await provider.invoke('knowledge.search',{query:request.query,projectId:request.project,limit:3,maxBytes:4096});
    negativeResults.push({...request,returned:response.items.length,summaries:response.items.map(x=>x.summary)});
  }
  const heldoutRequests=[
    {project:'orders',key:'sqlite-lock',query:'The settlement database is busy and a write must be retried. Which lock handling preserves idempotency?'},
    {project:'orders',key:'cursor',query:'We see missing orders while scrolling as fulfillment changes. Which stable pagination fields should drive the cursor?'},
    {project:'gateway',key:'auth-loopback',query:'MCP from the same machine receives unauthorized. Is account pairing still part of the connection setup?'},
    {project:'gateway',key:'proxy',query:'The site opens, but upgraded socket traffic never reaches the paired device. What must the proxy forward?'},
    {project:'assets',key:'backup',query:'How do we relocate persisted knowledge with enough evidence to audit it after recovery?'},
    {project:'gateway',key:'port',query:'A test gateway cannot bind its socket because another service owns the address; how do we investigate safely?'}
  ];
  const heldoutCases=[];
  for(const request of heldoutRequests){
    const response=await provider.invoke('knowledge.search',{query:request.query,projectId:request.project,limit:3,maxBytes:4096});
    const ids=response.items.map(item=>item.id),wanted=expected.get(request.key);
    heldoutCases.push({...request,top1:ids[0]===wanted,hit3:ids.includes(wanted),returned:ids.length,
      summaries:response.items.map(item=>item.summary)});
  }
  const before=(await provider.invoke('knowledge.search',{query:'DEPRECATED_ROUTE_CACHE',projectId:'gateway'})).items;
  assert.equal(before.length,1);
  rmSync(stalePath);
  for(let i=0;i<4;i++)await provider.invoke('knowledge.ingest',{maxRecords:256,maxFiles:32,maxBytes:4*1024*1024});
  const staleErrors=(await provider.invoke('knowledge.search',{query:'DEPRECATED_ROUTE_CACHE',projectId:'gateway'})).items.length;
  const staleStat=await provider.invoke('knowledge.stat',{ref:before[0].id});
  const storageBeforeStop=treeBytes(dataRoot);
  await provider.stop();
  const result={
    benchmark:'palace-scoped-heldout-v1',node:process.version,platform:process.platform,sourceRecords,targetRequests:corpus.length,distractors:sourceRecords-corpus.length-1,
    method:'Fixed natural-language troubleshooting requests, separate expected IDs, 3 project scopes, no generation and no answer labels in provider inputs.',
    quality:{top1:top1/corpus.length,hitAt3:hit3/corpus.length,precisionAt3:relevantReturned/(3*corpus.length),precisionAmongReturnedAtMost3:relevantReturned/Math.max(1,totalReturned),
      noAnswerAbstention:negativeResults.filter(x=>x.returned===0).length/noAnswerRequests.length,
      scopeLeaks,staleErrors,budgetErrors,staleStatus:staleStat.status},
    efficiency:{indexMs,ingestRounds,created,searchSamples:latencies.length,p50Ms:percentile(latencies,.5),p95Ms:percentile(latencies,.95),
      previewMeanBytes:responses.reduce((n,r)=>n+r.bytes,0)/responses.length,
      rawProjectMeanBytes:Object.values(rawBytes).reduce((a,b)=>a+b,0)/projects.length,
      storageBeforeStopBytes:storageBeforeStop,storageCheckpointedBytes:treeBytes(dataRoot),modelCalls:0},
    cases:responses,noAnswerCases:negativeResults,
    heldout:{method:'Six additional paraphrases fixed after implementation; results do not tune the implementation.',
      top1:heldoutCases.filter(c=>c.top1).length/heldoutCases.length,hitAt3:heldoutCases.filter(c=>c.hit3).length/heldoutCases.length,cases:heldoutCases},
    limits:['Fixture relevance measurement is not downstream task success.','Bytes are measured, not model tokens.',
      'Initial 12-case fixture became a regression set after it exposed common-word noise; separate paraphrases remain held out.','No semantic embedding/model retrieval is claimed.','Latency excludes connector and network overhead.','Managed state is measured; external source bytes are excluded.']
  };
  console.log('PALACE_BENCHMARK '+JSON.stringify(result));
  if(process.env.MCP_V12_PALACE_BENCHMARK_OUTPUT)writeFileSync(process.env.MCP_V12_PALACE_BENCHMARK_OUTPUT,JSON.stringify(result,null,2)+'\n');
  assert.equal(scopeLeaks,0);assert.equal(staleErrors,0);assert.equal(budgetErrors,0);assert.equal(staleStat.status,'stale');
});
