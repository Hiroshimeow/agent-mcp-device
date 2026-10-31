const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6');
const candidate=path.join(work,'candidate-three'),dest=path.join(work,'artifacts/final'),runner=path.join(evidence,'run-command.cjs');
const manifest=JSON.parse(fs.readFileSync(path.join(evidence,'candidate-three-final-source.json'),'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const x of manifest.manifest)if(sha(path.join(candidate,x.path))!==x.sha256)throw new Error('SOURCE_CHANGED:'+x.path);
function run(label,cmd,args){const r=spawnSync(process.execPath,[runner,label,candidate,cmd,...args],{stdio:'inherit',windowsHide:true});if(r.status!==0)throw new Error(label+' failed with '+r.status);}
run('device-pack-final','npm',['pack','--json','--pack-destination',dest]);
run('palace-stage-final','node',['scripts/v12/build-palace-package.mjs']);
run('palace-pack-final','npm',['pack',path.join(candidate,'.tmp/v12-palace-standalone/package'),'--json','--pack-destination',dest]);
const artifacts=['mcp-device','palace'].map(product=>{const file=path.join(dest,'hcu-lab.me-'+product+'-1.0.12.tgz');return {product,file,bytes:fs.statSync(file).size,sha256:sha(file)};});
const runtimeManifest=[];function walk(dir){for(const e of fs.readdirSync(path.join(candidate,dir),{withFileTypes:true})){const rel=path.posix.join(dir,e.name);if(e.isDirectory())walk(rel);else runtimeManifest.push({path:rel,sha256:sha(path.join(candidate,rel))});}}walk('dist');
const priorRoot=path.join(work,'windows/cold-device/node_modules/@hcu-lab.me/mcp-device');
const runtimeChangesFromCandidateTwo=runtimeManifest.filter(x=>!fs.existsSync(path.join(priorRoot,x.path))||sha(path.join(priorRoot,x.path))!==x.sha256).map(x=>x.path);
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:'TEST_CANDIDATE_NOT_RELEASED',candidate,sourceSha256:manifest.sourceSha256,artifacts,runtimeChangesFromCandidateTwo,runtimeManifestSha256:crypto.createHash('sha256').update(JSON.stringify(runtimeManifest)).digest('hex'),runtimeManifest};
fs.writeFileSync(path.join(evidence,'artifacts-final.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...result,runtimeManifest:undefined}));
