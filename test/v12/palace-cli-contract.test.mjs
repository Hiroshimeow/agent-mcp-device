import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createPalaceProvider } from '../../dist/plugins/palace/index.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const cli=path.join(root,'dist/plugins/palace/cli.js');

async function fixture(t) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'palace-cli-contract-'));
  const logs=path.join(dir,'logs'),dataRoot=path.join(dir,'data');
  await fs.mkdir(logs);
  await fs.writeFile(path.join(logs,'events.log'),'Error CLI_BUDGET_MARKER: '+('preserve identity and original evidence. '.repeat(12))+'\n');
  const provider=createPalaceProvider({dataRoot,deviceId:'cli-contract-fixture',sourceRoots:[logs],discoverKnownSources:false,autoIndex:false});
  await provider.start();
  t.after(async()=>{await provider.stop();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});});
  await provider.invoke('knowledge.ingest',{});
  const found=await provider.invoke('knowledge.search',{query:'CLI_BUDGET_MARKER'});
  assert.equal(found.items.length,1);
  const run=(args)=>spawnSync(process.execPath,[cli,'--data-root',dataRoot,...args],{cwd:root,encoding:'utf8',timeout:10000});
  return {run,provider,id:found.items[0].id};
}

// The break is successful stdout exceeding the caller's byte budget after JSON indentation.
for(const command of ['search','read']) {
  test('CLI '+command+' bounds the actual UTF-8 stdout including its newline',async t=>{
    const f=await fixture(t),args=command==='search'?['search','CLI_BUDGET_MARKER']:['read',f.id];
    const full=f.run([...args,'--max-bytes','65536']);
    assert.equal(full.status,0,full.stderr);
    const budget=Math.max(512,Buffer.byteLength(JSON.stringify(JSON.parse(full.stdout)),'utf8')+1);
    assert.ok(budget<=65536);
    const bounded=f.run([...args,'--max-bytes',String(budget)]);
    if(bounded.status===0) {
      assert.ok(Buffer.byteLength(bounded.stdout,'utf8')<=budget,
        'successful stdout must fit --max-bytes: '+Buffer.byteLength(bounded.stdout)+' > '+budget);
      assert.deepEqual(JSON.parse(bounded.stdout),JSON.parse(full.stdout));
    } else {
      assert.equal(bounded.stdout,'');
      assert.match(bounded.stderr,/"code":"BUDGET_TOO_SMALL"/);
    }
  });
}

// The break is treating a query with no lexical terms as a request to list every card.
test('punctuation-only CLI search abstains like the canonical provider',async t=>{
  const f=await fixture(t);
  const canonical=await f.provider.invoke('knowledge.search',{query:'!!!'});
  assert.equal(canonical.items.length,0);
  const result=f.run(['search','!!!']);
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).returned,0);
  assert.deepEqual(JSON.parse(result.stdout).items,[]);
});

test('CLI live read leaves the writer in control and explicitly disclaims fresh evidence verification',async t=>{
  const f=await fixture(t);
  const result=f.run(['read',f.id]);
  assert.equal(result.status,0,result.stderr);
  const selected=JSON.parse(result.stdout);
  assert.equal(selected.evidenceVerifiedNow,false);
  assert.equal(selected.mode,'read-only');
  await f.provider.invoke('knowledge.ingest',{});
  const after=await f.provider.invoke('knowledge.read',{ref:f.id,evidence:true});
  assert.equal(after.card.id,f.id);
  assert.equal(after.evidence[0].verifiedBytes,true);
});
