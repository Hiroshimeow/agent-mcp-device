const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process'),assert=require('assert/strict');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6'),target=path.join(work,'parity-worktree');
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();assert.equal(head,'1e454c1cdcbe3265892f751034fa389432d65405');
if(fs.existsSync(target))throw new Error('PARITY_WORKTREE_EXISTS');
const input=JSON.parse(fs.readFileSync(path.join(evidence,'validation-source-final.json'),'utf8')),artifact=JSON.parse(fs.readFileSync(path.join(evidence,'artifacts-final.json'),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const item of input.manifest)assert.equal(sha(fs.readFileSync(path.join(root,item.path))),item.sha256,item.path);
execFileSync('git',['worktree','add','--detach',target,head],{cwd:root,stdio:'inherit',windowsHide:true});
for(const item of input.manifest){const dest=path.join(target,item.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,item.path),dest);}
const installed=path.join(work,'windows/final/cold-device/node_modules/@hcu-lab.me/mcp-device');
fs.cpSync(path.join(installed,'dist'),path.join(target,'dist'),{recursive:true});
fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
for(const item of artifact.runtimeManifest)assert.equal(sha(fs.readFileSync(path.join(target,item.path))),item.sha256,item.path);
const result={createdAt:new Date().toISOString(),target,head,sourceSha256:input.sourceSha256,artifactSha256:artifact.artifacts.find(x=>x.product==='mcp-device').sha256,runtimeManifestSha256:artifact.runtimeManifestSha256,status:execFileSync('git',['-C',target,'status','--porcelain=v1'],{encoding:'utf8',windowsHide:true})};
fs.writeFileSync(path.join(evidence,'parity-worktree.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
