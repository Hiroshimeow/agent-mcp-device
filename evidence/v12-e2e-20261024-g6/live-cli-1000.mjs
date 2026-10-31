import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';

const [deviceRootArg,palaceRootArg,workArg,receiptArg]=process.argv.slice(2);
const deviceRoot=path.resolve(deviceRootArg),palaceRoot=path.resolve(palaceRootArg),work=path.resolve(workArg);
if(fs.existsSync(work))throw new Error('LIVE_TEST_DESTINATION_EXISTS');
fs.mkdirSync(work,{recursive:true});
const state=path.join(work,'state'),logs=path.join(work,'logs');
fs.mkdirSync(logs);
const source=path.join(logs,'events.log');
fs.writeFileSync(source,'Error LIVE_SEED_MARKER: retain enrolled identity and original evidence.\n');
const {PluginHost}=await import(pathToFileURL(path.join(deviceRoot,'dist/platform/plugin-host.js')).href);
const {bundledPluginManifests}=await import(pathToFileURL(path.join(deviceRoot,'dist/distribution.js')).href);
const {acquireServerLease}=await import(pathToFileURL(path.join(deviceRoot,'dist/platform/runtime-lease.js')).href);
const manifest={...bundledPluginManifests().find(x=>x.id==='palace'),entry:path.join(palaceRoot,'dist/plugins/palace/plugin.js')};
const host=new PluginHost({stateRoot:state,deviceId:'live-cli-fixture',sourceRoots:[logs],projectRoots:[]});
const cli=path.join(palaceRoot,'dist/plugins/palace/cli.js');
const report={schemaVersion:1,startedAt:new Date().toISOString(),host:os.hostname(),platform:process.platform,node:process.version,deviceRoot,palaceRoot,work,fixtureKind:'synthetic operational fixture, not learning or productivity evidence',plannedReads:1000,concurrency:4,indexIntervalMs:1000,appendIntervalMs:500,writerMode:'generic PluginHost isolated process',samples:[],errors:[]};
const stream=fs.createWriteStream(path.join(work,'cli-raw.jsonl'),{flags:'wx'});
let release,timer,appends=0,appendError,appendTail=Promise.resolve(),maxParentRss=0,seedId,next=0;
const started=performance.now();
function invokeCli(args,seq){
  return new Promise(resolve=>{
    const start=performance.now(),at=new Date().toISOString();
    const child=spawn(process.execPath,[cli,'--runtime-dir',state,...args,'--max-bytes','8192'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let stdout='',stderr='',spawnError;
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',x=>{stdout+=x;if(Buffer.byteLength(stdout)>131072)child.kill();});
    child.stderr.on('data',x=>{stderr+=x;if(Buffer.byteLength(stderr)>131072)child.kill();});
    child.on('error',e=>{spawnError=e.message;});
    const timeout=setTimeout(()=>child.kill(),15000);
    child.on('close',(exitCode,signal)=>{
      clearTimeout(timeout);
      const sample={seq,command:args[0],startedAt:at,elapsedMs:performance.now()-start,exitCode,signal,stdoutBytes:Buffer.byteLength(stdout),stderrBytes:Buffer.byteLength(stderr),error:spawnError};
      stream.write(JSON.stringify({...sample,stdout,stderr})+'\n');
      try{
        assert.equal(exitCode,0,stderr||spawnError);
        assert.ok(sample.stdoutBytes<=8192);
        const result=JSON.parse(stdout);assert.equal(result.ok,true);assert.equal(result.mode,'read-only');
        if(args[0]==='search')assert.equal(result.items[0]?.id,seedId);
        if(args[0]==='read'){assert.equal(result.card.id,seedId);assert.equal(result.evidenceVerifiedNow,false);}
        if(args[0]==='skills')assert.equal(result.returned,0);
      }catch(error){sample.error=error.message;report.errors.push({seq,message:error.message});}
      report.samples.push(sample);maxParentRss=Math.max(maxParentRss,process.memoryUsage().rss);resolve();
    });
  });
}
try{
  release=await acquireServerLease(state);
  await host.install(manifest,{enabled:true,settings:{autoIndex:true,discoverKnownSources:false,indexBudget:{maxRecords:16,maxFiles:8,maxBytes:65536,intervalMs:1000}}});
  await host.start();
  assert.equal(host.list().filter(x=>x.state==='enabled').length,1);
  const found=await host.invoke('knowledge.search',{query:'LIVE_SEED_MARKER',limit:1});
  assert.equal(found.items.length,1);seedId=found.items[0].id;
  await assert.rejects(acquireServerLease(state));report.secondLeaseDenied=true;
  timer=setInterval(()=>{const n=++appends;appendTail=appendTail.then(()=>fs.promises.appendFile(source,'Error LIVE_TICK_'+n+': bounded independent indexing sample.\n')).catch(error=>{appendError=error.message;});},500);
  await Promise.all(Array.from({length:4},async()=>{
    while(next<1000){
      const seq=next++,args=seq%4===0?['status']:seq%4===1?['search','LIVE_SEED_MARKER','--limit','1']:seq%4===2?['read',seedId]:['skills'];
      await invokeCli(args,seq);
      if(report.samples.length%100===0)fs.writeFileSync(path.join(work,'progress.json'),JSON.stringify({completed:report.samples.length,errors:report.errors.length,appends,elapsedMs:performance.now()-started})+'\n');
    }
  }));
  clearInterval(timer);timer=undefined;await appendTail;
  if(appendError)throw new Error(appendError);
  await host.invoke('knowledge.ingest',{});
  assert.equal(report.samples.length,1000);assert.equal(report.errors.length,0);assert.ok(appends>0);
  assert.equal(host.list().find(x=>x.manifest.id==='palace').state,'enabled');
  assert.equal(fs.existsSync(path.join(state,'server-runtime.lock')),true);report.leaseHeldThroughout=true;
  await host.close();await release();release=undefined;
  const db=new DatabaseSync(path.join(state,'plugins/palace/data/palace.sqlite'),{readOnly:true});
  report.integrity=db.prepare('PRAGMA integrity_check').get();
  report.finalCards=db.prepare('SELECT count(*) AS n FROM cards').get().n;
  db.close();
  assert.deepEqual(Object.values(report.integrity),['ok']);assert.ok(report.finalCards>1);
  report.status='PASS';
}catch(error){report.status='FAIL';report.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally{
  if(timer)clearInterval(timer);await appendTail;
  try{await host.close();if(release)await release();}catch(error){report.cleanupError=error.message;report.status='FAIL';process.exitCode=1;}
  await new Promise(resolve=>stream.end(resolve));
  report.endedAt=new Date().toISOString();report.elapsedMs=performance.now()-started;report.appendedRecords=appends;report.maxHarnessRssBytes=maxParentRss;
  const times=report.samples.map(x=>x.elapsedMs).sort((a,b)=>a-b);
  const q=p=>times[Math.max(0,Math.ceil(times.length*p)-1)]??null;
  report.latencyMs={p50:q(.5),p95:q(.95),p99:q(.99)};
  report.rawOutput=path.join(work,'cli-raw.jsonl');
  fs.writeFileSync(receiptArg,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:report.status,reads:report.samples.length,errors:report.errors.length,appends,latencyMs:report.latencyMs,elapsedMs:report.elapsedMs,integrity:report.integrity,failure:report.failure,receipt:receiptArg}));
}
