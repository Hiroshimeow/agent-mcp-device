// G6-only baseline capture; leaves existing runtime and WIP untouched.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=process.cwd(),evidence=path.join(root,'evidence/v12-e2e-20261024-g6'),work='E:/test/mcp-device-v12-e2e-20261024-g6';
const git=args=>{const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error(r.stderr);return r.stdout;};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const head=git(['rev-parse','HEAD']).trim(),branch=git(['branch','--show-current']).trim();
if(head!=='1e454c1cdcbe3265892f751034fa389432d65405'||branch!=='feat/v12-platform-20261022')throw new Error('SOURCE_IDENTITY_CHANGED');
if(fs.existsSync(work))throw new Error('BASELINE_DESTINATION_EXISTS');
fs.mkdirSync(work);fs.mkdirSync(path.join(work,'preserved-wip'));
const selected=['package.json','test/v12/server-package-cold.test.mjs','scripts/v12/build-palace-package.mjs','scripts/v12/install-palace-skill.cjs','test/v12/palace-distribution.test.mjs','specs/008-v12-platform/ONE_AGENT_EXECUTION_PROMPT.md','specs/008-v12-platform/V12_END_TO_END_COMPLETION_SPEC.md'];
const tracked=git(['ls-files','-z']).split('\0').filter(Boolean),untracked=git(['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean),preserved=[];
for(const rel of selected){const from=path.join(root,rel),to=path.join(work,'preserved-wip',rel),bytes=fs.readFileSync(from);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bytes,{flag:'wx'});preserved.push({path:rel,bytes:bytes.length,sha256:sha(bytes),mtime:fs.statSync(from).mtime.toISOString()});}
const source=path.join(work,'baseline');fs.mkdirSync(source);const sourceManifest=[];
for(const rel of [...new Set([...tracked,...selected])]){const from=path.join(root,rel);if(!fs.existsSync(from)||!fs.lstatSync(from).isFile())continue;const bytes=fs.readFileSync(from),to=path.join(source,rel);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bytes,{flag:'wx'});sourceManifest.push({path:rel,sha256:sha(bytes),bytes:bytes.length});}
fs.cpSync(path.join(root,'dist'),path.join(source,'dist'),{recursive:true,errorOnExist:true,force:false});
fs.symlinkSync(path.join(root,'node_modules'),path.join(source,'node_modules'),'junction');
const record={schemaVersion:1,recordedAt:new Date().toISOString(),scope:'G6 only via md',deviceId:'desktop-b5e4iue-87cea2af',host:os.hostname(),os:process.platform,arch:process.arch,node:process.version,nodeExecutable:process.execPath,sourceRoot:root,head,branch,status:git(['status','--porcelain=v1','--untracked-files=normal']),preservedWip:preserved,untrackedPaths:untracked,sourceSnapshot:source,work,sourceManifestSha256:sha(JSON.stringify(sourceManifest)),reviewGates:{D0:'REVIEW_PENDING_G6_ONLY',D1:'NOT_RUN',D2:'NOT_RUN',D3:'NOT_RUN'},observedListeners:[{port:8101,pid:47816},{port:8102,pid:47816},{port:8103,pid:50388}],testPort8104ObservedFree:true,sourceChanges:[],runtimeChanges:[],notes:['Existing .tmp/, nul and ignored runtime state left untouched.','Snapshot has existing compiled dist; freshness not yet proven.','Process-inspection request IDs 9e22f858-1b20-4fef-90e6-6197f9097ced and 7ec58b52-bf02-4c12-b92f-187173a38d72 timed out. No process terminated.','WSL Ubuntu node probe exceeded 8000 ms; Linux availability unproven.','Gateway read_text_file ignores head/tail; remainders read by bounded Node slices.']};
fs.writeFileSync(path.join(evidence,'environment.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(evidence,'source-manifest-before.json'),JSON.stringify(sourceManifest,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(work,'preserved-wip/before.patch'),git(['diff','--binary','--','package.json','test/v12/server-package-cold.test.mjs']),{flag:'wx'});
console.log(JSON.stringify({ok:true,evidence,work,source,preservedWip:preserved,sourceFiles:sourceManifest.length,head,node:process.version}));
