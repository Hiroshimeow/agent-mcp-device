import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const root=fileURLToPath(new URL('../../',import.meta.url));
const installer=path.join(root,'scripts/v12/install-palace-skill.cjs');

test('installer auto-registers Palace Skill without clobbering user-owned skill and is idempotent',async t=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'palace-installer-'));
  t.after(async()=>fs.rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:50}));
  const custom=path.join(home,'.pi','agent','skills','palace-cli');
  await fs.mkdir(custom,{recursive:true});
  await fs.writeFile(path.join(custom,'SKILL.md'),'# Keep my custom skill\n');
  const env={...process.env,MCP_DEVICE_INSTALL_SKILLS_FORCE:'1',MCP_DEVICE_SKILL_HOME:home};
  const run=()=> {
    const result=spawnSync(process.execPath,[installer],{cwd:root,env,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(result.stdout.trim());
  };
  const first=run();
  assert.equal(first.ok,true);
  assert.equal(first.result.find(x=>x.target===custom).state,'preserved-existing');
  assert.equal(await fs.readFile(path.join(custom,'SKILL.md'),'utf8'),'# Keep my custom skill\n');
  const installed=path.join(home,'.agents','skills','palace-cli');
  assert.match(await fs.readFile(path.join(installed,'SKILL.md'),'utf8'),/^---/);
  const again=run();
  assert.equal(again.ok,true);
  assert.equal(again.result.find(x=>x.target===installed).state,'already-installed');
  const disabled=spawnSync(process.execPath,[installer],{cwd:root,env:{...env,MCP_DEVICE_SKIP_SKILL_INSTALL:'1'},encoding:'utf8'});
  assert.deepEqual(JSON.parse(disabled.stdout.trim()),{ok:true,skipped:'disabled'});
});

test('standalone Palace package runs without MCP Device dependency and reads disposable evidence',async t=>{
  const built=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/v12/build-palace-package.mjs')],{cwd:root,encoding:'utf8'}));
  assert.equal(built.ok,true);
  const manifest=JSON.parse(await fs.readFile(path.join(built.output,'package.json'),'utf8'));
  assert.equal(manifest.name,'@hcu-lab.me/palace');
  assert.deepEqual(manifest.dependencies,{});
  assert.equal(manifest.bin.palace,'dist/plugins/palace/cli.js');
  const mod=await import(pathToFileURL(path.join(built.output,'dist/plugins/palace/plugin.js')).href);
  assert.equal(typeof mod.createPlugin,'function');
  const cli=path.join(built.output,manifest.bin.palace);
  const help=spawnSync(process.execPath,[cli,'--help'],{cwd:built.output,encoding:'utf8'});
  assert.equal(help.status,0,help.stderr);
  assert.match(help.stdout,/status\|search/);
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'palace-standalone-'));
  t.after(async()=>fs.rm(data,{recursive:true,force:true,maxRetries:5,retryDelay:50}));
  const db=new DatabaseSync(path.join(data,'palace.sqlite'));
  db.exec('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE cards(id TEXT PRIMARY KEY,kind TEXT,status TEXT,visibility TEXT,project_id TEXT,json TEXT);CREATE TABLE evidence(id TEXT);CREATE TABLE versions(id TEXT);CREATE VIRTUAL TABLE card_fts USING fts5(id UNINDEXED,summary,body)');
  db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('schema','1');
  const card={
    id:'candidate1',version:1,summary:'Gateway reconnect after broker restart',
    body:'Reconnect preserves enrolled device identity',status:'hypothesis',
    kind:'procedure',scope:{visibility:'account'},evidence:[{id:'e1'}],
    derivedFrom:[],provenance:[],contentHash:'not-trustworthy-fixture',
    originDeviceId:'fixture',servingDeviceId:'fixture',updatedAt:Date.now(),lastVerifiedAt:null
  };
  db.prepare('INSERT INTO cards(id,kind,status,visibility,project_id,json) VALUES(?,?,?,?,?,?)').run(card.id,'procedure','hypothesis','account',null,JSON.stringify(card));
  db.prepare('INSERT INTO card_fts(id,summary,body) VALUES(?,?,?)').run(card.id,card.summary,card.body);
  db.prepare('INSERT INTO evidence(id) VALUES(?)').run('e1');
  db.prepare('INSERT INTO versions(id) VALUES(?)').run('candidate1');
  db.close();
  const status=spawnSync(process.execPath,[cli,'--data-root',data,'status'],{encoding:'utf8'});
  assert.equal(status.status,0,status.stderr);
  assert.equal(JSON.parse(status.stdout).totals.cards,1);
  const search=spawnSync(process.execPath,[cli,'--data-root',data,'search','gateway reconnect','--limit','1'],{encoding:'utf8'});
  assert.equal(search.status,0,search.stderr);
  assert.equal(JSON.parse(search.stdout).returned,1);
  const skills=spawnSync(process.execPath,[cli,'--data-root',data,'skills'],{encoding:'utf8'});
  assert.equal(JSON.parse(skills.stdout).returned,0);
  const candidates=spawnSync(process.execPath,[cli,'--data-root',data,'skills','--include-candidates'],{encoding:'utf8'});
  assert.equal(JSON.parse(candidates.stdout).returned,1);
});
