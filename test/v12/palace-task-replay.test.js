import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createPalaceProvider } from '../../dist/plugins/palace/index.js';

test('deterministic executable task replay compares no-Palace retries with a validated reusable procedure',async t=>{
  const root=mkdtempSync(join(tmpdir(),'mcp-v12-palace-replay-')),logs=join(root,'logs');
  mkdirSync(logs);
  const executable=join(root,'settlement.cjs'),ledger=join(root,'ledger.json');
  writeFileSync(executable,[
    "const fs=require('node:fs');",
    "const [ledger,key,timeout]=process.argv.slice(2);",
    "if(Number(timeout)<250){console.log(JSON.stringify({ok:false,error:'SQLITE_BUSY',operation:'settlement',retryable:true}));process.exit(75);}",
    "const entries=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):{};",
    "entries[key]=entries[key]||{chargeCount:1,key};",
    "fs.writeFileSync(ledger,JSON.stringify(entries));",
    "console.log(JSON.stringify({ok:true,key,chargeCount:entries[key].chargeCount}));"
  ].join('\n'));
  const execute=(key,timeout)=>{
    const result=spawnSync(process.execPath,[executable,ledger,key,String(timeout)],{encoding:'utf8',timeout:5000});
    const state=existsSync(ledger)?JSON.parse(readFileSync(ledger,'utf8')):{};
    return {exitCode:result.status??99,stdout:result.stdout,stderr:result.stderr,
      postcondition:result.status===0&&state[key]?.chargeCount===1&&state[key]?.key===key};
  };
  // Prior source claims are separate from held-out task IDs. A trusted runner must execute
  // the proposed recipe and inspect the resulting state before it becomes an active Skill.
  const observationA='Error SQLITE_BUSY during settlement. Fix: Set busyTimeoutMs = 250 and preserve the original idempotency key before retry.';
  const observationB='Resolved: independent reconnect trace completed settlement with busyTimeoutMs = 250 while the original idempotency key was reused; duplicate charge count stayed at one.';
  const contradictory='Rejected workaround: busyTimeoutMs = 0 repeated SQLITE_BUSY and did not complete the settlement.';
  writeFileSync(join(logs,'prior-a.log'),observationA+'\n');
  writeFileSync(join(logs,'prior-b.log'),observationB+'\n');
  writeFileSync(join(logs,'contradictory.log'),contradictory+'\n');
  assert.equal(execute('negative-zero-timeout',0).postcondition,false);
  let validationCalls=0;
  const provider=createPalaceProvider({deviceId:'replay',dataRoot:join(root,'state'),sourceRoots:[logs],autoIndex:true,
    validationRunner:async card=>{
      validationCalls++;
      const timeout=Number(card.body.match(/busyTimeoutMs\s*=\s*(\d+)/)?.[1]??0);
      const result=execute('training-validation-'+validationCalls,timeout);
      return {executionId:'replay-validation-'+validationCalls,exitCode:result.exitCode,postconditionPassed:result.postcondition,
        output:result.stdout+result.stderr,validatorVersion:'settlement-fixture/1'};
    }});
  t.after(async()=>{await provider.stop();rmSync(root,{recursive:true,force:true});});
  await provider.start();
  await provider.invoke('knowledge.ingest',{maxFiles:8,maxRecords:64,maxBytes:1024*1024});
  // Ingestion may propose a hypothesis candidate, but raw log text never reaches the execution
  // validator or becomes an active Skill automatically.
  const candidates=await provider.invoke('knowledge.skills',{includeCandidates:true});
  assert.equal(validationCalls,0,'ingest must never execute the validation runner implicitly');
  const observations=await provider.invoke('knowledge.list',{limit:32,maxBytes:16384});
  const procedureIds=new Set(candidates.items.map(item=>item.id));
  const evidence=observations.items.filter(item=>!procedureIds.has(item.id)&&item.summary.includes('250')&&!item.summary.includes('Rejected'));
  assert.ok(evidence.length>=2,'validated procedure requires at least two independent positive source traces');
  const promoted=await provider.invoke('knowledge.learn',{key:'explicit-settlement-retry',summary:'Validated settlement retry procedure',
    steps:['Set busyTimeoutMs = 250 and preserve the original idempotency key before retry.'],evidenceRefs:evidence.slice(0,2).map(item=>item.id)});
  assert.equal(promoted.activated,true);assert.equal(validationCalls,1);
  const active=await provider.invoke('knowledge.skills',{});
  assert.equal(active.items.length,1);
  const tasks=['held-out-a','held-out-b','held-out-c'];
  const baseline={taskSuccess:0,repeatedErrors:0,executionCalls:0,retrievalCalls:0,agentVisibleBytes:0,elapsedMs:0};
  let began=performance.now();
  for(const task of tasks){
    let previousError=false;
    // Fixed baseline policy: retry default once, then use its diagnostic fallback.
    for(const timeout of [0,0,250]){
      const result=execute('baseline-'+task,timeout);baseline.executionCalls++;
      baseline.agentVisibleBytes+=Buffer.byteLength(result.stdout+result.stderr);
      if(result.exitCode!==0){if(previousError)baseline.repeatedErrors++;previousError=true;}
      if(result.postcondition){baseline.taskSuccess++;break;}
    }
  }
  baseline.elapsedMs=performance.now()-began;
  const palace={taskSuccess:0,repeatedErrors:0,executionCalls:0,retrievalCalls:0,agentVisibleBytes:0,elapsedMs:0};
  began=performance.now();
  const found=await provider.invoke('knowledge.search',{query:'retry idempotency',limit:3,maxBytes:4096});palace.retrievalCalls++;
  palace.agentVisibleBytes+=Buffer.byteLength(JSON.stringify(found));
  const selected=found.items.find(item=>item.status==='validated');assert.ok(selected);
  const read=await provider.invoke('knowledge.skills',{action:'read',ref:selected.id,maxBytes:8192});palace.retrievalCalls++;
  palace.agentVisibleBytes+=Buffer.byteLength(JSON.stringify(read));
  const remembered=Number(read.body.match(/busyTimeoutMs\s*=\s*(\d+)/)?.[1]??0);
  for(const task of tasks){
    const result=execute('palace-'+task,remembered);palace.executionCalls++;
    palace.agentVisibleBytes+=Buffer.byteLength(result.stdout+result.stderr);
    if(result.postcondition)palace.taskSuccess++;
  }
  palace.elapsedMs=performance.now()-began;
  const result={benchmark:'palace-executable-replay-v1',node:process.version,tasks:tasks.length,validationCalls,
    taskPrompt:'Complete each new settlement after a reconnect while preserving its supplied idempotency key.',
    baseline,palace,
    limits:['Deterministic fixture policies; no LLM productivity or general task-success claim.',
      'Baseline retries once before its fixed diagnostic fallback; Palace reuses one selected validated recipe across three new task IDs.',
      'All tasks execute a real child process and inspect ledger postconditions.',
      'Agent-visible bytes include retrieval metadata/evidence and may increase despite fewer repeated errors.',
      'Training/validation cost is reported separately and is not hidden in the replay improvement.']};
  console.log('PALACE_TASK_REPLAY '+JSON.stringify(result));
  if(process.env.MCP_V12_PALACE_REPLAY_OUTPUT)writeFileSync(process.env.MCP_V12_PALACE_REPLAY_OUTPUT,JSON.stringify(result,null,2)+'\n');
  assert.equal(baseline.taskSuccess,3);assert.equal(palace.taskSuccess,3);
  assert.equal(baseline.repeatedErrors,3);assert.equal(palace.repeatedErrors,0);
  assert.equal(palace.executionCalls,3);
});
