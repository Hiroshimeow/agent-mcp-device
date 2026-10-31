const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6');
const target=path.join(work,'candidate-three');
if(fs.existsSync(target))throw new Error('CANDIDATE_THREE_EXISTS');
const prior=JSON.parse(fs.readFileSync(path.join(evidence,'candidate-two-source.json'),'utf8'));
fs.mkdirSync(target);
const manifest=[],changed=[];
for(const item of prior.manifest){const source=path.join(root,item.path),dest=path.join(target,item.path),bytes=fs.readFileSync(source),sha256=crypto.createHash('sha256').update(bytes).digest('hex');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});manifest.push({path:item.path,sha256,bytes:bytes.length});if(sha256!==item.sha256)changed.push(item.path);}
fs.cpSync(path.join(work,'candidate-two/dist'),path.join(target,'dist'),{recursive:true});
fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
for(const dir of [path.join(work,'artifacts/final'),path.join(work,'windows/final'),path.join(evidence,'final-package')])fs.mkdirSync(dir,{recursive:true});
const result={recordedAt:new Date().toISOString(),target,manifest,sourceSha256:crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),changedFromCandidateTwo:changed};
fs.writeFileSync(path.join(evidence,'candidate-three-source.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...result,manifest:undefined,fileCount:manifest.length}));
