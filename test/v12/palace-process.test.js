import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPluginDriver } from '../../dist/platform/plugin-driver.js';
import { createPalaceProvider } from '../../dist/plugins/palace/index.js';

test('expected Palace domain miss preserves process availability for ingest and selected import',async t=>{
  const root=mkdtempSync(join(tmpdir(),'mcp-v12-palace-process-'));
  const logs=join(root,'logs'),dataRoot=join(root,'A');mkdirSync(logs);mkdirSync(dataRoot);
  const faults=[];
  const manifest={id:'palace',version:'1.0.12',dataSchemaVersion:1,isolation:'process',timeoutMs:10000,
    entry:fileURLToPath(new URL('../../dist/plugins/palace/plugin.js',import.meta.url)),
    capabilities:['knowledge.read','knowledge.ingest','knowledge.import','knowledge.search'].map(name=>({name,version:'1.0.0'}))};
  const driver=createPluginDriver(manifest,{deviceId:'A',dataRoot,sourceRoots:[logs],projectRoots:[],
    settings:{autoIndex:false,discoverKnownSources:false}},error=>faults.push(error));
  const origin=createPalaceProvider({deviceId:'B',dataRoot:join(root,'B'),sourceRoots:[logs],autoIndex:false});
  t.after(async()=>{await driver.stop();await origin.stop();rmSync(root,{recursive:true,force:true});});
  await driver.start();
  await assert.rejects(driver.invoke('knowledge.read',{ref:'missing'}),error=>error.code==='KNOWLEDGE_NOT_FOUND');
  writeFileSync(join(logs,'events.log'),'Error PROCESS_IMPORT: retain the original source identity.\n');
  await driver.invoke('knowledge.ingest',{});
  assert.equal((await driver.invoke('knowledge.search',{query:'PROCESS_IMPORT'})).items.length,1);
  await origin.start();await origin.invoke('knowledge.ingest',{});
  const reference=(await origin.invoke('knowledge.search',{query:'PROCESS_IMPORT'})).items[0];
  const original=(await origin.invoke('knowledge.read',{ref:reference.id})).card;
  await driver.invoke('knowledge.import',{card:original});
  const copied=(await driver.invoke('knowledge.read',{ref:original.id})).card;
  assert.equal(copied.originDeviceId,'B');assert.equal(copied.servingDeviceId,'A');
  assert.equal(copied.contentHash,original.contentHash);assert.equal(faults.length,0);
});
