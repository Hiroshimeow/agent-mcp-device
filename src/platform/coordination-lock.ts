import fs, {type FileHandle} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {processBirth,processNamespace,sameProcessNamespace,type ProcessNamespace} from './process-identity.js';

export interface CoordinationLockBody {pid:number;token:string;createdAt?:number;processBirth?:string;namespace?:ProcessNamespace}
export interface CoordinationObservation {body?:CoordinationLockBody;ageMs:number;mtimeMs:number;size:number}
export interface CoordinationCodes {busy:string;active:string;recoveryRequired:string}
export interface CoordinationOptions {
  nonBlocking?:boolean;breakLock?:boolean;attempts?:number;staleMs?:number;codes:CoordinationCodes;
  messagePrefix?:string;retainAbandoned?:boolean;
}
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const failure=(code:string,message:string,details:Record<string,unknown>={})=>Object.assign(new Error(message),{code,...details});

export async function coordinationObservation(filename:string):Promise<CoordinationObservation|null>{
  let stat;try{stat=await fs.lstat(filename);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
  if(!stat.isFile()||stat.isSymbolicLink())throw failure('COORDINATION_PATH_UNSAFE','Coordination path is not an ordinary file.',{path:filename});
  let body:CoordinationLockBody|undefined;
  if(stat.size<=4096){
    try{
      const parsed=JSON.parse(await fs.readFile(filename,'utf8'));
      if(Number.isSafeInteger(parsed.pid)&&parsed.pid>0&&typeof parsed.token==='string'&&parsed.token){
        body={pid:parsed.pid,token:parsed.token,...(Number.isFinite(parsed.createdAt)?{createdAt:parsed.createdAt}:{}),
          ...(typeof parsed.processBirth==='string'&&parsed.processBirth.length<=256?{processBirth:parsed.processBirth}:{}),
          ...(parsed.namespace&&typeof parsed.namespace.platform==='string'&&typeof parsed.namespace.hostname==='string'?{namespace:parsed.namespace as ProcessNamespace}:{})};
      }
    }catch{}
  }
  return {body,ageMs:Math.max(0,Date.now()-stat.mtimeMs),mtimeMs:stat.mtimeMs,size:stat.size};
}
export function processAppearsDead(pid:number):boolean{
  try{process.kill(pid,0);return false;}catch(error){return (error as NodeJS.ErrnoException).code==='ESRCH';}
}
export async function coordinationOwnerAbandoned(body:CoordinationLockBody):Promise<boolean>{
  if(!await sameProcessNamespace(body.namespace))return false;
  if(processAppearsDead(body.pid))return true;
  if(!body.processBirth)return false;
  const actual=await processBirth(body.pid);
  return actual!==null&&actual!==body.processBirth;
}
export async function createCoordinationLock(filename:string,token=randomUUID()):Promise<{handle:FileHandle;token:string}>{
  await fs.mkdir(path.dirname(filename),{recursive:true});
  const [birth,namespace]=await Promise.all([processBirth(process.pid),processNamespace()]);
  const body=JSON.stringify({pid:process.pid,token,createdAt:Date.now(),...(birth?{processBirth:birth}:{}),...(namespace?{namespace}:{})})+'\n';
  const claim=filename+'.claim-'+token;
  let handle:FileHandle|undefined,linked=false,direct=false;
  try{
    handle=await fs.open(claim,'wx',0o600);
    await handle.writeFile(body);await handle.sync();
    try{await fs.link(claim,filename);linked=true;await fs.unlink(claim);return {handle,token};}
    catch(error){
      const code=(error as NodeJS.ErrnoException).code;
      if(!['EPERM','EXDEV','ENOTSUP','EOPNOTSUPP','EINVAL'].includes(String(code)))throw error;
      await handle.close();handle=undefined;await fs.rm(claim,{force:true});
      try{handle=await fs.open(filename,'wx',0o600);direct=true;}
      catch(openError){
        const openCode=String((openError as NodeJS.ErrnoException).code);
        // The claim file was created in this directory, so EPERM/EACCES on the
        // target itself is Windows file contention/pending deletion, not a
        // directory permission failure. Surface it as ordinary lock busy so the
        // caller follows the existing bounded retry/recovery path.
        if(process.platform==='win32'&&['EPERM','EACCES'].includes(openCode)){
          (openError as NodeJS.ErrnoException).code='EEXIST';
        }
        throw openError;
      }
      try{await handle.writeFile(body);await handle.sync();return {handle,token};}
      catch(writeError){await handle.close();handle=undefined;await fs.unlink(filename).catch(()=>{});throw writeError;}
    }
  }catch(error){
    if(handle)await handle.close().catch(()=>{});
    if(linked){const current=await coordinationObservation(filename).catch(()=>null);if(current?.body?.token===token)await fs.unlink(filename).catch(()=>{});}
    if(direct)await fs.unlink(filename).catch(()=>{});
    await fs.rm(claim,{force:true}).catch(()=>{});
    throw error;
  }
}
export async function releaseCoordinationLock(lock:{handle:FileHandle;token:string},filename:string):Promise<void>{
  await lock.handle.close();
  try{
    const current=await coordinationObservation(filename);
    if(current?.body?.token===lock.token)await fs.unlink(filename);
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
async function recoverObserved(lockPath:string,recoveryPath:string,observed:CoordinationObservation,options:CoordinationOptions,allowIncomplete:boolean):Promise<boolean>{
  const recoveryToken=randomUUID();let recovery:{handle:FileHandle;token:string}|undefined;
  try{recovery=await createCoordinationLock(recoveryPath,recoveryToken);}
  catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')return false;throw error;}
  try{
    const current=await coordinationObservation(lockPath);if(!current)return true;
    const same=current.mtimeMs===observed.mtimeMs&&current.size===observed.size
      &&current.body?.token===observed.body?.token&&current.body?.pid===observed.body?.pid&&current.body?.processBirth===observed.body?.processBirth;
    if(!same)return false;
    if(current.body){
      if(!await coordinationOwnerAbandoned(current.body))return false;
    }else if(!allowIncomplete||current.ageMs<(options.staleMs??5000))return false;
    const abandoned=lockPath+'.abandoned-'+randomUUID();
    if(options.retainAbandoned!==false)await fs.rename(lockPath,abandoned);else await fs.unlink(lockPath);
    return true;
  }finally{await releaseCoordinationLock(recovery,recoveryPath);}
}
export async function repairCoordinationLock(lockPath:string,options:CoordinationOptions):Promise<{recovered:boolean;reason?:string}>{
  const observed=await coordinationObservation(lockPath);if(!observed)return {recovered:false,reason:'absent'};
  if(observed.body&&!await coordinationOwnerAbandoned(observed.body))throw failure(options.codes.active,(options.messagePrefix??'Coordination')+' owner is live or cannot be proved abandoned.',{path:lockPath,pid:observed.body.pid});
  if(!observed.body&&observed.ageMs<(options.staleMs??5000))throw failure(options.codes.active,(options.messagePrefix??'Coordination')+' lock may still be initializing.',{path:lockPath});
  const ok=await recoverObserved(lockPath,lockPath+'.recovery',observed,options,true);
  if(!ok)throw failure(options.codes.recoveryRequired,(options.messagePrefix??'Coordination')+' ownership changed during recovery.',{path:lockPath});
  return {recovered:true};
}
export async function withCoordinationLock<T>(lockPath:string,work:()=>Promise<T>,options:CoordinationOptions):Promise<T>{
  const recoveryPath=lockPath+'.recovery';
  if(options.breakLock)await repairCoordinationLock(lockPath,options).catch(error=>{if((error as any).reason==='absent')return;throw error;});
  let lock:{handle:FileHandle;token:string}|undefined;
  const attempts=options.nonBlocking?1:(options.attempts??200);
  for(let attempt=0;attempt<attempts;attempt++){
    try{lock=await createCoordinationLock(lockPath);break;}
    catch(error){
      if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      const prior=await coordinationObservation(lockPath);if(!prior)continue;
      if(prior.body&&await coordinationOwnerAbandoned(prior.body)){
        if(await recoverObserved(lockPath,recoveryPath,prior,options,false))continue;
      }
      if(!prior.body&&prior.ageMs>=(options.staleMs??5000))
        throw failure(options.codes.recoveryRequired,(options.messagePrefix??'Coordination')+' has an incomplete old lock; explicit recovery is required.',{path:lockPath});
      if(options.nonBlocking)throw failure(options.codes.busy,(options.messagePrefix??'Coordination')+' is busy.',{path:lockPath});
      await sleep(10);
    }
  }
  if(!lock)throw failure(options.codes.busy,(options.messagePrefix??'Coordination')+' is busy or uninspectable.',{path:lockPath});
  try{return await work();}finally{await releaseCoordinationLock(lock,lockPath);}
}
