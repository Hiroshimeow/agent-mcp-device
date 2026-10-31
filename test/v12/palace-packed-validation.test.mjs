import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const packageRoot=path.resolve(process.env.MCP_V12_VALIDATION_PACKAGE_ROOT??'.');
const load=relative=>import(pathToFileURL(path.join(packageRoot,'dist/plugins/palace',relative)).href);
async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'palace-validation-behavior-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));
  return root;
}

test('packed adapter rejects unconfigured or malformed trusted validation modules',async t=>{
  const root=await fixture(t),{createPlugin}=await load('plugin.js');
  const context={deviceId:'validation-contract',dataRoot:path.join(root,'data'),sourceRoots:[],projectRoots:[],settings:{autoIndex:false,discoverKnownSources:false,autoActivateSkills:true}};
  await assert.rejects(createPlugin(context),/TRUSTED_VALIDATION_MODULE_REQUIRED/);
  await assert.rejects(createPlugin({...context,settings:{...context.settings,validationModule:'relative-validator.mjs'}}),/TRUSTED_VALIDATION_MODULE_REQUIRED/);
  const module=path.join(root,'invalid.mjs');await fs.writeFile(module,'export const unrelated=true;\n');
  await assert.rejects(createPlugin({...context,settings:{...context.settings,validationModule:module}}),/VALIDATION_FACTORY_REQUIRED/);
  await fs.writeFile(path.join(root,'invalid-runner.mjs'),'export const createValidationRunner=()=>42;\n');
  await assert.rejects(createPlugin({...context,settings:{...context.settings,validationModule:path.join(root,'invalid-runner.mjs')}}),/VALIDATION_RUNNER_REQUIRED/);
});

test('packed adapter only activates through configured execution and independent postcondition',async t=>{
  const root=await fixture(t),logs=path.join(root,'logs'),output=path.join(root,'postcondition.txt'),module=path.join(root,'validator.mjs');await fs.mkdir(logs);
  await fs.writeFile(path.join(logs,'a.log'),'Error PACKED_VALIDATION_MARKER: preserve independently checked output.\n');
  await fs.writeFile(module,`import {spawnSync} from 'node:child_process';import fs from 'node:fs';export const createValidationRunner=()=>async()=>{const output=${JSON.stringify(output)};const run=spawnSync(process.execPath,['-e','require("node:fs").writeFileSync(process.argv[1],"verified")',output],{encoding:'utf8'});return {executionId:'packed-execution',exitCode:run.status,postconditionPassed:fs.readFileSync(output,'utf8')==='verified',output:'independently checked',validatorVersion:'packed-contract/1'};};\n`);
  const {createPlugin}=await load('plugin.js'),plugin=await createPlugin({deviceId:'packed-validator',dataRoot:path.join(root,'data'),sourceRoots:[logs],projectRoots:[],settings:{autoIndex:false,discoverKnownSources:false,autoActivateSkills:true,validationModule:module}});
  await plugin.start();const context={signal:new AbortController().signal};
  try{
    await plugin.invoke('knowledge.ingest',{},context);
    const found=await plugin.invoke('knowledge.search',{query:'PACKED_VALIDATION_MARKER'},context);assert.equal(found.items.length,1);
    const learned=await plugin.invoke('knowledge.learn',{summary:'Packed validation boundary',steps:['Execute the independently checked fixture'],evidenceRefs:[found.items[0].id]},context);
    assert.equal(learned.activated,true);assert.equal(learned.card.status,'validated');assert.equal(await fs.readFile(output,'utf8'),'verified');
  }finally{await plugin.stop();}
});

test('provider candidate catalogue excludes withdrawn procedures after correction',async t=>{
  const root=await fixture(t),logs=path.join(root,'logs');await fs.mkdir(logs);
  await fs.writeFile(path.join(logs,'a.log'),'Error WITHDRAWAL_MARKER: previous remedy must be withdrawn after correction.\n');
  const {createPalaceProvider}=await load('index.js');
  const provider=createPalaceProvider({deviceId:'withdrawal-contract',dataRoot:path.join(root,'data'),sourceRoots:[logs],projectRoots:[],autoIndex:false,discoverKnownSources:false});
  await provider.start();t.after(()=>provider.stop());await provider.invoke('knowledge.ingest',{});
  const source=(await provider.invoke('knowledge.search',{query:'WITHDRAWAL_MARKER'})).items[0];assert.ok(source);
  const learned=await provider.invoke('knowledge.learn',{summary:'Withdrawable candidate',steps:['Use the prior remedy'],evidenceRefs:[source.id],autoActivate:false});
  assert.equal((await provider.invoke('knowledge.skills',{includeCandidates:true})).items.length,1);
  const corrected=await provider.invoke('knowledge.correct',{id:source.id,body:'The prior remedy is contradicted.',reason:'Independent negative case'});assert.ok(corrected.invalidated.includes(learned.card.id));
  try{
    const candidates=await provider.invoke('knowledge.skills',{includeCandidates:true});
    assert.equal(candidates.items.some(item=>item.id===learned.card.id),false,'withdrawn procedures must not appear in the candidate catalogue');
    assert.equal((await provider.invoke('knowledge.read',{id:learned.card.id})).card.status,'withdrawn','historical exact read remains auditable');
  }finally{await provider.stop();}
});
