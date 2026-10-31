const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync,spawnSync}=require('child_process'),assert=require('assert/strict');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6'),baseline='E:/git-project/agent-mcp-device',candidate=path.join(work,'candidate-three');
const git=args=>execFileSync('git',['-C',baseline,...args],{encoding:'utf8',windowsHide:true}).trim();
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function manifest(dir,rel=''){const out=[];for(const e of fs.readdirSync(path.join(dir,rel),{withFileTypes:true})){const name=path.posix.join(rel,e.name);if(e.isDirectory())out.push(...manifest(dir,name));else out.push({path:name,sha256:sha(path.join(dir,name))});}return out;}
const before={capturedAt:new Date().toISOString(),baseline,head:git(['rev-parse','HEAD']),trackedStatus:git(['status','--porcelain=v1','--untracked-files=no']),packageVersion:JSON.parse(fs.readFileSync(path.join(baseline,'package.json'),'utf8')).version,distVersion:fs.readFileSync(path.join(baseline,'dist/version.js'),'utf8'),distManifest:manifest(path.join(baseline,'dist'))};
assert.equal(before.head,'1df22e6bca3e4f5fa7bfd94f814c1b7409fd7848');
assert.equal(before.packageVersion,'1.0.11');
fs.writeFileSync(path.join(evidence,'core-parity-baseline-before.json'),JSON.stringify(before,null,2)+'\n',{flag:'wx'});
const output=path.join(work,'windows/core-parity-final');if(fs.existsSync(output))throw new Error('PARITY_OUTPUT_EXISTS');
const env={...process.env,DEVICE_PARITY_BASELINE_REPO:baseline,DEVICE_PARITY_OUTPUT_ROOT:output};
const r=spawnSync(process.execPath,[path.join(evidence,'run-command.cjs'),'core-parity-windows-final',candidate,'node','--test','test/v12/device-core-parity.test.js'],{env,stdio:'inherit',windowsHide:true});
const after={capturedAt:new Date().toISOString(),head:git(['rev-parse','HEAD']),trackedStatus:git(['status','--porcelain=v1','--untracked-files=no']),distUnchanged:JSON.stringify(manifest(path.join(baseline,'dist')))===JSON.stringify(before.distManifest),exitCode:r.status,output};
fs.writeFileSync(path.join(evidence,'core-parity-baseline-after.json'),JSON.stringify(after,null,2)+'\n',{flag:'wx'});
assert.equal(after.head,before.head);assert.equal(after.trackedStatus,before.trackedStatus);assert.equal(after.distUnchanged,true);
process.exitCode=r.status??1;
