const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process'),assert=require('assert/strict');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6'),runner=path.join(evidence,'run-command.cjs'),candidate=path.join(work,'candidate-three');
const artifacts=JSON.parse(fs.readFileSync(path.join(evidence,'artifacts-final.json'),'utf8')),device=artifacts.artifacts.find(x=>x.product==='mcp-device');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const result={startedAt:new Date().toISOString(),platform:process.platform,node:process.version,steps:[]};
function run(label,cwd,command,args){const r=spawnSync(process.execPath,[runner,label,cwd,command,...args],{stdio:'inherit',windowsHide:true});result.steps.push({label,exitCode:r.status});if(r.status!==0)throw new Error(label+' failed with '+r.status);}
try{
  assert.equal(sha(device.file),device.sha256);
  run('final-cold-windows-device',root,'node',[path.join(evidence,'cold-install.mjs'),'mcp-device',device.file,path.join(work,'windows/final/cold-device'),path.join(evidence,'final-package')]);
  run('root-suite-windows-final',candidate,'npm',['test']);
  for(const item of artifacts.runtimeManifest)assert.equal(sha(path.join(candidate,item.path)),item.sha256,item.path);
  result.runtimeMatchesArtifact=true;
  run('platform-windows-final',candidate,'node',['scripts/v12/run-platform-tests.mjs']);
  result.status='PASS';
}catch(error){result.status='FAIL';result.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{result.endedAt=new Date().toISOString();fs.writeFileSync(path.join(evidence,'windows-final-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));}
