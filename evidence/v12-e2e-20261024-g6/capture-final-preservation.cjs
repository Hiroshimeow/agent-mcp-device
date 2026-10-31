const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync,execFileSync}=require('child_process'),assert=require('assert/strict');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const before=JSON.parse(fs.readFileSync(path.join(evidence,'environment.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(evidence,'source-manifest-before.json'),'utf8'));
const tracked=['src/plugins/palace/cli.ts','src/device/device.ts','test/test-canonical-release-cleanup.js','test/test-mcp-device-branding.js','test/test-version-consistency.js','test/test-green-hardening.js'];
const installer='scripts/v12/install-palace-skill.cjs',added=['test/v12/palace-cli-contract.test.mjs','test/v12/palace-skill-preservation.test.mjs'];
const changed=manifest.filter(x=>sha(path.join(root,x.path))!==x.sha256).map(x=>x.path),unexpected=changed.filter(x=>![...tracked,installer].includes(x));
function tree(dir,rel=''){const out=[];for(const e of fs.readdirSync(path.join(dir,rel),{withFileTypes:true})){const name=path.posix.join(rel,e.name);if(e.isDirectory())out.push(...tree(dir,name));else out.push({path:name,sha256:sha(path.join(dir,name))});}return out.sort((a,b)=>a.path.localeCompare(b.path));}
const dist=tree(path.join(root,'dist')),frozen=tree(path.join(work,'baseline/dist'));
const wip=before.preservedWip.map(x=>{const backup=path.join(work,'preserved-wip',x.path);return {path:x.path,originalSha256:x.sha256,backup,backupSha256:sha(backup),currentSha256:sha(path.join(root,x.path)),intentionalChange:x.path===installer};});
const result={recordedAt:new Date().toISOString(),head:git(['rev-parse','HEAD']),branch:git(['branch','--show-current']),status:git(['status','--porcelain=v1','--untracked-files=normal']),changedSinceStart:changed,unexpectedChanges:unexpected,addedTests:added.map(file=>({path:file,sha256:sha(path.join(root,file))})),preservedWip:wip,canonicalDistUnchanged:JSON.stringify(dist)===JSON.stringify(frozen),canonicalDistFiles:dist.length,canonicalDistManifestSha256:crypto.createHash('sha256').update(JSON.stringify(dist)).digest('hex'),commitsCreated:0,reviewRequiredBeforeCommit:true};
for(const x of wip){assert.equal(x.backupSha256,x.originalSha256,x.path);if(!x.intentionalChange)assert.equal(x.currentSha256,x.originalSha256,x.path);}
assert.deepEqual(unexpected,[]);assert.equal(result.head,before.head);assert.equal(result.branch,before.branch);assert.equal(result.canonicalDistUnchanged,true);
let patch=execFileSync('git',['diff','--no-ext-diff','--no-color','--binary','--',...tracked],{cwd:root,encoding:'utf8',windowsHide:true});
const delta=spawnSync('git',['diff','--no-index','--no-ext-diff','--no-color','--',path.join(work,'preserved-wip',installer),path.join(root,installer)],{encoding:'utf8',windowsHide:true});
assert.ok(delta.status===0||delta.status===1,delta.stderr);
patch+=delta.stdout.replace(/^diff --git .*$/m,'diff --git a/'+installer+' b/'+installer).replace(/^--- .*$/m,'--- a/'+installer).replace(/^\+\+\+ .*$/m,'+++ b/'+installer);
for(const file of added){const text=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');assert.ok(text.endsWith('\n'));const lines=text.slice(0,-1).split('\n');patch+='diff --git a/'+file+' b/'+file+'\nnew file mode 100644\n--- /dev/null\n+++ b/'+file+'\n@@ -0,0 +1,'+lines.length+' @@\n'+lines.map(x=>'+'+x).join('\n')+'\n';}
const patchPath=path.join(evidence,'implementation-diff.patch');fs.writeFileSync(patchPath,patch,{flag:'wx'});
const check=spawnSync('git',['apply','--check','--whitespace=error',patchPath],{cwd:path.join(work,'baseline'),encoding:'utf8',windowsHide:true});
result.patch={path:patchPath,sha256:sha(patchPath),checkExitCode:check.status,checkStdout:check.stdout,checkStderr:check.stderr,applied:false};
fs.writeFileSync(path.join(evidence,'preservation-and-diff.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const parity=path.join(work,'windows/parity-port-free/device-parity-receipt.json'),receipt=JSON.parse(fs.readFileSync(parity,'utf8'));
assert.ok(receipt.completedAt);
fs.copyFileSync(parity,path.join(evidence,'parity-port-free-receipt.json'),fs.constants.COPYFILE_EXCL);
const logs=path.join(evidence,'parity-logs');fs.mkdirSync(logs);
const copied=[];
for(const x of receipt.results){for(const [kind,file] of [['stdout',x.stdoutPath],['stderr',x.stderrPath]]){const dest=path.join(logs,path.basename(path.dirname(file))+'.'+kind+'.log');fs.copyFileSync(file,dest,fs.constants.COPYFILE_EXCL);copied.push({target:x.label,test:x.test,kind,source:file,copy:dest,sha256:sha(dest)});}}
fs.writeFileSync(path.join(evidence,'parity-log-manifest.json'),JSON.stringify(copied,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...result,preservedWip:result.preservedWip.map(x=>({path:x.path,unchanged:x.originalSha256===x.currentSha256,backupMatches:x.originalSha256===x.backupSha256})),status:undefined}));
if(check.status!==0)process.exitCode=1;
