const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process'),assert=require('assert/strict');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6'),runner=path.join(evidence,'run-command.cjs'),candidate=path.join(work,'candidate-three');
const artifact=JSON.parse(fs.readFileSync(path.join(evidence,'artifacts-final.json'),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const result={startedAt:new Date().toISOString(),platform:process.platform,node:process.version,steps:[],artifactSourceSha256:artifact.sourceSha256,validationSourceSha256:JSON.parse(fs.readFileSync(path.join(evidence,'validation-source-final.json'),'utf8')).sourceSha256};
function run(label,cwd,command,args){const r=spawnSync(process.execPath,[runner,label,cwd,command,...args],{stdio:'inherit',windowsHide:true});result.steps.push({label,exitCode:r.status});if(r.status!==0)throw new Error(label+' failed with '+r.status);}
try{
  assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'green-hardening-cleanup.json'),'utf8')).exitCode,0);
  run('root-suite-windows-after-cleanup',candidate,'npm',['test']);
  for(const x of artifact.runtimeManifest)assert.equal(sha(path.join(candidate,x.path)),x.sha256,x.path);
  result.runtimeMatchesArtifact=true;
  run('platform-windows-final',candidate,'node',['scripts/v12/run-platform-tests.mjs']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'server-suite-linux-final.json'),'utf8')).exitCode,0);
  run('live-cli-1000-windows-final',root,'node',[path.join(evidence,'live-cli-1000.mjs'),path.join(work,'windows/final/cold-device/node_modules/@hcu-lab.me/mcp-device'),path.join(work,'windows/cold-palace/node_modules/@hcu-lab.me/palace'),path.join(work,'windows/final/live-cli-1000'),path.join(evidence,'live-cli-1000-windows-final-result.json')]);
  result.status='PASS';
}catch(error){result.status='FAIL';result.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{result.endedAt=new Date().toISOString();fs.writeFileSync(path.join(evidence,'windows-final-completion.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));}
