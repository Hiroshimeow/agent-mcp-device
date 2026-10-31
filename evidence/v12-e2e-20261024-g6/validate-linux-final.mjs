import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
assert.equal(process.platform,'linux');
const root='/mnt/e/git-project/agent-mcp-device-v12',evidence=path.join(root,'evidence/v12-e2e-20261024-g6'),runner=path.join(evidence,'run-command.cjs');
const base='/var/tmp/mcp-device-v12-e2e-20261024-g6/final',source='/mnt/e/test/mcp-device-v12-e2e-20261024-g6/candidate-three',target=path.join(base,'platform');
const artifactInfo=JSON.parse(fs.readFileSync(path.join(evidence,'artifacts-final.json'),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const linuxPath=p=>p.replaceAll('\\','/').replace(/^E:/,'/mnt/e');
const result={startedAt:new Date().toISOString(),node:process.version,platform:process.platform,base,steps:[]};
function run(label,cwd,command,args,env=process.env){const r=spawnSync(process.execPath,[runner,label,cwd,command,...args],{env,stdio:'inherit'});result.steps.push({label,exitCode:r.status});if(r.status!==0)throw new Error(label+' failed with '+r.status);}
try{
  for(const product of ['mcp-device','palace']){
    const item=artifactInfo.artifacts.find(x=>x.product===product),archive=linuxPath(item.file);assert.equal(sha(archive),item.sha256);
    run('final-cold-linux-'+product,root,'node',[path.join(evidence,'cold-install.mjs'),product,archive,path.join(base,product),path.join(evidence,'final-package')]);
  }
  const cold=path.join(base,'mcp-device'),installed=path.join(cold,'node_modules/@hcu-lab.me/mcp-device');
  assert.equal(JSON.parse(fs.readFileSync(path.join(cold,'cold-install-receipt.json'),'utf8')).status,'PASS');
  if(fs.existsSync(target))throw new Error('LINUX_FINAL_SNAPSHOT_EXISTS');
  fs.mkdirSync(target);
  const input=JSON.parse(fs.readFileSync(path.join(evidence,'candidate-three-final-source.json'),'utf8'));
  for(const item of input.manifest){const dest=path.join(target,item.path),bytes=fs.readFileSync(path.join(source,item.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256,item.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});}
  for(const dir of ['dist','control-plane','skills','config'])if(fs.existsSync(path.join(installed,dir)))fs.cpSync(path.join(installed,dir),path.join(target,dir),{recursive:true});
  fs.symlinkSync(path.join(cold,'node_modules'),path.join(target,'node_modules'),'dir');
  for(const item of artifactInfo.runtimeManifest)assert.equal(sha(path.join(target,item.path)),item.sha256,item.path);
  fs.writeFileSync(path.join(evidence,'linux-platform-final-source.json'),JSON.stringify({createdAt:new Date().toISOString(),target,sourceSha256:input.sourceSha256,artifactSha256:artifactInfo.artifacts.find(x=>x.product==='mcp-device').sha256,runtimeManifestSha256:artifactInfo.runtimeManifestSha256,runtimeFiles:artifactInfo.runtimeManifest.length},null,2)+'\n',{flag:'wx'});
  run('platform-linux-final',target,'node',['scripts/v12/run-platform-tests.mjs']);
  run('server-cold-linux-final',target,'node',['--test','test/v12/server-package-cold.test.mjs'],{...process.env,MCP_V12_COLD_PACKAGE_ROOT:installed});
  result.status='PASS';
}catch(error){result.status='FAIL';result.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{result.endedAt=new Date().toISOString();fs.writeFileSync(path.join(evidence,'linux-final-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));}
