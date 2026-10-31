#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryPalaceCards, searchPalaceCards } from './store.js';
import { palaceSkillStatus, palaceSkillQuickProbe, reconcilePalaceSkill } from './skill-manager.js';
import { preview, boundedInt } from './util.js';
import type { KnowledgeCard } from './types.js';
import { inspectRuntimeRoot, resolveRuntimeRoot } from '../../platform/runtime-root.js';

// Standalone read-only CLI for the installable Palace plugin.
// Reads a live SQLite WAL snapshot safely, without invoking MCP or opening a second writer.
interface Params { command:string; positional:string[]; opts:Record<string,string|boolean> }
interface CliDetails { runtimeDir?:string|null;dataRoot?:string;pluginState?:string;runtimeActive?:boolean|null;remediation?:string;recordedError?:string }
class PalaceCliError extends Error {
  constructor(readonly code:string,message:string,readonly details:CliDetails={}){super(message);this.name='PalaceCliError';}
}
const packageRoot=fileURLToPath(new URL('../../../',import.meta.url));
function packageInfo():{packageName:string;packageVersion:string;installPath:string}{
  try {const pkg=JSON.parse(readFileSync(path.join(packageRoot,'package.json'),'utf8'));return {packageName:String(pkg.name??'unknown'),packageVersion:String(pkg.version??'unknown'),installPath:packageRoot};}
  catch{return {packageName:'unknown',packageVersion:'unknown',installPath:packageRoot};}
}
function parse(argv:string[]):Params {
  const positional:string[]=[]; const opts:Record<string,string|boolean>={};
  const valued=new Set(['runtime-dir','data-root','project-id','limit','max-bytes','target','forget-owner']);
  const flags=new Set(['include-candidates','include-inactive','full','help','break-lock','abandon-pending','all']);
  for(let i=0;i<argv.length;i++){
    const part=argv[i];
    if(!part.startsWith('--')){positional.push(part);continue;}
    const eq=part.indexOf('=');const key=part.slice(2,eq<0?undefined:eq);
    if(flags.has(key)&&eq<0){opts[key]=true;continue;}
    if(!valued.has(key))throw new PalaceCliError('UNKNOWN_OPTION','Unknown option: '+key);
    const value=eq<0?argv[++i]:part.slice(eq+1);
    if(!value||value.startsWith('--'))throw new PalaceCliError('MISSING_OPTION','Missing option: '+key);
    opts[key]=value;
  }
  return { command: positional.shift()??'status', positional, opts };
}
function checkedString(value:unknown,max=4096):string {
  if(typeof value!=='string'||Buffer.byteLength(value,'utf8')>max)throw new PalaceCliError('INVALID_ARGUMENT','Invalid string argument');
  return value;
}
async function runtimeIsActive(runtime:string):Promise<boolean|null> {
  if(!existsSync(path.join(runtime,'server-runtime.lock'))&&existsSync(path.join(runtime,'runtime-control.json')))return null;
  const inspection=await inspectRuntimeRoot(runtime);
  return inspection.leaseInspectable?inspection.activeLease:null;
}
/** Recognize the generic host's existing private-data layout even through an
 * alias. An explicit directory is not permission to ignore a known disabled
 * runtime. Separately copied archives have no binding and remain read-only. */
function managedRuntime(dataRoot:string):string|null{
  let canonical:string;try{canonical=realpathSync(dataRoot);}catch{return null;}
  const palace=path.dirname(canonical),plugins=path.dirname(palace),runtime=path.dirname(plugins);
  const names=[path.basename(plugins),path.basename(palace),path.basename(canonical)].map(name=>process.platform==='win32'?name.toLowerCase():name);
  if(names.join('/')!=='plugins/palace/data')return null;
  return existsSync(path.join(runtime,'plugins','registry.json'))?runtime:null;
}
function lifecycle(runtime:string,explicitDataRoot:boolean,pkg:{packageName:string;installPath:string}):{pluginState:string;available:boolean;code?:string;remediation?:string;recordedError?:string}{
  if(explicitDataRoot)return {pluginState:'unknown',available:true};
  const registry=path.join(runtime,'plugins','registry.json');
  if(!existsSync(registry))return {pluginState:'unregistered',available:true};
  let record:any;
  try{record=JSON.parse(readFileSync(registry,'utf8'))?.plugins?.palace;}
  catch{throw new PalaceCliError('PALACE_REGISTRY_INVALID','Palace plugin registry is unreadable',{runtimeDir:runtime,remediation:'Inspect or restore plugins/registry.json before using Palace.'});}
  if(!record)return {pluginState:'not-installed',available:false,code:'PALACE_NOT_INSTALLED',remediation:`Install or restore Palace for runtime ${runtime}.`};
  if(existsSync(path.join(runtime,'plugins','palace','upgrade-intent.json')))
    return {pluginState:'upgrade-in-progress',available:false,code:'PALACE_UPGRADE_IN_PROGRESS',remediation:`Finish or recover the Palace upgrade with mcp-device plugins --runtime-dir "${runtime}" list before using Palace.`};
  if(!record.installed||record.state==='uninstalled'){
    const remediation=pkg.packageName==='@hcu-lab.me/mcp-device'
      ? `Run mcp-device plugins --runtime-dir "${runtime}" install palace --bundled --enable.`
      : `Register the standalone package with an existing Device host: mcp-device plugins --runtime-dir "${runtime}" install "${path.join(pkg.installPath,'palace.plugin.json')}" --enable. A standalone host without mcp-device has no mutation/re-registration path.`;
    return {pluginState:'uninstalled',available:false,code:'PALACE_UNINSTALLED',remediation};
  }
  const stopWarning='An agent must not stop the runtime itself; report this prerequisite to the operator.';
  if(record.bundleUpgradeRequired)return {pluginState:'upgrade-required',available:false,code:'PALACE_UPGRADE_REQUIRED',remediation:`Stop the runtime, then run mcp-device plugins --runtime-dir "${runtime}" upgrade palace --bundled. ${stopWarning}`};
  if(!record.enabled||record.state==='disabled')return {pluginState:'disabled',available:false,code:'PALACE_DISABLED',remediation:`Run mcp-device plugins --runtime-dir "${runtime}" enable palace.`};
  if(record.state==='faulted'){
    const recordedError=String(record.error??'PLUGIN_FAULT: no recorded diagnostic');
    let missingEntry=false;
    const entry=record.manifest?.entry;
    if(typeof entry==='string'&&path.isAbsolute(entry)){
      try{missingEntry=!statSync(entry).isFile();}
      catch(error){missingEntry=['ENOENT','ENOTDIR'].includes(String((error as NodeJS.ErrnoException).code));}
    }
    let recovery=`Inspect the recorded fault and its inputs, then run mcp-device plugins --runtime-dir "${runtime}" enable palace.`;
    if(missingEntry){
      recovery=record.installationSource==='distribution'
        ?`Stop the runtime, then run mcp-device plugins --runtime-dir "${runtime}" upgrade palace --bundled. ${stopWarning}`
        :`Stop the runtime and restore the manually installed package using its reviewed manifest. After restoring, run mcp-device plugins --runtime-dir "${runtime}" enable palace. Do not substitute the bundled distribution. ${stopWarning}`;
    }
    return {pluginState:'faulted',available:false,code:'PALACE_FAULTED',recordedError,remediation:`Recorded fault: ${recordedError}. ${recovery}`};
  }
  return {pluginState:String(record.state??'installed'),available:true};
}
function emit(value:Record<string,unknown>,maxBytes:number):void {
  const bytes=Buffer.from(JSON.stringify(value)+'\n');
  if(bytes.length>maxBytes)throw new PalaceCliError('BUDGET_TOO_SMALL',`${bytes.length} > ${maxBytes}`);
  process.stdout.write(bytes);
}
function emitSkillLifecycle(value:Record<string,unknown>,maxBytes:number):void {
  const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length<=maxBytes){process.stdout.write(bytes);return;}
  const rows=Array.isArray(value.result)?value.result as Record<string,unknown>[]:[];
  emit({ok:value.ok,skill:value.skill,home:value.home,optedOut:value.optedOut,stillProvidedBy:value.stillProvidedBy,
    ownerProblemCount:Array.isArray(value.ownerProblems)?value.ownerProblems.length:0,pendingRecovery:Boolean(value.pendingRecovery),truncated:true,
    result:rows.map(row=>({target:row.target,state:row.state,code:row.code,remediation:typeof row.remediation==='string'?row.remediation.slice(0,512):row.remediation}))},maxBytes);
}
function unavailableBase(code:string,message:string,base:Record<string,unknown>,details:CliDetails):Record<string,unknown>{
  return {...base,ok:false,code,error:message,...details};
}
function schema(db:DatabaseSync,details:CliDetails):void {
  try{
    const hasMeta=Boolean((db.prepare("select 1 as present from sqlite_master where type='table' and name='meta'").get() as {present?:number}|undefined)?.present);
    if(!hasMeta)throw new PalaceCliError('PALACE_SCHEMA_UNSUPPORTED','Palace schema metadata is missing',details);
    const value=String((db.prepare('select value from meta where key=?').get('schema') as {value?:string}|undefined)?.value??'');
    if(value!=='1')throw new PalaceCliError('PALACE_SCHEMA_UNSUPPORTED','Unsupported Palace schema: '+(value||'missing'),details);
  }catch(error){if(error instanceof PalaceCliError)throw error;throw new PalaceCliError('PALACE_SCHEMA_UNSUPPORTED','Palace schema cannot be read',details);}
}
async function main():Promise<void> {
  const {command,positional,opts}=parse(process.argv.slice(2));
  if(opts.help){
    process.stdout.write('palace [--data-root DIR|--runtime-dir DIR] status|search QUERY|read ID|skills|skill status|install|repair|remove|adopt [--project-id ID] [--limit N] [--max-bytes N] [--include-candidates] [--full]\n');
    return;
  }
  if(!['status','search','read','skills','skill'].includes(command))throw new PalaceCliError('UNKNOWN_COMMAND','Unknown Palace command');
  if(opts['data-root']!==undefined&&opts['runtime-dir']!==undefined)throw new PalaceCliError('CONFLICTING_OPTIONS','Use either --data-root or --runtime-dir, not both');
  if(['status','skills'].includes(command)&&positional.length)throw new PalaceCliError('UNEXPECTED_ARGUMENT','This command accepts no positional arguments');
  if(command==='read'&&positional.length!==1)throw new PalaceCliError('CARD_ID_REQUIRED','Exactly one card id is required');
  if(command==='search'&&!positional.join(' ').trim())throw new PalaceCliError('QUERY_REQUIRED','A query is required');
  if(command==='skill'&&positional.length>1)throw new PalaceCliError('UNEXPECTED_ARGUMENT','Use one Skill lifecycle action');
  const skillAction=command==='skill'?(positional[0]??'status'):null;
  if((opts['break-lock']||opts['abandon-pending'])&&skillAction!=='repair')throw new PalaceCliError('UNKNOWN_OPTION','Recovery options are only valid for skill repair');
  if(opts.all&&skillAction!=='remove')throw new PalaceCliError('UNKNOWN_OPTION','--all is only valid for skill remove');
  if(opts.target!==undefined&&skillAction!=='adopt')throw new PalaceCliError('UNKNOWN_OPTION','--target is only valid for skill adopt');
  if(opts['forget-owner']!==undefined&&skillAction!=='repair')throw new PalaceCliError('UNKNOWN_OPTION','--forget-owner is only valid for skill repair');
  const maxBytes=boundedInt(opts['max-bytes']===undefined?undefined:Number(opts['max-bytes']),16384,512,65536);
  if(command==='skill'){
    const action=positional[0]??'status';let result:Record<string,unknown>;
    if(action==='status'||action==='doctor')result=await palaceSkillStatus({packageRoot});
    else if(action==='install')result=await reconcilePalaceSkill({packageRoot,force:true,install:true,repair:true});
    else if(action==='repair')result=await reconcilePalaceSkill({packageRoot,force:true,repair:true,breakLock:opts['break-lock']===true,abandonPending:opts['abandon-pending']===true,forgetOwner:typeof opts['forget-owner']==='string'?opts['forget-owner']:undefined});
    else if(action==='prune')result=await reconcilePalaceSkill({packageRoot,force:true,prune:true});
    else if(action==='remove')result=await reconcilePalaceSkill({packageRoot,force:true,removeCurrentOwner:true,removeAll:opts.all===true});
    else if(action==='adopt'){
      if(opts.target!=='agents'&&opts.target!=='pi')throw new PalaceCliError('SKILL_TARGET_REQUIRED','Explicitly select --target agents or --target pi. The prior target is retained, not deleted.');
      result=await reconcilePalaceSkill({packageRoot,force:true,install:true,repair:true,adoptTarget:opts.target});
    }else throw new PalaceCliError('SKILL_ACTION_UNSUPPORTED','Use palace skill status, install, repair, remove or adopt');
    emitSkillLifecycle(result,maxBytes);if(result.ok===false)process.exitCode=1;return;
  }
  const pkg=packageInfo();
  const skill=palaceSkillQuickProbe({packageRoot},{name:pkg.packageName,version:pkg.packageVersion});
  const skillState=skill.state;
  const explicitDataRoot=opts['data-root']!==undefined||(opts['runtime-dir']===undefined&&process.env.PALACE_DATA_ROOT!==undefined);
  const selectedRuntime=explicitDataRoot?'':await resolveRuntimeRoot(opts['runtime-dir']===undefined?undefined:String(opts['runtime-dir']));
  const dataRoot=path.resolve(String(explicitDataRoot?(opts['data-root']??process.env.PALACE_DATA_ROOT):path.join(selectedRuntime,'plugins','palace','data')));
  const inferred=explicitDataRoot?managedRuntime(dataRoot):null,runtime=inferred??selectedRuntime;
  const archive=explicitDataRoot&&inferred===null,runtimeBinding=archive?'unmanaged-archive':inferred?'managed-path':'explicit-runtime';
  const filename=path.join(dataRoot,'palace.sqlite');
  if(existsSync(filename)&&lstatSync(filename).isSymbolicLink())throw new PalaceCliError('PALACE_MANAGED_PATH_UNSAFE','Palace database must be an ordinary file, not a symbolic link',{runtimeDir:archive?null:runtime,dataRoot,remediation:'Use the real Palace data directory or a reviewed archive copy.'});
  const active=archive?null:await runtimeIsActive(runtime),life=lifecycle(runtime,archive,pkg);
  const writePath=archive||active!==false?null:`mcp-device knowledge --runtime-dir "${runtime}"`;
  const mutationPolicy=archive?'runtime-binding-unknown':active===true?'stopped-runtime-only':active===null?'owner-state-unknown':'exclusive-lease-required';
  const base={plugin:'palace',mode:'read-only',runtimeDir:archive?null:runtime,runtimeBinding,dataRoot,pluginState:life.pluginState,runtimeActive:active,leaseVerification:archive?null:'pid-namespace',writePath,mutationPolicy,skillState,skill,...pkg};
  const details={runtimeDir:archive?null:runtime,dataRoot,pluginState:life.pluginState,runtimeActive:active,remediation:life.remediation,recordedError:life.recordedError};
  if(!life.available){
    const failure=unavailableBase(life.code??'PALACE_UNAVAILABLE','Palace is not callable for this runtime.',base,details);
    if(command==='status'){emit(failure,maxBytes);process.exitCode=1;return;}
    throw new PalaceCliError(life.code??'PALACE_UNAVAILABLE','Palace is not callable for this runtime.',details);
  }
  if(!existsSync(filename)){
    const failure=unavailableBase('PALACE_NOT_INSTALLED','Palace database is not installed.',base,{...details,remediation:life.remediation??`Start or install Palace for runtime ${runtime}.`});
    if(command==='status'){emit(failure,maxBytes);process.exitCode=1;return;}
    throw new PalaceCliError('PALACE_NOT_INSTALLED','Palace database is not installed',{...details,remediation:String(failure.remediation)});
  }
  const db=new DatabaseSync(filename,{readOnly:true});
  try {
    db.exec('PRAGMA busy_timeout=3000');
    // Establish one WAL snapshot for schema, counts and selected rows in this invocation.
    db.exec('BEGIN');
    schema(db,details);
    const limit=boundedInt(opts.limit===undefined?undefined:Number(opts.limit),10,1,50);
    const projectId=opts['project-id']===undefined?undefined:checkedString(opts['project-id'],512);
    const includeInactive=opts['include-inactive']===true;
    const includeCandidates=opts['include-candidates']===true;
    const full=opts.full===true;
    let response:Record<string,unknown>;
    if(command==='status'){
      const counts=(db.prepare('select kind,status,count(*) as count from cards group by kind,status').all() as Record<string,unknown>[]);
      const totals=(db.prepare('select (select count(*) from cards) cards,(select count(*) from evidence) evidence,(select count(*) from versions) versions').get() as Record<string,unknown>);
      response={...base,ok:true,totals,counts};
    }else if(command==='search'){
      const query=checkedString(positional.join(' '));if(!query.trim())throw new PalaceCliError('QUERY_REQUIRED','A search query is required',details);
      const selected=searchPalaceCards(db,'',{query,projectId,includeInactive,limit:0,resultLimit:limit});
      const result=selected.items.map(x=>full?x:preview(x));
      response={...base,ok:true,query,items:result,returned:result.length,candidates:selected.candidates,note:'Snapshot results; evidence bytes not reverified by read-only CLI'};
    }else if(command==='skills'){
      const rows=queryPalaceCards(db,'',{projectId,includeInactive:includeCandidates||includeInactive,kind:'procedure',status:includeCandidates?undefined:'validated',limit:Math.min(200,Math.max(limit+1,limit*4))});
      const visible=(includeCandidates?rows.filter(x=>x.status==='validated'||x.status==='hypothesis'):rows).slice(0,limit);
      const result=visible.map(x=>full?x:preview(x));
      const activationPolicy=String((db.prepare('select value from meta where key=?').get('activationPolicy') as {value?:string}|undefined)?.value??'candidate_only');
      response={...base,ok:true,items:result,returned:result.length,candidates:rows.filter(x=>x.status==='validated'||x.status==='hypothesis').length,activationPolicy,note:'Validated procedures only unless --include-candidates is explicit; stale/superseded/withdrawn procedures remain excluded'};
    }else if(command==='read'){
      const id=checkedString(positional[0],512);if(!id||positional.length!==1)throw new PalaceCliError('CARD_ID_REQUIRED','Exactly one card id is required',details);
      const row=db.prepare('select json,kind from cards where id=?').get(id) as {json:string;kind:string}|undefined;
      if(!row)throw new PalaceCliError('KNOWLEDGE_NOT_FOUND','Knowledge card was not found',details);
      const card=JSON.parse(row.json) as KnowledgeCard;
      if(card.scope.visibility==='project'&&(!projectId||projectId!==card.scope.projectId))throw new PalaceCliError('SCOPE_REQUIRED','Matching --project-id is required',details);
      if(!includeInactive&&['stale','superseded','withdrawn'].includes(card.status))throw new PalaceCliError('KNOWLEDGE_NOT_CURRENT','Knowledge card is inactive',details);
      response={...base,ok:true,kind:row.kind,card,evidenceVerifiedNow:false,note:'Source integrity must be verified separately before treating this card as an established fact.'};
    }else throw new PalaceCliError('UNKNOWN_COMMAND','Unknown Palace command: '+command,details);
    emit(response,maxBytes);
  } finally {db.close();}
}
try{await main();}catch(error){
  const failure=error as Error&{code?:string;details?:CliDetails};
  const text=String(failure.message??failure),rawCode=failure.code??(failure instanceof PalaceCliError?failure.code:text.split(':')[0]);
  const busy=/SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(String(rawCode)+' '+text);
  const code=busy?'PALACE_BUSY':rawCode;
  process.stderr.write(JSON.stringify({ok:false,code,error:text,...(busy?{remediation:'Retry after the active Palace writer completes its current transaction.'}:{}),...(failure instanceof PalaceCliError?failure.details:{})})+'\n');
  process.exitCode=1;
}
