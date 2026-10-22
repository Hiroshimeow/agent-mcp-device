import {
  closeSync, constants, copyFileSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync,
  openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, writeFileSync, chmodSync
} from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { acquireServerLease } from './runtime-lease.js';
import { probeRuntimeOwner } from '../device/runtime-owner.js';

const EXCLUDED=['server-runtime.lock','plugins/registry.lock'];
const MAX_FILES=100000,MAX_BYTES=32*1024*1024*1024;
export interface StateFile { path:string;bytes:number;sha256:string;mode:number; }
interface Inventory {files:StateFile[];directories:string[];totalBytes:number;sourceDigest:string;}
export interface StateBackupPlan extends Inventory {
  schemaVersion:1;kind:'mcp-device-state-backup-plan';sourceRoot:string;backupRoot:string;dryRun:true;excluded:string[];
}
export interface StateBackupManifest extends Inventory {
  schemaVersion:1;kind:'mcp-device-state-backup';createdAt:string;sourceRoot:string;excluded:string[];manifestHash:string;
}
export interface LegacyMigrationPlan {
  schemaVersion:1;kind:'mcp-device-legacy-migration-plan';dryRun:boolean;deviceRoot:string;gatewayRoot:string;
  backupRoot:string;targetRoot:string;device:Inventory;gateway:Inventory;
  mappings:Array<{source:'device'|'gateway';path:string;targetPath:string}>;planHash:string;
}
function digest(value:unknown):string {return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function fail(message:string):never {throw new Error(message);}
function relativePath(value:string):string {
  if(typeof value!=='string'||!value||value.includes('\\')||value.includes(':')||value.includes('\0')||
    path.posix.isAbsolute(value)||path.win32.isAbsolute(value)||value.split('/').some(x=>!x||x==='.'||x==='..'))
    fail('UNSAFE_BACKUP_PATH');
  return value;
}
function noSymlinkAncestors(input:string):string {
  const absolute=path.resolve(input),parsed=path.parse(absolute);let current=parsed.root;
  for(const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)){
    current=path.join(current,segment);
    try{if(lstatSync(current).isSymbolicLink())fail('SYMLINK_STATE_PATH');}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')break;throw error;}
  }
  return absolute;
}
function sourceRoot(input:string):string {
  const root=noSymlinkAncestors(input);
  if(root===path.parse(root).root||!existsSync(root)||!lstatSync(root).isDirectory())fail('STATE_SOURCE_DIRECTORY_REQUIRED');
  return root;
}
function absentTarget(input:string):string {
  const target=noSymlinkAncestors(input);
  if(target===path.parse(target).root||existsSync(target))fail('STATE_TARGET_MUST_NOT_EXIST');
  return target;
}
function contained(a:string,b:string):boolean {const r=path.relative(a,b);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));}
function separate(...roots:string[]):void {
  for(let i=0;i<roots.length;i++)for(let j=i+1;j<roots.length;j++)
    if(contained(roots[i],roots[j])||contained(roots[j],roots[i]))fail('STATE_ROOTS_OVERLAP');
}
async function assertStopped(root:string,ownedLease=false):Promise<void> {
  const owner=await probeRuntimeOwner({root,identity:path.join(root,'gateway-identity.json'),config:path.join(root,'gateway-config.json'),
    status:path.join(root,'gateway-status.json'),runtime:path.join(root,'runtime'),update:path.join(root,'update')});
  if(owner)fail('DEVICE_RUNTIME_ACTIVE');
  if(existsSync(path.join(root,'runtime-control.json')))fail('DEVICE_RUNTIME_STOP_NOT_PROVEN');
  const registry=path.join(root,'plugins','registry.lock');
  if(existsSync(registry))fail('PLUGIN_REGISTRY_BUSY');
  const lease=path.join(root,'server-runtime.lock');
  if(!ownedLease&&existsSync(lease)){
    let pid:number;
    try{pid=JSON.parse(readFileSync(lease,'utf8')).pid;}catch{fail('STATE_RUNTIME_LEASE_UNREADABLE');}
    if(!Number.isSafeInteger(pid!)||pid!<=0)fail('STATE_RUNTIME_LEASE_UNREADABLE');
    try{process.kill(pid!,0);fail('STATE_RUNTIME_ACTIVE');}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}
  }
}
function fileRecord(root:string,relative:string):StateFile {
  relativePath(relative);const full=path.join(root,...relative.split('/'));
  noSymlinkAncestors(full);
  const before=lstatSync(full);if(!before.isFile()||before.isSymbolicLink())fail('NONREGULAR_STATE_FILE');
  if(before.size>MAX_BYTES)fail('STATE_BACKUP_TOO_LARGE');
  const fd=openSync(full,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  const hasher=createHash('sha256'),buffer=Buffer.allocUnsafe(64*1024);let offset=0;
  try{
    if(!fstatSync(fd).isFile())fail('NONREGULAR_STATE_FILE');
    for(;;){const size=readSync(fd,buffer,0,buffer.length,offset);if(!size)break;hasher.update(buffer.subarray(0,size));offset+=size;}
    const after=fstatSync(fd);
    if(offset!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ino!==before.ino)fail('STATE_CHANGED_DURING_BACKUP');
  }finally{closeSync(fd);}
  return {path:relative,bytes:offset,sha256:hasher.digest('hex'),mode:before.mode&0o777};
}
function inventory(root:string,options:{excludeLocks?:boolean;rejectWal?:boolean}={}):Inventory {
  const files:StateFile[]=[],directories:string[]=[];let totalBytes=0;
  const names=new Set<string>();
  const visit=(directory:string,prefix='')=>{
    for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const rel=relativePath(prefix?prefix+'/'+entry.name:entry.name);
      if(options.excludeLocks!==false&&EXCLUDED.includes(rel))continue;
      // An ancestor lease does not stop a nested Device/server or its plugin writer.
      if(options.excludeLocks!==false&&rel.includes('/')&&
        (['server-runtime.lock','runtime-control.json'].includes(entry.name)||rel.endsWith('/plugins/registry.lock')))
        fail('NESTED_RUNTIME_REQUIRES_SEPARATE_STOPPED_BACKUP');
      const key=rel.toLocaleLowerCase('en-US');if(names.has(key))fail('CASE_COLLIDING_STATE_PATH');names.add(key);
      const full=path.join(directory,entry.name),stat=lstatSync(full);
      if(stat.isSymbolicLink())fail('SYMLINK_STATE_PATH');
      if(stat.isDirectory()){directories.push(rel);visit(full,rel);continue;}
      if(!stat.isFile())fail('NONREGULAR_STATE_FILE');
      if(options.rejectWal!==false&&/(?:-wal|-journal)$/i.test(rel)&&stat.size>0)fail('SQLITE_CHECKPOINT_REQUIRED');
      if(files.length>=MAX_FILES)fail('STATE_FILE_LIMIT');
      const file=fileRecord(root,rel);files.push(file);totalBytes+=file.bytes;
      if(totalBytes>MAX_BYTES)fail('STATE_BACKUP_TOO_LARGE');
    }
  };
  visit(root);files.sort((a,b)=>a.path.localeCompare(b.path));directories.sort();
  return {files,directories,totalBytes,sourceDigest:digest({files:files.map(({mode,...file})=>file),directories,totalBytes})};
}
function flushFile(file:string):void {
  const mode=lstatSync(file).mode&0o777;chmodSync(file,mode|0o600);
  const fd=openSync(file,'r+');try{fsyncSync(fd);}finally{closeSync(fd);chmodSync(file,mode);}
}
function writeJson(file:string,value:unknown):void {writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});flushFile(file);}
function copyInventory(from:string,to:string,items:Inventory):void {
  mkdirSync(to,{recursive:false,mode:0o700});
  for(const directory of items.directories)mkdirSync(path.join(to,...relativePath(directory).split('/')),{recursive:true,mode:0o700});
  for(const file of items.files){
    const destination=path.join(to,...relativePath(file.path).split('/'));mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
    copyFileSync(path.join(from,...file.path.split('/')),destination,constants.COPYFILE_EXCL);
    chmodSync(destination,file.mode);flushFile(destination);
    if(fileRecord(to,file.path).sha256!==file.sha256)fail('STATE_CHANGED_DURING_BACKUP');
  }
}
function stageFor(target:string):string {
  mkdirSync(path.dirname(target),{recursive:true,mode:0o700});noSymlinkAncestors(path.dirname(target));
  const stage=path.join(path.dirname(target),'.'+path.basename(target)+'.'+randomUUID()+'.staging');
  mkdirSync(stage,{mode:0o700});return stage;
}
function publish(stage:string,target:string):void {absentTarget(target);renameSync(stage,target);}
async function destinationGuard<T>(target:string,operation:()=>Promise<T>):Promise<T> {
  mkdirSync(path.dirname(target),{recursive:true,mode:0o700});noSymlinkAncestors(path.dirname(target));
  const guard=path.join(path.dirname(target),'.'+path.basename(target)+'.state-operation.lock');
  let fd:number;
  try{fd=openSync(guard,'wx',0o600);}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')fail('STATE_OPERATION_BUSY');throw error;}
  try{writeFileSync(fd,JSON.stringify({pid:process.pid,token:randomUUID()}));return await operation();}
  finally{closeSync(fd);rmSync(guard,{force:true});}
}
function manifestFor(root:string,items:Inventory):StateBackupManifest {
  const base={schemaVersion:1 as const,kind:'mcp-device-state-backup' as const,createdAt:new Date().toISOString(),
    sourceRoot:root,...items,excluded:[...EXCLUDED]};
  return {...base,manifestHash:digest(base)};
}
function writeBundle(root:string,destination:string,items:Inventory):StateBackupManifest {
  mkdirSync(destination,{mode:0o700});
  copyInventory(root,path.join(destination,'data'),items);
  const manifest=manifestFor(root,items);writeJson(path.join(destination,'manifest.json'),manifest);
  return manifest;
}
function verifyBundle(root:string):StateBackupManifest {
  sourceRoot(root);const manifestPath=path.join(root,'manifest.json');noSymlinkAncestors(manifestPath);
  if(lstatSync(manifestPath).size>32*1024*1024)fail('BACKUP_MANIFEST_TOO_LARGE');
  const parsed=JSON.parse(readFileSync(manifestPath,'utf8')) as StateBackupManifest;
  if(parsed.schemaVersion!==1||parsed.kind!=='mcp-device-state-backup'||!Array.isArray(parsed.files)||
    !Array.isArray(parsed.directories)||parsed.files.length>MAX_FILES)fail('INVALID_BACKUP_MANIFEST');
  const {manifestHash,...body}=parsed;if(digest(body)!==manifestHash)fail('BACKUP_MANIFEST_HASH_MISMATCH');
  for(const file of parsed.files){
    relativePath(file.path);
    if(!Number.isSafeInteger(file.bytes)||file.bytes<0||!Number.isSafeInteger(file.mode)||file.mode<0||file.mode>0o777||
      !/^[a-f0-9]{64}$/.test(file.sha256))fail('INVALID_BACKUP_MANIFEST');
  }
  for(const directory of parsed.directories)relativePath(directory);
  const data=sourceRoot(path.join(root,'data')),actual=inventory(data,{excludeLocks:false,rejectWal:false});
  if(actual.sourceDigest!==parsed.sourceDigest||actual.totalBytes!==parsed.totalBytes||
    digest(actual.files.map(({mode,...file})=>file))!==digest(parsed.files.map(({mode,...file})=>file))||digest(actual.directories)!==digest(parsed.directories))fail('BACKUP_CONTENT_HASH_MISMATCH');
  const extras=readdirSync(root).filter(name=>!['data','manifest.json'].includes(name));
  if(extras.length)fail('UNMANIFESTED_BACKUP_FILE');
  return parsed;
}

export async function planStateBackup(options:{sourceRoot:string;backupRoot:string}):Promise<StateBackupPlan> {
  const root=sourceRoot(options.sourceRoot),backupRoot=absentTarget(options.backupRoot);separate(root,backupRoot);await assertStopped(root);
  return {schemaVersion:1,kind:'mcp-device-state-backup-plan',sourceRoot:root,backupRoot,dryRun:true,excluded:[...EXCLUDED],...inventory(root)};
}
export async function createStateBackup(options:{sourceRoot:string;backupRoot:string}):Promise<{backupRoot:string;manifest:StateBackupManifest}> {
  const root=sourceRoot(options.sourceRoot),backupRoot=absentTarget(options.backupRoot);separate(root,backupRoot);
  return destinationGuard(backupRoot,async()=>{
    const release=await acquireServerLease(root);let stage:string|undefined;
    try{
      await assertStopped(root,true);const items=inventory(root);stage=stageFor(backupRoot);
      const bundle=path.join(stage,'bundle');const manifest=writeBundle(root,bundle,items);
      await assertStopped(root,true);if(inventory(root).sourceDigest!==items.sourceDigest)fail('STATE_CHANGED_DURING_BACKUP');
      verifyBundle(bundle);publish(bundle,backupRoot);return {backupRoot,manifest};
    }finally{if(stage)rmSync(stage,{recursive:true,force:true});await release();}
  });
}
export async function verifyStateBackup(options:{backupRoot:string}):Promise<{valid:true;backupRoot:string;manifest:StateBackupManifest}> {
  const backupRoot=sourceRoot(options.backupRoot);return {valid:true,backupRoot,manifest:verifyBundle(backupRoot)};
}
export async function restoreStateBackup(options:{backupRoot:string;targetRoot:string}):Promise<{targetRoot:string;files:number;bytes:number;sourceDigest:string}> {
  const backupRoot=sourceRoot(options.backupRoot),targetRoot=absentTarget(options.targetRoot);separate(backupRoot,targetRoot);
  return destinationGuard(targetRoot,async()=>{
    const manifest=verifyBundle(backupRoot);const stage=stageFor(targetRoot),restored=path.join(stage,'state');
    try{
      copyInventory(path.join(backupRoot,'data'),restored,manifest);
      if(inventory(restored,{excludeLocks:false,rejectWal:false}).sourceDigest!==manifest.sourceDigest)fail('RESTORE_HASH_MISMATCH');
      verifyBundle(backupRoot);publish(restored,targetRoot);
      return {targetRoot,files:manifest.files.length,bytes:manifest.totalBytes,sourceDigest:manifest.sourceDigest};
    }finally{rmSync(stage,{recursive:true,force:true});}
  });
}
function collisionCheck(device:Inventory,gateway:Inventory):void {
  const files=new Set(device.files.map(f=>f.path.toLowerCase())),dirs=new Set(device.directories.map(d=>d.toLowerCase()));
  for(const file of gateway.files)if(files.has(file.path.toLowerCase())||dirs.has(file.path.toLowerCase()))fail('MIGRATION_PATH_COLLISION:'+file.path);
  for(const directory of gateway.directories)if(files.has(directory.toLowerCase()))fail('MIGRATION_PATH_COLLISION:'+directory);
}
export async function planLegacyMigration(options:{deviceRoot:string;gatewayRoot:string;targetRoot:string;backupRoot:string;dryRun?:boolean}):Promise<LegacyMigrationPlan> {
  const deviceRoot=sourceRoot(options.deviceRoot),gatewayRoot=sourceRoot(options.gatewayRoot),
    targetRoot=absentTarget(options.targetRoot),backupRoot=absentTarget(options.backupRoot);
  separate(deviceRoot,gatewayRoot,targetRoot,backupRoot);await assertStopped(deviceRoot);await assertStopped(gatewayRoot);
  const device=inventory(deviceRoot),gateway=inventory(gatewayRoot);collisionCheck(device,gateway);
  if(!gateway.files.some(file=>file.path==='gateway.sqlite'))fail('LEGACY_GATEWAY_DATABASE_REQUIRED');
  const mappings:LegacyMigrationPlan['mappings']=[
    ...device.files.map(file=>({source:'device' as const,path:file.path,targetPath:file.path})),
    ...gateway.files.map(file=>({source:'gateway' as const,path:file.path,targetPath:file.path}))
  ];
  const base={schemaVersion:1 as const,kind:'mcp-device-legacy-migration-plan' as const,dryRun:options.dryRun!==false,
    deviceRoot,gatewayRoot,targetRoot,backupRoot,device,gateway,mappings};
  return {...base,planHash:digest(base)};
}
export async function applyLegacyMigration(options:{plan:LegacyMigrationPlan}):Promise<{
  targetRoot:string;backupRoot:string;files:number;sourceDigest:string;rollback:{deviceBackup:string;gatewayBackup:string}
}> {
  const plan=options.plan,{planHash,...body}=plan;
  if(plan.schemaVersion!==1||plan.kind!=='mcp-device-legacy-migration-plan'||digest(body)!==planHash)fail('MIGRATION_PLAN_HASH_MISMATCH');
  const fresh=await planLegacyMigration(plan);
  if(fresh.planHash!==plan.planHash)fail('MIGRATION_PLAN_STALE');
  return destinationGuard(plan.targetRoot,async()=>destinationGuard(plan.backupRoot,async()=>{
    const releases:Array<()=>Promise<void>>=[];let backupStage:string|undefined,targetStage:string|undefined;
    try{
      for(const root of [plan.deviceRoot,plan.gatewayRoot].sort())releases.push(await acquireServerLease(root));
      await assertStopped(plan.deviceRoot,true);await assertStopped(plan.gatewayRoot,true);
      const device=inventory(plan.deviceRoot),gateway=inventory(plan.gatewayRoot);collisionCheck(device,gateway);
      if(device.sourceDigest!==plan.device.sourceDigest||gateway.sourceDigest!==plan.gateway.sourceDigest)fail('MIGRATION_PLAN_STALE');
      backupStage=stageFor(plan.backupRoot);
      const bundle=path.join(backupStage,'backup');mkdirSync(bundle,{mode:0o700});
      writeBundle(plan.deviceRoot,path.join(bundle,'device'),device);writeBundle(plan.gatewayRoot,path.join(bundle,'gateway'),gateway);
      writeJson(path.join(bundle,'migration-plan.json'),plan);
      verifyBundle(path.join(bundle,'device'));verifyBundle(path.join(bundle,'gateway'));
      if(inventory(plan.deviceRoot).sourceDigest!==device.sourceDigest||inventory(plan.gatewayRoot).sourceDigest!==gateway.sourceDigest)fail('MIGRATION_PLAN_STALE');
      publish(bundle,plan.backupRoot);
      targetStage=stageFor(plan.targetRoot);const target=path.join(targetStage,'state');
      const combined:Inventory={files:[...device.files,...gateway.files].sort((a,b)=>a.path.localeCompare(b.path)),
        directories:[...new Set([...device.directories,...gateway.directories])].sort(),
        totalBytes:device.totalBytes+gateway.totalBytes,sourceDigest:''};
      combined.sourceDigest=digest({files:combined.files.map(({mode,...file})=>file),directories:combined.directories,totalBytes:combined.totalBytes});
      mkdirSync(target,{mode:0o700});
      for(const directory of combined.directories)mkdirSync(path.join(target,...directory.split('/')),{recursive:true,mode:0o700});
      for(const [name,items] of [['device',device],['gateway',gateway]] as const)for(const file of items.files){
        const destination=path.join(target,...file.path.split('/'));mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
        copyFileSync(path.join(plan.backupRoot,name,'data',...file.path.split('/')),destination,constants.COPYFILE_EXCL);
        chmodSync(destination,file.mode);flushFile(destination);
      }
      if(inventory(target,{excludeLocks:false,rejectWal:false}).sourceDigest!==combined.sourceDigest)fail('MIGRATION_RESTORE_HASH_MISMATCH');
      publish(target,plan.targetRoot);
      return {targetRoot:plan.targetRoot,backupRoot:plan.backupRoot,files:combined.files.length,sourceDigest:combined.sourceDigest,
        rollback:{deviceBackup:path.join(plan.backupRoot,'device'),gatewayBackup:path.join(plan.backupRoot,'gateway')}};
    }finally{
      if(backupStage)rmSync(backupStage,{recursive:true,force:true});if(targetStage)rmSync(targetStage,{recursive:true,force:true});
      for(const release of releases.reverse())await release();
    }
  }));
}
