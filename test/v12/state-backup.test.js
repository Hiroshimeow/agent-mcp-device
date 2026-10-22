import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { acquireServerLease } from '../../dist/platform/runtime-lease.js';
import {
  planStateBackup,createStateBackup,verifyStateBackup,restoreStateBackup,planLegacyMigration,applyLegacyMigration
} from '../../dist/platform/state-backup.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'mcp-v12-backup-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const state=join(root,'source');mkdirSync(state);
  return {root,state};
}
function file(root,name,value){
  const target=join(root,name);mkdirSync(join(target,'..'),{recursive:true});
  writeFileSync(target,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value));return target;
}
function deviceState(root){
  file(root,'gateway-identity.json',{deviceId:'retained-device',privateKey:'fixture-key'});
  file(root,'gateway-config.json',{gatewayUrl:'http://127.0.0.1:8104',fixture:true});
  file(root,'knowledge-reference.key','fixture-routing-reference-key');
  file(root,'plugins/registry.json',{version:1,revision:3,plugins:{palace:{enabled:true}}});
  file(root,'plugins/palace/data/evidence/receipt.json',{source:'managed',postcondition:true});
  file(root,'plugins/demo/data/opaque.bin',Buffer.from([0,1,2,255]));
  mkdirSync(join(root,'plugins','empty-data'),{recursive:true});
}
function gatewayState(root){
  mkdirSync(root,{recursive:true});
  const db=new DatabaseSync(join(root,'gateway.sqlite'));
  db.exec("CREATE TABLE accounts(id TEXT PRIMARY KEY);INSERT INTO accounts VALUES('fixture-account');"+
    "CREATE TABLE invites(token TEXT);INSERT INTO invites VALUES('fixture-invite');"+
    "CREATE TABLE oauth_clients(id TEXT);INSERT INTO oauth_clients VALUES('fixture-client');"+
    "CREATE TABLE oauth_refresh_tokens(token TEXT);INSERT INTO oauth_refresh_tokens VALUES('fixture-refresh');"+
    "CREATE TABLE device_pairings(device_id TEXT);INSERT INTO device_pairings VALUES('retained-device');");
  db.close();file(root,'mcp-calls.ndjson','{"fixture":"audit"}\n');
}
test('plan is read-only; complete stopped backup restores identity, accounts, OAuth, plugin state and managed evidence',async t=>{
  const f=fixture(t);deviceState(f.state);gatewayState(f.state);
  const backupRoot=join(f.root,'backup'),targetRoot=join(f.root,'restored');
  const before=hash(readFileSync(join(f.state,'gateway.sqlite')));
  const plan=await planStateBackup({sourceRoot:f.state,backupRoot});
  assert.equal(plan.dryRun,true);assert.equal(existsSync(backupRoot),false);
  assert.ok(plan.files.some(x=>x.path==='plugins/palace/data/evidence/receipt.json'));
  const created=await createStateBackup({sourceRoot:f.state,backupRoot});
  const verified=await verifyStateBackup({backupRoot});assert.equal(verified.valid,true);
  assert.equal(created.manifest.sourceDigest,plan.sourceDigest);
  assert.equal(existsSync(join(f.state,'server-runtime.lock')),false);
  const restored=await restoreStateBackup({backupRoot,targetRoot});
  assert.equal(restored.sourceDigest,plan.sourceDigest);
  assert.equal(hash(readFileSync(join(targetRoot,'gateway.sqlite'))),before);
  assert.equal(hash(readFileSync(join(f.state,'gateway.sqlite'))),before);
  assert.equal(JSON.parse(readFileSync(join(targetRoot,'gateway-identity.json'),'utf8')).deviceId,'retained-device');
  assert.deepEqual(readFileSync(join(targetRoot,'plugins/demo/data/opaque.bin')),readFileSync(join(f.state,'plugins/demo/data/opaque.bin')));
  assert.equal(existsSync(join(targetRoot,'plugins','empty-data')),true);
  const db=new DatabaseSync(join(targetRoot,'gateway.sqlite'),{readOnly:true});
  try{for(const table of ['accounts','invites','oauth_clients','oauth_refresh_tokens','device_pairings'])
    assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,1);}finally{db.close();}
  await assert.rejects(restoreStateBackup({backupRoot,targetRoot}),/MUST_NOT_EXIST/);
  writeFileSync(join(targetRoot,'gateway-identity.json'),'changed target');
  const rollback=join(f.root,'rollback');
  await restoreStateBackup({backupRoot,targetRoot:rollback});
  assert.equal(JSON.parse(readFileSync(join(rollback,'gateway-identity.json'),'utf8')).deviceId,'retained-device');
  assert.equal(readFileSync(join(targetRoot,'gateway-identity.json'),'utf8'),'changed target');
});
test('active runtime lease, unproven Device IPC owner and active plugin registry block snapshots',async t=>{
  const f=fixture(t);deviceState(f.state);
  const release=await acquireServerLease(f.state);
  try{
    await assert.rejects(planStateBackup({sourceRoot:f.state,backupRoot:join(f.root,'busy-plan')}));
    await assert.rejects(createStateBackup({sourceRoot:f.state,backupRoot:join(f.root,'busy-backup')}));
  }finally{await release();}
  file(f.state,'runtime-control.json',{endpoint:'fixture-unreachable',nonce:'fixture-only'});
  await assert.rejects(planStateBackup({sourceRoot:f.state,backupRoot:join(f.root,'ipc')}),/STOP_NOT_PROVEN/);
  rmSync(join(f.state,'runtime-control.json'));
  file(f.state,'plugins/registry.lock',{pid:process.pid});
  await assert.rejects(createStateBackup({sourceRoot:f.state,backupRoot:join(f.root,'registry')}),/REGISTRY_BUSY/);
  assert.equal(existsSync(join(f.state,'server-runtime.lock')),false);
});
test('nested runtime and registry coordination markers block ancestor backups even with stale PIDs',async t=>{
  const f=fixture(t);deviceState(f.state);
  const backupRoot=join(f.root,'nested-backup');
  for(const marker of ['server/server-runtime.lock','server/runtime-control.json','server/plugins/registry.lock']){
    file(f.state,marker,{pid:99999999,fixture:'stale-or-active-owner-is-not-proven-stopped'});
    await assert.rejects(planStateBackup({sourceRoot:f.state,backupRoot}),/NESTED_RUNTIME_REQUIRES_SEPARATE_STOPPED_BACKUP/);
    await assert.rejects(createStateBackup({sourceRoot:f.state,backupRoot}),/NESTED_RUNTIME_REQUIRES_SEPARATE_STOPPED_BACKUP/);
    assert.equal(existsSync(backupRoot),false);
    assert.equal(existsSync(join(f.state,'server-runtime.lock')),false);
    rmSync(join(f.state,marker));
  }
  file(f.state,'server/gateway.sqlite','fully stopped nested state fixture');
  const plan=await planStateBackup({sourceRoot:f.state,backupRoot});
  assert.ok(plan.files.some(file=>file.path==='server/gateway.sqlite'));
  const saved=await createStateBackup({sourceRoot:f.state,backupRoot});
  assert.ok(saved.manifest.files.some(file=>file.path==='server/gateway.sqlite'));
  assert.equal((await verifyStateBackup({backupRoot})).valid,true);
});
test('nonempty SQLite WAL requires a stopped checkpoint and never produces a partial successful backup',async t=>{
  const f=fixture(t),db=new DatabaseSync(join(f.state,'gateway.sqlite'));
  try{
    db.exec("PRAGMA journal_mode=WAL;CREATE TABLE entries(value TEXT);INSERT INTO entries VALUES('fixture')");
    await assert.rejects(createStateBackup({sourceRoot:f.state,backupRoot:join(f.root,'wal')}),/CHECKPOINT_REQUIRED/);
    assert.equal(existsSync(join(f.root,'wal')),false);
    assert.equal(existsSync(join(f.state,'server-runtime.lock')),false);
  }finally{db.close();}
  await createStateBackup({sourceRoot:f.state,backupRoot:join(f.root,'checkpointed')});
});
test('changed payload, traversal manifest, symlink source and symlink destination cannot escape restore root',async t=>{
  const f=fixture(t);deviceState(f.state);const backupRoot=join(f.root,'backup');
  await createStateBackup({sourceRoot:f.state,backupRoot});
  const payload=join(backupRoot,'data','gateway-identity.json'),saved=readFileSync(payload);
  writeFileSync(payload,'tampered');
  await assert.rejects(verifyStateBackup({backupRoot}),/HASH_MISMATCH/);
  await assert.rejects(restoreStateBackup({backupRoot,targetRoot:join(f.root,'bad-restore')}),/HASH_MISMATCH/);
  assert.equal(existsSync(join(f.root,'bad-restore')),false);writeFileSync(payload,saved);
  const manifestPath=join(backupRoot,'manifest.json'),manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  manifest.files[0].path='../escape';
  const {manifestHash,...body}=manifest;manifest.manifestHash=hash(JSON.stringify(body));writeFileSync(manifestPath,JSON.stringify(manifest));
  await assert.rejects(restoreStateBackup({backupRoot,targetRoot:join(f.root,'traversal')}),/UNSAFE_BACKUP_PATH/);
  assert.equal(existsSync(join(f.root,'escape')),false);
  const outside=join(f.root,'outside');mkdirSync(outside);file(outside,'untouched','outside data');
  symlinkSync(outside,join(f.state,'linked'),'junction');
  await assert.rejects(planStateBackup({sourceRoot:f.state,backupRoot:join(f.root,'symlink')}),/SYMLINK/);
  symlinkSync(outside,join(f.root,'alias'),'junction');
  await assert.rejects(restoreStateBackup({backupRoot,targetRoot:join(f.root,'alias','restore')}),/SYMLINK/);
  assert.equal(readFileSync(join(outside,'untouched'),'utf8'),'outside data');
});
test('legacy migration defaults to dry-run, backs up both sources, maps complete state, and retains rollback copies',async t=>{
  const f=fixture(t);deviceState(f.state);const gatewayRoot=join(f.root,'legacy-gateway');gatewayState(gatewayRoot);
  const options={deviceRoot:f.state,gatewayRoot,targetRoot:join(f.root,'unified'),backupRoot:join(f.root,'migration-backup')};
  const plan=await planLegacyMigration(options);assert.equal(plan.dryRun,true);
  assert.equal(existsSync(options.targetRoot),false);assert.equal(existsSync(options.backupRoot),false);
  assert.ok(plan.mappings.some(x=>x.source==='gateway'&&x.path==='gateway.sqlite'&&x.targetPath==='gateway.sqlite'));
  const applied=await applyLegacyMigration({plan});
  assert.equal(applied.files,plan.mappings.length);
  assert.equal((await verifyStateBackup({backupRoot:applied.rollback.deviceBackup})).valid,true);
  assert.equal((await verifyStateBackup({backupRoot:applied.rollback.gatewayBackup})).valid,true);
  assert.equal(readFileSync(join(options.targetRoot,'knowledge-reference.key'),'utf8'),'fixture-routing-reference-key');
  assert.equal(hash(readFileSync(join(options.targetRoot,'gateway.sqlite'))),hash(readFileSync(join(gatewayRoot,'gateway.sqlite'))));
  const recovered=join(f.root,'prior-device');
  await restoreStateBackup({backupRoot:applied.rollback.deviceBackup,targetRoot:recovered});
  assert.equal(hash(readFileSync(join(recovered,'gateway-identity.json'))),hash(readFileSync(join(f.state,'gateway-identity.json'))));
  assert.equal(existsSync(join(f.state,'server-runtime.lock')),false);
  assert.equal(existsSync(join(gatewayRoot,'server-runtime.lock')),false);
});
test('legacy collisions, changed source after planning and edited plans fail before target creation',async t=>{
  const f=fixture(t);deviceState(f.state);const gatewayRoot=join(f.root,'legacy-gateway');gatewayState(gatewayRoot);
  const options={deviceRoot:f.state,gatewayRoot,targetRoot:join(f.root,'unified'),backupRoot:join(f.root,'migration-backup')};
  file(gatewayRoot,'gateway-identity.json',{deviceId:'different'});
  await assert.rejects(planLegacyMigration(options),/PATH_COLLISION/);rmSync(join(gatewayRoot,'gateway-identity.json'));
  const plan=await planLegacyMigration(options);
  await assert.rejects(applyLegacyMigration({plan:{...plan,targetRoot:join(f.root,'edited')}}),/PLAN_HASH/);
  file(f.state,'new-file','changed after planning');
  await assert.rejects(applyLegacyMigration({plan}),/PLAN_STALE/);
  assert.equal(existsSync(options.targetRoot),false);assert.equal(existsSync(options.backupRoot),false);
  await assert.rejects(planStateBackup({sourceRoot:f.state,backupRoot:join(f.state,'nested')}),/ROOTS_OVERLAP/);
});
