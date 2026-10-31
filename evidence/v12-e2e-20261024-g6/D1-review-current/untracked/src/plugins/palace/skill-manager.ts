import fs from 'node:fs/promises';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { processBirth, processNamespace, sameProcessNamespace, type ProcessNamespace } from './process-birth.js';
import { coordinationObservation, coordinationOwnerAbandoned, processAppearsDead, withCoordinationLock, type CoordinationLockBody } from '../../platform/coordination-lock.js';

interface OwnerRecord { packageName:string;version:string;root:string;source:string;files:Record<string,string>;updatedAt:number;missingSince?:number;missingObservations?:number }
interface TargetRecord { selectedOwner:string;version:string;files:Record<string,string>;linkTarget?:string }
interface PendingIntent { id:string;target:string;stage:string;aside:string;selectedOwner:string;version:string;files:Record<string,string>;hadPrior?:boolean;priorFiles?:Record<string,string>;adopted?:boolean }
interface Ledger { version:1;revision:number;owners:Record<string,OwnerRecord>;targets:Record<string,TargetRecord>;pending?:PendingIntent;retained?:Record<string,string>;retainedFiles?:Record<string,Record<string,string>>;removedOwners?:Record<string,true>;offers?:Record<string,string>;optOutPackages?:Record<string,true>;publishFailures?:Record<string,{code:string;message:string;at:number}> }
export interface SkillManagerOptions { home?:string;force?:boolean;removeCurrentOwner?:boolean;removeAll?:boolean;install?:boolean;repair?:boolean;packageRoot?:string;nonBlocking?:boolean;breakLock?:boolean;abandonPending?:boolean;adoptTarget?:'agents'|'pi';forgetOwner?:string;prune?:boolean }
const packageNames=new Set(['@hcu-lab.me/mcp-device','@hcu-lab.me/palace']);
const failure=(code:string,message=code,details:Record<string,unknown>={})=>Object.assign(new Error(message),{code,...details});

const packageRootDefault=fileURLToPath(new URL('../../../',import.meta.url));
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const slash=(value:string)=>value.split(path.sep).join('/');
const exists=async(filename:string)=>{try{await fs.lstat(filename);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}};
function compareVersions(a:string,b:string):number {
  // Follow npm/node-semver compareMain/comparePre precedence, not locale ordering.
  // In particular, release > prerelease, numeric identifiers compare numerically,
  // and build metadata never affects precedence.
  const parse=(value:string)=>{
    const match=value.length<=256&&value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
    if(!match)throw failure('PALACE_SKILL_VERSION_INVALID');
    const pre=match[4]?.split('.')??[];
    if(pre.some(id=>/^\d+$/.test(id)&&id.length>1&&id.startsWith('0')))throw failure('PALACE_SKILL_VERSION_INVALID');
    return {main:match.slice(1,4).map(BigInt),pre};
  };
  const av=parse(a),bv=parse(b);
  for(let i=0;i<3;i++){if(av.main[i]!==bv.main[i])return av.main[i]>bv.main[i]?1:-1;}
  if(!av.pre.length||!bv.pre.length)return av.pre.length?-1:bv.pre.length?1:0;
  for(let i=0;i<Math.max(av.pre.length,bv.pre.length);i++){
    const x=av.pre[i],y=bv.pre[i];if(x===y)continue;
    if(x===undefined)return -1;if(y===undefined)return 1;
    const xn=/^\d+$/.test(x),yn=/^\d+$/.test(y);
    if(xn&&yn)return BigInt(x)>BigInt(y)?1:-1;
    if(xn!==yn)return xn?-1:1;
    return x>y?1:-1;
  }
  return 0;
}
async function fileMap(root:string,options:{ignoreMarker?:boolean}={}):Promise<Record<string,string>> {
  const rootStat=await fs.lstat(root);
  if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw failure('PALACE_SKILL_UNSAFE_TREE');
  const result:Record<string,string>=Object.create(null);let entries=0,bytes=0;
  async function walk(dir:string):Promise<void>{
    if(path.relative(root,dir).split(path.sep).length>32)throw failure('PALACE_SKILL_SCAN_LIMIT');
    const names=(await fs.readdir(dir)).sort();
    // Empty user directories are user content too; the old file-only map discarded them.
    if(dir!==root&&!names.length)result[slash(path.relative(root,dir))+'/']='directory';
    for(const name of names){
      if(options.ignoreMarker&&dir===root&&name==='.mcp-device-palace-owned')continue;
      if(++entries>4096)throw failure('PALACE_SKILL_SCAN_LIMIT');
      const filename=path.join(dir,name),stat=await fs.lstat(filename);
      if(stat.isSymbolicLink())throw Object.assign(new Error('SKILL_SYMLINK_UNSAFE: '+filename),{code:'SKILL_SYMLINK_UNSAFE'});
      if(stat.isDirectory())await walk(filename);
      else if(stat.isFile()){bytes+=stat.size;if(bytes>32*1024*1024)throw failure('PALACE_SKILL_SCAN_LIMIT');result[slash(path.relative(root,filename))]=hash(await fs.readFile(filename));}
      else throw Object.assign(new Error('SKILL_ENTRY_UNSUPPORTED: '+filename),{code:'SKILL_ENTRY_UNSUPPORTED'});
    }
  }
  await walk(root);return result;
}
const sameMap=(a:Record<string,string>,b:Record<string,string>)=>{
  const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();return ak.length===bk.length&&ak.every((key,index)=>key===bk[index]&&a[key]===b[key]);
};
async function readJson<T>(filename:string,fallback:T):Promise<T>{
  try{
    const stat=await fs.stat(filename);if(!stat.isFile()||stat.size>65536)throw failure('PALACE_SKILL_METADATA_LIMIT','Package metadata exceeds the bounded inspection limit.',{path:filename});
    return JSON.parse(await fs.readFile(filename,'utf8')) as T;
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return fallback;throw error;}
}
async function renameManaged(source:string,target:string):Promise<void>{
  for(let attempt=0;;attempt++){
    try{await fs.rename(source,target);return;}
    catch(error){
      if(process.platform!=='win32'||attempt>=7||!['EPERM','EBUSY','EACCES'].includes(String((error as NodeJS.ErrnoException).code)))throw error;
      await sleep(Math.min(200,20*2**attempt));
    }
  }
}
async function writeJsonAtomic(filename:string,value:unknown):Promise<void>{
  const text=JSON.stringify(value,null,2)+'\n';
  if(Buffer.byteLength(text)>2*1024*1024)throw failure('PALACE_SKILL_LEDGER_LIMIT','Ownership history reached its bounded limit. Inspect retained content and use palace skill prune for verified pristine backups before another update.');
  await fs.mkdir(path.dirname(filename),{recursive:true});const temporary=filename+'.'+randomUUID()+'.tmp';
  try{
    const handle=await fs.open(temporary,'wx',0o600);
    try{await handle.writeFile(text);await handle.sync();}finally{await handle.close();}
    await renameManaged(temporary,filename);
    if(process.platform!=='win32'){
      const directory=await fs.open(path.dirname(filename),'r');
      try{await directory.sync();}finally{await directory.close();}
    }
  }finally{await fs.rm(temporary,{force:true});}
}
type LockBody=CoordinationLockBody;
async function lockObservation(filename:string){
  try{return await coordinationObservation(filename);}
  catch(error){
    if(String((error as any).code)==='COORDINATION_PATH_UNSAFE')throw failure('PALACE_SKILL_LOCK_RECOVERY_REQUIRED','Coordination path is not an ordinary file.',{path:filename});
    throw error;
  }
}
const deadProcess=processAppearsDead;
const abandonedProcess=coordinationOwnerAbandoned;
async function withLock<T>(stateDir:string,work:()=>Promise<T>,options:SkillManagerOptions={}):Promise<T>{
  await fs.mkdir(stateDir,{recursive:true,mode:0o700});
  const lockPath=path.join(stateDir,'owners.lock');
  return withCoordinationLock(lockPath,work,{
    nonBlocking:options.nonBlocking,
    breakLock:options.breakLock,
    attempts:200,
    staleMs:5000,
    retainAbandoned:true,
    messagePrefix:'Palace Skill coordination',
    codes:{busy:'PALACE_SKILL_BUSY',active:'PALACE_SKILL_LOCK_ACTIVE',recoveryRequired:'PALACE_SKILL_LOCK_RECOVERY_REQUIRED'}
  });
}
function ownerKey(pkg:string,root:string):string{return hash(pkg+'\0'+path.resolve(root)).slice(0,32);}
function targetKey(target:string):string{return hash(path.resolve(target)).slice(0,24);}
async function safeParents(home:string,filename:string):Promise<void>{
  const relative=path.relative(home,path.dirname(filename));
  if(relative.startsWith('..')||path.isAbsolute(relative))throw failure('PALACE_SKILL_PATH_OUTSIDE_HOME');
  let current=home;
  for(const part of relative.split(path.sep).filter(Boolean)){
    current=path.join(current,part);
    try{const stat=await fs.lstat(current);if(!stat.isDirectory()||stat.isSymbolicLink())throw failure('PALACE_SKILL_UNSAFE_PARENT','Unsafe parent: '+current,{path:current});}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  }
}
async function matchesTree(filename:string,files:Record<string,string>):Promise<boolean>{
  try{return sameMap(await fileMap(filename,{ignoreMarker:true}),files);}catch{return false;}
}
async function retain(ledger:Ledger,filename:string,reason:string,pristineFiles?:Record<string,string>):Promise<void>{
  if(await exists(filename)){
    (ledger.retained??=Object.create(null))[filename]=reason;
    if(pristineFiles){
      try{const all=await fileMap(filename),payload={...all};delete payload['.mcp-device-palace-owned'];if(sameMap(payload,pristineFiles))(ledger.retainedFiles??=Object.create(null))[filename]=all;}
      catch{ /* Unreadable or edited backups remain retained and never auto-prunable. */ }
    }
  }
}
async function discardUnpublishedStage(ledger:Ledger,pending:PendingIntent):Promise<void>{
  if(await exists(pending.stage)){
    if(await matchesTree(pending.stage,pending.files))await fs.rm(pending.stage,{recursive:true,force:false});
    else await retain(ledger,pending.stage,'Unpublished staging was modified; preserved for explicit inspection');
  }
  await fs.rmdir(path.dirname(pending.stage)).catch(()=>{});
}
async function saveLedger(filename:string,ledger:Ledger):Promise<void>{
  const prior=await readJson<Ledger|null>(filename,null);
  if(prior&&JSON.stringify({...prior,revision:0})===JSON.stringify({...ledger,revision:0}))return;
  ledger.revision++;await writeJsonAtomic(filename,ledger);
}
async function recover(ledger:Ledger,ledgerPath:string,home:string,targets:string[]):Promise<void>{
  const pending=ledger.pending;if(!pending)return;
  const stateDir=path.dirname(ledgerPath);
  // An intent is not authority to rename/delete arbitrary paths. Reconstruct its scope.
  if(!/^[a-f0-9-]{36}$/i.test(pending.id)||!targets.includes(pending.target)
    ||pending.stage!==path.join(stateDir,'staging',pending.id,targetKey(pending.target))
    ||pending.aside!==path.join(stateDir,'aside',pending.id,targetKey(pending.target)))throw failure('PALACE_SKILL_RECOVERY_PATH_INVALID');
  for(const filename of [pending.target,pending.stage,pending.aside])await safeParents(home,filename);
  const targetPresent=await exists(pending.target),stagePresent=await exists(pending.stage),asidePresent=await exists(pending.aside);
  if(targetPresent&&await matchesTree(pending.target,pending.files)){
    ledger.targets[pending.target]={selectedOwner:pending.selectedOwner,version:pending.version,files:pending.files};
  }else if(!targetPresent&&stagePresent&&await matchesTree(pending.stage,pending.files)){
    try{await fs.mkdir(path.dirname(pending.target),{recursive:true});await renameManaged(pending.stage,pending.target);}
    catch(error){
      if(asidePresent&&!await exists(pending.target))await renameManaged(pending.aside,pending.target);
      await discardUnpublishedStage(ledger,pending);
      (ledger.publishFailures??={})[pending.target]={code:String((error as any).code??'PALACE_SKILL_PUBLISH_FAILED'),message:'Interrupted publication could not be completed; prior content was preserved.',at:Date.now()};
      delete ledger.pending;await saveLedger(ledgerPath,ledger);return;
    }
    ledger.targets[pending.target]={selectedOwner:pending.selectedOwner,version:pending.version,files:pending.files};
  }else if(!targetPresent&&asidePresent){
    // Incomplete/corrupt staging never becomes visible. Restore the prior complete tree.
    await fs.mkdir(path.dirname(pending.target),{recursive:true});await renameManaged(pending.aside,pending.target);
  }else if(!targetPresent&&pending.hadPrior!==false){throw failure('PALACE_SKILL_RECOVERY_REQUIRED','No verified staged or prior tree remains; inspect and use explicit --abandon-pending only after reconciliation.');}
  // Retain the old tree: an editor may have written to it during an interrupted swap.
  // Recovery must never infer permission to delete user bytes from an old manifest.
  await retain(ledger,pending.aside,'Prior tree retained after interrupted replacement',pending.adopted?undefined:pending.priorFiles);
  await discardUnpublishedStage(ledger,pending);
  delete ledger.pending;await saveLedger(ledgerPath,ledger);
}
type TargetState='absent'|'missing-managed'|'owned-pristine'|'owned-modified'|'legacy-link'|'legacy-pristine'|'legacy-unverified'|'foreign-directory'|'foreign-file'|'foreign-link'|'foreign-dangling-link'|'unsafe-parent';
interface Classification { state:TargetState;linkTarget?:string;reason?:string;changed?:number;added?:number;removed?:number }
async function classify(target:string,record:TargetRecord|undefined,selected:OwnerRecord|undefined):Promise<Classification>{
  let stat;try{stat=await fs.lstat(target);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {state:record?'missing-managed':'absent'};throw error;}
  if(stat.isSymbolicLink()){
    const linked=await fs.readlink(target);
    if(record?.linkTarget===linked)return {state:'legacy-link',linkTarget:linked};
    const dangling=await fs.stat(target).then(()=>false).catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return true;throw error;});
    return {state:dangling?'foreign-dangling-link':'foreign-link',linkTarget:linked};
  }
  if(!stat.isDirectory())return {state:'foreign-file'};
  let legacy=false;
  if(!record){
    try{
      const marker=path.join(target,'.mcp-device-palace-owned'),info=await fs.lstat(marker);
      if(info.isFile()&&!info.isSymbolicLink()&&info.size<=4096){
        const text=(await fs.readFile(marker,'utf8')).trim();legacy=text==='palace-cli';
        if(!legacy){const value=JSON.parse(text);legacy=value?.skill==='palace-cli'&&/^[a-f0-9]{32}$/.test(value.owner)&&typeof value.version==='string';}
      }
    }catch{}
    if(!legacy)return {state:'foreign-directory'};
  }
  let actual:Record<string,string>;
  try{actual=await fileMap(target,{ignoreMarker:true});}
  catch(error){return {state:record?'owned-modified':'legacy-unverified',reason:String((error as any).code??'PALACE_SKILL_SCAN_UNAVAILABLE')};}
  if(record){
    const added=Object.keys(actual).filter(key=>!Object.prototype.hasOwnProperty.call(record.files,key)).length;
    const removed=Object.keys(record.files).filter(key=>!Object.prototype.hasOwnProperty.call(actual,key)).length;
    const changed=Object.keys(actual).filter(key=>Object.prototype.hasOwnProperty.call(record.files,key)&&actual[key]!==record.files[key]).length;
    return {state:added||removed||changed?'owned-modified':'owned-pristine',added,removed,changed};
  }
  return {state:legacy&&selected&&sameMap(actual,selected.files)?'legacy-pristine':'legacy-unverified'};
}
async function stageDesired(stateDir:string,target:string,ownerKeyValue:string,owner:OwnerRecord):Promise<{stage:string;aside:string;id:string}>{
  const id=randomUUID(),base=targetKey(target),stage=path.join(stateDir,'staging',id,base),aside=path.join(stateDir,'aside',id,base);
  try{
    await fs.mkdir(path.dirname(stage),{recursive:true});await fs.cp(owner.source,stage,{recursive:true,force:false,errorOnExist:true});
    if(!await matchesTree(stage,owner.files))throw failure('PALACE_SKILL_SOURCE_CHANGED');
    await fs.writeFile(path.join(stage,'.mcp-device-palace-owned'),JSON.stringify({skill:'palace-cli',owner:ownerKeyValue,version:owner.version})+'\n');
  }catch(error){await fs.rm(stage,{recursive:true,force:true});await fs.rmdir(path.dirname(stage)).catch(()=>{});throw error;}
  return {stage,aside,id};
}
async function assertRenameSupported(stateDir:string,target:string):Promise<void>{
  const id=randomUUID(),from=path.join(stateDir,'.rename-probe-'+id),to=path.join(path.dirname(target),'.palace-rename-probe-'+id);
  let created=false,moved=false;
  try{
    await fs.mkdir(from,{mode:0o700});created=true;
    await fs.rename(from,to);moved=true;
  }catch(error){
    if((error as any).code==='EXDEV')throw failure('PALACE_SKILL_CROSS_DEVICE_UNSUPPORTED','The target mount does not support atomic rename from Skill state. Choose a Skill home with state and targets in one rename domain.',{target});
    throw error;
  }finally{
    // Empty owned probes only. Never recursively remove unexpected user content.
    if(moved)await fs.rmdir(to).catch(()=>{});else if(created)await fs.rmdir(from).catch(()=>{});
  }
}
async function publish(target:string,ownerKeyValue:string,owner:OwnerRecord,ledger:Ledger,ledgerPath:string,stateDir:string,adopt=false):Promise<string|undefined>{
  await fs.mkdir(path.dirname(target),{recursive:true});
  // st_dev alone misses bind mounts. Exercise an empty rename before staging.
  await assertRenameSupported(stateDir,target);
  const before=(await classify(target,ledger.targets[target],owner)).state;
  if(!adopt&&!['absent','missing-managed','owned-pristine','legacy-pristine','legacy-link'].includes(before))throw failure('PALACE_SKILL_CHANGED_DURING_UPDATE');
  const staged=await stageDesired(stateDir,target,ownerKeyValue,owner),hadPrior=await exists(target),priorRecord=ledger.targets[target];
  const priorFiles=!adopt&&before!=='legacy-link'?(priorRecord?.files??owner.files):undefined;
  const pending:PendingIntent={...staged,target,selectedOwner:ownerKeyValue,version:owner.version,files:owner.files,hadPrior,priorFiles,adopted:adopt};
  let published=false;
  try{
    ledger.pending=pending;await saveLedger(ledgerPath,ledger);
    if(hadPrior){
      await fs.mkdir(path.dirname(staged.aside),{recursive:true});await renameManaged(target,staged.aside);
      if(priorFiles&&!await matchesTree(staged.aside,priorFiles))throw failure('PALACE_SKILL_CHANGED_DURING_UPDATE');
    }
    await renameManaged(staged.stage,target);published=true;
    ledger.targets[target]={selectedOwner:ownerKeyValue,version:owner.version,files:owner.files};
    await retain(ledger,staged.aside,adopt?'Explicitly adopted user tree retained losslessly':'Prior Skill tree retained for safe rollback',priorFiles);
    delete ledger.pending;if(ledger.publishFailures)delete ledger.publishFailures[target];await saveLedger(ledgerPath,ledger);
    await fs.rmdir(path.dirname(staged.stage)).catch(()=>{});
    return hadPrior?staged.aside:undefined;
  }catch(error){
    // A fully published tree plus its durable pre-rename intent is recoverable.
    // Do not roll it back blindly if a later ledger flush failed.
    if(published){ledger.pending=pending;throw failure('PALACE_SKILL_RECOVERY_REQUIRED','A complete publication needs ledger reconciliation before another update.',{target,causeCode:String((error as any).code??'UNKNOWN')});}
    try{
      if(await exists(staged.aside)&&!await exists(target))await renameManaged(staged.aside,target);
      await retain(ledger,staged.aside,'Prior content retained because the destination changed during failed publication',priorFiles);
      await discardUnpublishedStage(ledger,pending);
      if(priorRecord)ledger.targets[target]=priorRecord;else delete ledger.targets[target];
      delete ledger.pending;await saveLedger(ledgerPath,ledger);
      await fs.rmdir(path.dirname(staged.aside)).catch(()=>{});
    }catch(rollbackError){ledger.pending=pending;throw failure('PALACE_SKILL_RECOVERY_REQUIRED','Publication failed and rollback requires inspection; all recoverable paths remain in the intent.',{target,causeCode:String((rollbackError as any).code??'UNKNOWN')});}
    throw error;
  }
}
function chooseOwner(owners:Record<string,OwnerRecord>):[string,OwnerRecord]|undefined{
  const ordinal=(a:string,b:string)=>a===b?0:a<b?-1:1;
  return Object.entries(owners).sort(([ak,a],[bk,b])=>compareVersions(b.version,a.version)||ordinal(a.packageName,b.packageName)||ordinal(ak,bk))[0];
}
async function canonicalHome(value:string):Promise<string>{
  const resolved=path.resolve(value);
  try{return await fs.realpath(resolved);}
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    const parent=path.dirname(resolved);if(parent===resolved)throw error;
    return path.join(await canonicalHome(parent),path.basename(resolved));
  }
}
async function context(options:SkillManagerOptions={}){
  const packageRoot=await fs.realpath(path.resolve(options.packageRoot??packageRootDefault));
  const pkg=await readJson<any>(path.join(packageRoot,'package.json'),{});
  if(!packageNames.has(pkg.name)||typeof pkg.version!=='string')throw failure('PALACE_SKILL_PACKAGE_INVALID');
  compareVersions(pkg.version,pkg.version);
  const source=path.join(packageRoot,'skills','palace-cli'),home=await canonicalHome(options.home??process.env.MCP_DEVICE_SKILL_HOME??os.homedir());
  const stateDir=path.join(home,'.mcp-device','palace-skill'),ledgerPath=path.join(stateDir,'owners.json');
  const targets=[path.join(home,'.agents','skills','palace-cli'),path.join(home,'.pi','agent','skills','palace-cli')];
  return {packageRoot,pkg,source,home,stateDir,ledgerPath,targets,key:ownerKey(String(pkg.name??'unknown'),packageRoot)};
}
const emptyLedger=():Ledger=>({version:1,revision:0,owners:{},targets:{}});
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function validateLedger(value:unknown):asserts value is Ledger{
  if(!isRecord(value)||value.version!==1||!Number.isSafeInteger(value.revision)||Number(value.revision)<0||!isRecord(value.owners)||!isRecord(value.targets))throw failure('PALACE_SKILL_LEDGER_CORRUPT');
  const files=(map:unknown)=>{
    if(!isRecord(map))throw failure('PALACE_SKILL_LEDGER_CORRUPT');
    for(const [key,digest] of Object.entries(map))if(!key||path.isAbsolute(key)||key.split(/[\\/]/).includes('..')||typeof digest!=='string'||!(digest==='directory'||/^[a-f0-9]{64}$/.test(digest)))throw failure('PALACE_SKILL_LEDGER_CORRUPT');
  };
  for(const [key,owner] of Object.entries(value.owners)){
    if(!/^[a-f0-9]{32}$/.test(key)||!isRecord(owner)||typeof owner.packageName!=='string'||!packageNames.has(owner.packageName)||typeof owner.root!=='string'||!path.isAbsolute(owner.root)||typeof owner.source!=='string'||path.resolve(owner.source)!==path.join(path.resolve(owner.root),'skills','palace-cli')||typeof owner.version!=='string')throw failure('PALACE_SKILL_LEDGER_CORRUPT');
    try{compareVersions(owner.version,owner.version);}catch{throw failure('PALACE_SKILL_LEDGER_CORRUPT');}files(owner.files);
  }
  for(const [key,target] of Object.entries(value.targets)){
    if(!path.isAbsolute(key)||!isRecord(target)||typeof target.selectedOwner!=='string'||typeof target.version!=='string'||(target.linkTarget!==undefined&&typeof target.linkTarget!=='string'))throw failure('PALACE_SKILL_LEDGER_CORRUPT');
    files(target.files);
  }
  for(const key of ['retained','retainedFiles','removedOwners','offers','optOutPackages','publishFailures'])if(value[key]!==undefined&&!isRecord(value[key]))throw failure('PALACE_SKILL_LEDGER_CORRUPT');
  if(isRecord(value.retainedFiles))for(const map of Object.values(value.retainedFiles))files(map);
  if(value.pending!==undefined){
    const p=value.pending;
    if(!isRecord(p)||['id','target','stage','aside','selectedOwner','version'].some(key=>typeof p[key]!=='string')||(p.hadPrior!==undefined&&typeof p.hadPrior!=='boolean'))throw failure('PALACE_SKILL_LEDGER_CORRUPT');
    files(p.files);if(p.priorFiles!==undefined)files(p.priorFiles);
    if(p.adopted!==undefined&&typeof p.adopted!=='boolean')throw failure('PALACE_SKILL_LEDGER_CORRUPT');
  }
}
async function readLedger(filename:string,options:SkillManagerOptions={}):Promise<Ledger>{
  let parsed:unknown;
  try{
    const stat=await fs.lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)throw failure('PALACE_SKILL_LEDGER_CORRUPT');
    parsed=JSON.parse(await fs.readFile(filename,'utf8'));
    if(isRecord(parsed)&&parsed.version!==1)throw failure('PALACE_SKILL_LEDGER_UNSUPPORTED');
    if(options.abandonPending&&isRecord(parsed)&&parsed.pending!==undefined){
      const backup=filename+'.pending-'+randomUUID();await fs.copyFile(filename,backup,1);
      if(!isRecord(parsed.retained))parsed.retained={};
      const retained=parsed.retained as Record<string,string>,pending=parsed.pending;
      retained[backup]='Operator explicitly abandoned the pending intent; no referenced path was deleted';
      if(isRecord(pending))for(const key of ['stage','aside'])if(typeof pending[key]==='string')retained[pending[key]]='Referenced by the explicitly abandoned intent; inspect before any manual cleanup';
      delete parsed.pending;
    }
    validateLedger(parsed);return parsed;
  }catch(error){
    if((error as NodeJS.ErrnoException).code==='ENOENT')return emptyLedger();
    if((error as any).code==='PALACE_SKILL_LEDGER_UNSUPPORTED')throw error;
    if(!options.abandonPending)throw failure('PALACE_SKILL_LEDGER_CORRUPT','Skill ownership state is invalid; inspect and use palace skill repair --abandon-pending for lossless reset.',{path:filename});
    const backup=filename+'.corrupt-'+Date.now()+'-'+randomUUID();await renameManaged(filename,backup);
    const ledger=emptyLedger();ledger.retained={[backup]:'Invalid ledger retained by explicit operator recovery'};return ledger;
  }
}
const missingOwnerGraceMs=30*60*1000,missingOwnerObservations=3;
interface OwnerProblem { owner:string;code:string;message:string;expired?:boolean }
async function refreshOwners(ledger:Ledger,countObservation=true):Promise<OwnerProblem[]>{
  const refreshed:Record<string,OwnerRecord>={},problems:OwnerProblem[]=[];
  for(const [key,owner] of Object.entries(ledger.owners)){
    if(ledger.optOutPackages?.[owner.packageName])continue;
    try{
      const root=await fs.realpath(owner.root),pkg=await readJson<any>(path.join(root,'package.json'),null);
      if(!pkg)throw Object.assign(new Error('Recorded package is temporarily missing'),{code:'ENOENT'});
      if(pkg.name!==owner.packageName||typeof pkg.version!=='string')throw failure('PALACE_SKILL_OWNER_IDENTITY_CHANGED');
      compareVersions(pkg.version,pkg.version);
      const source=path.join(root,'skills','palace-cli');await fs.access(path.join(source,'SKILL.md'));
      const files=await fileMap(source),nextKey=ownerKey(pkg.name,root);
      refreshed[nextKey]={packageName:pkg.name,version:pkg.version,root,source,files,
        updatedAt:owner.version===pkg.version&&sameMap(owner.files,files)?owner.updatedAt:Date.now()};
    }catch(error){
      const missing=(error as NodeJS.ErrnoException).code==='ENOENT';
      const missingSince=owner.missingSince??Date.now(),observations=(owner.missingObservations??0)+(countObservation?1:0);
      const expired=missing&&observations>=missingOwnerObservations&&Date.now()-missingSince>=missingOwnerGraceMs;
      refreshed[key]=missing?{...owner,missingSince,missingObservations:observations}:owner;
      problems.push({owner:key,code:String((error as any).code??'PALACE_SKILL_OWNER_STALE'),expired,
        message:expired?'Package remained absent for at least three full reconciles and thirty minutes; pristine targets may be retained or supplied by another verified owner.':
        'Keep an existing target bound to this temporarily unavailable owner. Restore its package, or explicitly run palace skill repair --forget-owner '+key+'. Other verified targets may proceed.'});
    }
  }
  ledger.owners=refreshed;return problems;
}
function targetRemediation(state:TargetState,slot:'agents'|'pi'):string|null{
  if(state==='owned-pristine'||state==='legacy-pristine')return null;
  if(state==='unsafe-parent')return 'Correct the agent-home parent layout, or choose MCP_DEVICE_SKILL_HOME.';
  if(state==='absent'||state==='missing-managed')return 'Run palace skill repair, or palace skill install after an opt-out.';
  return 'Inspect the preserved target; explicit palace skill adopt --target '+slot+' retains it before installing the managed copy.';
}
async function inspectTarget(home:string,target:string,record:TargetRecord|undefined,owner:OwnerRecord|undefined):Promise<Classification>{
  try{await safeParents(home,target);return await classify(target,record,owner);}
  catch(error){if(String((error as any).code??(error as Error).message).startsWith('PALACE_SKILL_UNSAFE_PARENT'))return {state:'unsafe-parent',reason:(error as Error).message};throw error;}
}
async function pruneRetained(ledger:Ledger,home:string,stateDir:string):Promise<{pruned:string[];preserved:string[]}>{
  const pruned:string[]=[],preserved:string[]=[];
  for(const [filename,files] of Object.entries(ledger.retainedFiles??{})){
    const relative=path.relative(path.join(stateDir,'aside'),filename),parts=relative.split(path.sep);
    if(parts.length!==2||!/^[a-f0-9-]{36}$/i.test(parts[0])||!/^[a-f0-9]{24}$/.test(parts[1])){preserved.push(filename);continue;}
    try{
      await safeParents(home,filename);
      if(!await exists(filename)){delete ledger.retained?.[filename];delete ledger.retainedFiles?.[filename];continue;}
      if(!sameMap(await fileMap(filename),files)){preserved.push(filename);continue;}
      await fs.rm(filename,{recursive:true,force:false});await fs.rmdir(path.dirname(filename)).catch(()=>{});
      delete ledger.retained?.[filename];delete ledger.retainedFiles?.[filename];pruned.push(filename);
    }catch{preserved.push(filename);}
  }
  return {pruned,preserved};
}
export async function reconcilePalaceSkill(options:SkillManagerOptions={}):Promise<Record<string,unknown>>{
  const c=await context(options),installed=c.packageRoot.split(path.sep).some(part=>part.toLowerCase()==='node_modules');
  let privilegedScope:string|undefined;
  if(process.platform!=='win32'&&process.geteuid?.()===0&&!options.force){
    let homeStat;try{homeStat=await fs.stat(c.home);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(!homeStat||typeof (homeStat as any).uid!=='number'||(homeStat as any).uid!==0)
      return {ok:true,skill:'palace-cli',home:c.home,skipped:'privileged-install',remediation:'Run palace skill install as the agent user; privileged package installation will not create root-owned files in a user home.'};
    privilegedScope='root-only';
  }
  if(process.env.MCP_DEVICE_SKIP_SKILL_INSTALL==='1'&&!options.force)return {ok:true,skipped:'disabled'};
  if(!installed&&!options.force&&process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE!=='1')return {ok:true,skipped:'development-checkout'};
  if(options.adoptTarget!==undefined&&!['agents','pi'].includes(options.adoptTarget))throw failure('PALACE_SKILL_TARGET_INVALID');
  if(options.nonBlocking&&!options.repair&&!options.install&&!options.removeCurrentOwner&&!options.removeAll&&!options.adoptTarget&&!options.prune&&options.forgetOwner===undefined){
    const probe=await palaceSkillProbe(options);
    return {ok:!['repair-required','inspection-required','conflict-preserved','owner-unavailable'].includes(probe.state),skill:'palace-cli',home:c.home,...probe,skipped:probe.state==='busy'?'skipped-busy':probe.state};
  }
  if(!options.removeCurrentOwner&&!options.removeAll&&!options.prune&&options.forgetOwner===undefined)await fs.access(path.join(c.source,'SKILL.md'));
  await safeParents(c.home,c.ledgerPath);
  try{return await withLock(c.stateDir,async()=>{
    const ledger=await readLedger(c.ledgerPath,options);
    if(options.forgetOwner!==undefined){
      if(!/^[a-f0-9]{32}$/.test(options.forgetOwner))throw failure('PALACE_SKILL_OWNER_INVALID');
      if(ledger.pending)throw failure('PALACE_SKILL_RECOVERY_REQUIRED','Resolve the pending transaction before forgetting an owner.');
      const forgotten=ledger.owners[options.forgetOwner];if(!forgotten)throw failure('PALACE_SKILL_OWNER_NOT_FOUND');
      const livePackage=await readJson<any>(path.join(forgotten.root,'package.json'),null).catch(()=>null);
      if(livePackage?.name===forgotten.packageName&&await exists(path.join(forgotten.source,'SKILL.md')))throw failure('PALACE_SKILL_OWNER_STILL_INSTALLED','This package still owns installed Skill assets. Use palace skill remove to opt out; a forgotten live owner would return at the next reconcile.');
      delete ledger.owners[options.forgetOwner];await saveLedger(c.ledgerPath,ledger);
      return {ok:true,skill:'palace-cli',home:c.home,forgottenOwner:options.forgetOwner,skillFilesChanged:false,remediation:'Run palace skill repair to reconcile verified remaining owners.'};
    }
    await recover(ledger,c.ledgerPath,c.home,c.targets);
    if(options.prune){const result=await pruneRetained(ledger,c.home,c.stateDir);await saveLedger(c.ledgerPath,ledger);return {ok:true,skill:'palace-cli',home:c.home,...result,retained:ledger.retained??{}};}
    // Old WIP recorded only a hashed root for opt-out. Do not silently lose that intent.
    if(Object.keys(ledger.removedOwners??{}).length){
      ledger.optOutPackages??={};for(const name of packageNames)ledger.optOutPackages[name]=true;delete ledger.removedOwners;
    }
    if(options.removeAll){ledger.optOutPackages??={};for(const name of packageNames)ledger.optOutPackages[name]=true;}
    else if(options.removeCurrentOwner)(ledger.optOutPackages??={})[c.pkg.name]=true;
    if(options.install&&ledger.optOutPackages)delete ledger.optOutPackages[c.pkg.name];
    let ownerProblems=await refreshOwners(ledger);
    if(!options.removeCurrentOwner&&!options.removeAll&&!ledger.optOutPackages?.[c.pkg.name]){
      const prior=ledger.owners[c.key],files=await fileMap(c.source);
      ledger.owners[c.key]={packageName:c.pkg.name,version:c.pkg.version,root:c.packageRoot,source:c.source,files,
        updatedAt:prior&&prior.version===c.pkg.version&&sameMap(prior.files,files)?prior.updatedAt:Date.now()};
      ownerProblems=ownerProblems.filter(problem=>problem.owner!==c.key);
    }
    await saveLedger(c.ledgerPath,ledger);
    const excluded=new Set(ownerProblems.map(problem=>problem.owner));
    const selected=chooseOwner(Object.fromEntries(Object.entries(ledger.owners).filter(([key])=>!excluded.has(key)))),result:Record<string,unknown>[]=[];
    for(let index=0;index<c.targets.length;index++){
      const target=c.targets[index],slot=index===0?'agents':'pi',record=ledger.targets[target];
      try{
      const inspected=await inspectTarget(c.home,target,record,selected?.[1]),state=inspected.state;
      if(state==='unsafe-parent'){
        result.push({target,state,remediation:targetRemediation(state,slot),reason:inspected.reason});continue;
      }
      const held=record?ownerProblems.find(problem=>problem.owner===record.selectedOwner&&!problem.expired&&problem.code!=='PALACE_SKILL_OWNER_IDENTITY_CHANGED'):undefined;
      const replacement=held&&selected&&ledger.owners[held.owner]?.packageName===selected[1].packageName&&compareVersions(selected[1].version,record!.version)>=0;
      if(held&&!replacement&&state!=='absent'&&state!=='missing-managed'&&!options.removeAll&&options.adoptTarget!==slot){
        result.push({target,state:'owner-unavailable',owner:record!.selectedOwner,code:held.code,remediation:held.message});continue;
      }
      if(!selected&&ownerProblems.some(problem=>!problem.expired&&problem.code!=='PALACE_SKILL_OWNER_IDENTITY_CHANGED')){result.push({target,state:'owner-stale',remediation:'No verified owner remains. Restore a package, or use palace skill repair --forget-owner KEY after inspecting the recorded owner.'});continue;}
      if(!selected){
        if(state==='owned-pristine'||state==='legacy-link'){
          const saved=path.join(c.stateDir,'aside',randomUUID(),targetKey(target));await fs.mkdir(path.dirname(saved),{recursive:true});await renameManaged(target,saved);
          await retain(ledger,saved,'Removed managed Skill retained for recovery',state==='owned-pristine'?record?.files:undefined);delete ledger.targets[target];if(ledger.publishFailures)delete ledger.publishFailures[target];result.push({target,state:'removed',saved});
        }else{
          if(state==='absent'||state==='missing-managed')delete ledger.targets[target];
          result.push({target,state:state==='owned-modified'?'preserved-modified':'preserved-existing',classification:state});
        }
        continue;
      }
      const [selectedKey,owner]=selected;
      if(options.adoptTarget===slot&&state!=='owned-pristine'){
        const saved=await publish(target,selectedKey,owner,ledger,c.ledgerPath,c.stateDir,true);
        result.push({target,state:'adopted',saved,owner:selectedKey,version:owner.version});continue;
      }
      if(state==='missing-managed'&&!options.repair&&!options.install){result.push({target,state,remediation:targetRemediation(state,slot)});continue;}
      if(state==='owned-pristine'&&record?.selectedOwner===selectedKey&&record.version===owner.version&&sameMap(record.files,owner.files)){
        if(ledger.publishFailures)delete ledger.publishFailures[target];
        result.push({target,state:'already-installed',owner:selectedKey,version:owner.version});
      }else if(['absent','missing-managed','owned-pristine','legacy-link','legacy-pristine'].includes(state)){
        await publish(target,selectedKey,owner,ledger,c.ledgerPath,c.stateDir);
        result.push({target,state:state==='absent'?'copied':'updated',owner:selectedKey,version:owner.version});
      }else{
        const offerRoot=path.join(c.stateDir,'pending-new',targetKey(target));
        let pending=ledger.offers?.[target]??path.join(offerRoot,hash(JSON.stringify(owner.files)).slice(0,24));
        const relative=path.relative(offerRoot,pending);
        if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw failure('PALACE_SKILL_OFFER_PATH_INVALID');
        await safeParents(c.home,pending);
        if(await exists(pending)&&!await matchesTree(pending,owner.files)){
          await retain(ledger,pending,'Prior replacement offer retained; it differs from the current package');pending=path.join(offerRoot,randomUUID());
        }
        if(!await exists(pending)){
          try{await fs.mkdir(path.dirname(pending),{recursive:true});await fs.cp(owner.source,pending,{recursive:true,errorOnExist:true,force:false});if(!await matchesTree(pending,owner.files))throw failure('PALACE_SKILL_SOURCE_CHANGED');}
          catch(error){await fs.rm(pending,{recursive:true,force:true});throw error;}
        }
        (ledger.offers??={})[target]=pending;
        result.push({target,state:state==='owned-modified'?'preserved-modified':'preserved-existing',classification:state,pending,remediation:targetRemediation(state,slot),...('changed' in inspected?{changed:inspected.changed,added:inspected.added,removed:inspected.removed}:{})});
      }
      }catch(error){
        if(ledger.pending)throw error; // Do not overwrite another unresolved transaction.
        const code=String((error as any).code??'PALACE_SKILL_PUBLISH_FAILED'),message=String((error as Error).message??error);
        const prior=ledger.publishFailures?.[target];
        if(!prior||prior.code!==code)(ledger.publishFailures??={})[target]={code,message,at:Date.now()};
        result.push({target,state:'publish-failed',code,error:message,remediation:'Correct the reported filesystem condition, then run palace skill repair. The prior target is unchanged or retained.'});
      }
    }
    await saveLedger(c.ledgerPath,ledger);
    return {ok:!result.some(x=>['unsafe-parent','owner-stale','owner-unavailable','publish-failed'].includes(String(x.state))),skill:'palace-cli',home:c.home,selectedOwner:selected?.[0]??null,
      ...(privilegedScope?{privilegedScope,remediation:'Installed for root only. Run palace skill install as the intended non-root agent user for user discovery.'}:{}),
      optedOut:ledger.optOutPackages?.[c.pkg.name]===true,stillProvidedBy:selected?{packageName:selected[1].packageName,version:selected[1].version,root:selected[1].root}:null,
      ownerProblems,retained:ledger.retained??{},owners:Object.entries(ledger.owners).map(([key,value])=>({key,packageName:value.packageName,version:value.version,root:value.root})),result};
  },options);}catch(error){
    if(options.nonBlocking&&(error as any).code==='PALACE_SKILL_BUSY')return {ok:true,skill:'palace-cli',home:c.home,skipped:'skipped-busy'};
    throw error;
  }
}
export interface SkillProbe { state:string;verification:'metadata-only'|'ledger-only';observational:true;remediation:string|null;code?:string;warnings?:{owner:string;code:string}[] }
const probeCache=new Map<string,{expires:number;value:SkillProbe}>();
const cloneProbe=(value:SkillProbe):SkillProbe=>({...value,...(value.warnings?{warnings:value.warnings.map(item=>({...item}))}:{})});

/**
 * Fast, read-only observation for ordinary Palace CLI calls.
 *
 * This deliberately trusts only the bounded ownership ledger and the current
 * package identity. It never acquires lifecycle locks, follows owner roots,
 * hashes Skill trees, publishes files, or claims ownership authority. Full
 * filesystem/owner verification remains the job of `palace skill status`.
 */
export function palaceSkillQuickProbe(
  options:SkillManagerOptions={},
  identity?:{name:string;version:string}
):SkillProbe{
  const result=(state:string,remediation:string|null=null,code?:string):SkillProbe=>({
    state,verification:'ledger-only',observational:true,remediation,...(code?{code}:{})
  });
  try{
    if(process.env.MCP_DEVICE_SKIP_SKILL_INSTALL==='1'&&!options.force)return result('disabled');
    const packageRoot=path.resolve(options.packageRoot??packageRootDefault);
    if(!packageRoot.split(path.sep).some(part=>part.toLowerCase()==='node_modules')&&!options.force&&process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE!=='1')
      return result('development-checkout');
    const home=path.resolve(options.home??process.env.MCP_DEVICE_SKILL_HOME??os.homedir());
    const ledgerPath=path.join(home,'.mcp-device','palace-skill','owners.json');
    let stat;
    try{stat=lstatSync(ledgerPath);}catch(error){
      if((error as NodeJS.ErrnoException).code==='ENOENT')return result('missing','Run palace skill install. Package install scripts may have been disabled.');
      throw error;
    }
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)
      return result('repair-required','Run palace skill status to inspect the ownership ledger.','PALACE_SKILL_LEDGER_CORRUPT');
    const ledger=JSON.parse(readFileSync(ledgerPath,'utf8')) as Ledger;validateLedger(ledger);
    if(ledger.pending)return result('repair-required','Run palace skill repair to reconcile the pending transaction.','PALACE_SKILL_RECOVERY_REQUIRED');
    if(Object.keys(ledger.owners).length>32)return result('inspection-required','Run palace skill status to inspect the complete owner set.','PALACE_SKILL_PROBE_LIMIT');
    if(ledger.publishFailures&&Object.keys(ledger.publishFailures).length)
      return result('repair-required','Correct the recorded filesystem error, then run palace skill repair.','PALACE_SKILL_PUBLISH_FAILED');
    const eligible=Object.fromEntries(Object.entries(ledger.owners).filter(([,owner])=>!ledger.optOutPackages?.[owner.packageName]));
    const selected=chooseOwner(eligible);
    const optedOut=!!identity&&ledger.optOutPackages?.[identity.name]===true;
    if(!selected)return optedOut?result('disabled'):result('repair-required','Run palace skill repair to register or restore a package owner.','PALACE_SKILL_OWNER_UNAVAILABLE');
    if(identity&&packageNames.has(identity.name)&&!optedOut){
      const current=Object.entries(ledger.owners).find(([,owner])=>owner.packageName===identity.name&&path.resolve(owner.root)===packageRoot);
      if(!current)return result('update-available','Run palace skill repair to register the installed package.');
      if(compareVersions(current[1].version,identity.version)!==0)
        return result('update-available','Run palace skill repair to apply the verified package update.');
    }
    for(const target of [path.join(home,'.agents','skills','palace-cli'),path.join(home,'.pi','agent','skills','palace-cli')]){
      const record=ledger.targets[path.resolve(target)];
      if(!record)return result('missing','Run palace skill install or inspect the existing Skill with palace skill status.');
      const owner=ledger.owners[record.selectedOwner];
      if(!owner)return result('repair-required','Run palace skill status to inspect the recorded provider.','PALACE_SKILL_OWNER_UNAVAILABLE');
      if(record.version!==owner.version)return result('update-available','Run palace skill repair to apply the recorded package update.');
    }
    return result(optedOut?'provided-by-another-package':'present-recorded',
      'Run palace skill status for full filesystem and owner verification.');
  }catch(error){
    return result('repair-required','Run palace skill status, then follow its explicit repair instructions.',String((error as any).code??'PALACE_SKILL_PROBE_FAILED'));
  }
}
/** Ordinary knowledge reads never acquire an installer lock, hash a tree, stage,
 * publish, fsync, or sleep/retry. This observation is not ownership authority.
 * Full byte verification belongs to explicit Skill management and startup. */
export async function palaceSkillProbe(options:SkillManagerOptions={}):Promise<SkillProbe>{
  const cacheKey=[path.resolve(options.packageRoot??packageRootDefault),path.resolve(options.home??process.env.MCP_DEVICE_SKILL_HOME??os.homedir()),options.force?'1':'0',process.env.MCP_DEVICE_SKIP_SKILL_INSTALL??'',process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE??''].join('\0');
  const cached=probeCache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return cloneProbe(cached.value);
  if(cached)probeCache.delete(cacheKey);
  const controller=new AbortController(),signal=controller.signal;
  const result=(state:string,remediation:string|null=null,code?:string,warnings?:{owner:string;code:string}[]):SkillProbe=>({state,verification:'metadata-only',observational:true,remediation,...(code?{code}:{}),...(warnings?.length?{warnings}:{})});
  const read=async(filename:string,maxBytes:number)=>{
    signal.throwIfAborted();const stat=await fs.lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes)throw failure('PALACE_SKILL_PROBE_UNSAFE_FILE');
    return JSON.parse(await fs.readFile(filename,{encoding:'utf8',signal}));
  };
  let timer:NodeJS.Timeout|undefined;
  const inspect=async():Promise<SkillProbe>=>{
    const c=await context(options);signal.throwIfAborted();
    if(process.env.MCP_DEVICE_SKIP_SKILL_INSTALL==='1'&&!options.force)return result('disabled');
    if(!c.packageRoot.split(path.sep).some(part=>part.toLowerCase()==='node_modules')&&!options.force&&process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE!=='1')return result('development-checkout');
    await safeParents(c.home,c.ledgerPath);signal.throwIfAborted();
    const recovery=await lockObservation(path.join(c.stateDir,'owners.lock.recovery'));
    if(recovery)return result('repair-required','A recovery coordinator exists. Inspect palace skill status before retrying recovery.','PALACE_SKILL_LOCK_RECOVERY_REQUIRED');
    const lock=await lockObservation(path.join(c.stateDir,'owners.lock'));
    if(lock){
      const uncertain=!lock.body||deadProcess(lock.body.pid)||lock.ageMs>=5000;
      return result(uncertain?'repair-required':'busy',uncertain?'Inspect palace skill status, then use palace skill repair --break-lock only after confirming the original owner is absent.':'An installer is active; retry status after it completes.',uncertain?'PALACE_SKILL_LOCK_INSPECTION_REQUIRED':'PALACE_SKILL_BUSY');
    }
    if(!await exists(c.ledgerPath))return result('missing','Run palace skill install. Package install scripts may have been disabled.');
    const ledger=await read(c.ledgerPath,2*1024*1024) as Ledger;validateLedger(ledger);signal.throwIfAborted();
    if(ledger.pending)return result('repair-required','Run palace skill repair to reconcile the pending transaction.','PALACE_SKILL_RECOVERY_REQUIRED');
    if(Object.keys(ledger.owners).length>32)return result('inspection-required','Run palace skill status to inspect the complete owner set.','PALACE_SKILL_PROBE_LIMIT');
    const verified:Record<string,OwnerRecord>={},warnings:{owner:string;code:string}[]=[];
    for(const [key,owner] of Object.entries(ledger.owners)){
      signal.throwIfAborted();if(ledger.optOutPackages?.[owner.packageName])continue;
      try{
        const pkg=await read(path.join(owner.root,'package.json'),65536);
        if(pkg.name!==owner.packageName||typeof pkg.version!=='string')throw failure('PALACE_SKILL_OWNER_IDENTITY_CHANGED');
        compareVersions(pkg.version,pkg.version);
        const source=await fs.lstat(path.join(owner.source,'SKILL.md'));if(!source.isFile()||source.isSymbolicLink())throw failure('PALACE_SKILL_OWNER_SOURCE_UNSAFE');
        verified[key]={...owner,version:pkg.version};
      }catch(error){if(signal.aborted)throw error;warnings.push({owner:key,code:String((error as any).code??'PALACE_SKILL_OWNER_STALE')});}
    }
    const selected=chooseOwner(verified),optedOut=ledger.optOutPackages?.[c.pkg.name]===true;
    if(!selected)return optedOut?result('disabled',null,undefined,warnings):result('repair-required','Run palace skill repair to register or restore a verified package owner.','PALACE_SKILL_OWNER_UNAVAILABLE',warnings);
    let update=false;
    for(const target of c.targets){
      signal.throwIfAborted();await safeParents(c.home,target);
      const record=ledger.targets[target];if(!record)return result('missing','Run palace skill install or inspect an existing same-name Skill with palace skill status.');
      if(warnings.some(warning=>warning.owner===record.selectedOwner))return result('owner-unavailable','The recorded provider is unavailable. Existing guidance is preserved; inspect palace skill status before changing providers.',undefined,warnings);
      const stat=await fs.lstat(target).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      if(!stat)return result('missing-managed','Run palace skill repair to restore the missing managed target.');
      if(!stat.isDirectory()||stat.isSymbolicLink())return result('conflict-preserved','Run palace skill status; use explicit lossless adoption only after inspection.');
      const skill=await fs.lstat(path.join(target,'SKILL.md')).catch(()=>null);
      if(!skill?.isFile()||skill.isSymbolicLink())return result('repair-required','Run palace skill status to inspect incomplete or modified guidance.');
      const marker=await read(path.join(target,'.mcp-device-palace-owned'),4096).catch(()=>null);
      if(marker?.skill!=='palace-cli'||marker.owner!==record.selectedOwner||marker.version!==record.version)return result('conflict-preserved','Run palace skill status before any explicit ownership repair.');
      if(ledger.publishFailures?.[target])return result('repair-required','Correct the recorded filesystem error, then run palace skill repair.',ledger.publishFailures[target].code,warnings);
      if(record.selectedOwner!==selected[0]||record.version!==selected[1].version)update=true;
    }
    if(update)return result('update-available','Run palace skill repair to apply the verified package update.',undefined,warnings);
    return result(optedOut?'provided-by-another-package':'present-recorded',warnings.length?'Run palace skill status to inspect excluded package owners.':null,undefined,warnings);
  };
  // The probe performs bounded metadata reads only, but a heavily loaded host or
  // antivirus filter can legitimately delay those reads. Keep a hard ceiling
  // without turning ordinary scheduler delay into a false repair requirement.
  try{
    const outcome=await Promise.race([inspect(),new Promise<SkillProbe>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(result('inspection-required','Run palace skill status separately; the read-only metadata probe reached its deadline.','PALACE_SKILL_PROBE_TIMEOUT'));},2000);})]);
    if(['present-recorded','provided-by-another-package','development-checkout','disabled','missing','update-available'].includes(outcome.state))
      probeCache.set(cacheKey,{expires:Date.now()+250,value:cloneProbe(outcome)});
    return outcome;
  }
  catch(error){return result('repair-required','Run palace skill status, then follow its explicit repair instructions.',String((error as any).code??'PALACE_SKILL_PROBE_FAILED'));}
  finally{if(timer)clearTimeout(timer);controller.abort();}
}
export async function palaceSkillStatus(options:SkillManagerOptions={}):Promise<Record<string,unknown>>{
  const c=await context(options);await safeParents(c.home,c.ledgerPath);
  const ledger=await readLedger(c.ledgerPath),ownerProblems=await refreshOwners(ledger,false),excluded=new Set(ownerProblems.map(x=>x.owner));
  const selected=chooseOwner(Object.fromEntries(Object.entries(ledger.owners).filter(([key])=>!excluded.has(key)))),result=[];
  const coordination=[];
  for(const name of ['owners.lock','owners.lock.recovery']){
    const filename=path.join(c.stateDir,name),lock=await lockObservation(filename);if(!lock)continue;
    const abandoned=lock.body?await abandonedProcess(lock.body):null;
    coordination.push({path:filename,pid:lock.body?.pid??null,ageMs:lock.ageMs,state:abandoned===true?'abandoned':lock.body?'active-or-uninspectable':'incomplete',remediation:name.endsWith('.recovery')?'Inspect the recovery coordinator; do not remove a live owner.':'Use palace skill repair --break-lock only after verifying abandonment.'});
  }
  for(let index=0;index<c.targets.length;index++){
    const target=c.targets[index],record=ledger.targets[target],inspected=await inspectTarget(c.home,target,record,selected?.[1]);
    result.push({target,...inspected,record:record??null,updateAvailable:!!selected&&(!record||record.selectedOwner!==selected[0]||record.version!==selected[1].version||!sameMap(record.files,selected[1].files)),remediation:targetRemediation(inspected.state,index===0?'agents':'pi'),replacementOffer:ledger.offers?.[target]??null,publishFailure:ledger.publishFailures?.[target]??null});
  }
  return {ok:!result.some(x=>x.state==='unsafe-parent'),skill:'palace-cli',home:c.home,ledger:c.ledgerPath,optedOut:ledger.optOutPackages?.[c.pkg.name]===true,
    stillProvidedBy:selected?{packageName:selected[1].packageName,version:selected[1].version,root:selected[1].root}:null,
    ownerProblems,coordination,pendingRecovery:ledger.pending??null,retained:ledger.retained??{},prunableBackups:Object.keys(ledger.retainedFiles??{}).length,replacementOffers:ledger.offers??{},
    owners:Object.entries(ledger.owners).map(([key,value])=>({key,packageName:value.packageName,version:value.version,root:value.root,missingSince:value.missingSince??null})),result};
}
