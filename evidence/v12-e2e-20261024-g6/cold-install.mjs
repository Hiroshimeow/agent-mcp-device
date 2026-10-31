import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const [product,archiveArg,workArg,receiptDirArg]=process.argv.slice(2);
assert.ok(['palace','mcp-device'].includes(product));
const archive=path.resolve(archiveArg),work=path.resolve(workArg);
if(fs.existsSync(work))throw new Error('COLD_INSTALL_DESTINATION_EXISTS');
fs.mkdirSync(work,{recursive:true});
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={schemaVersion:1,product,startedAt:new Date().toISOString(),host:os.hostname(),platform:process.platform,node:process.version,artifact:archive,artifactSha256:sha(archive),work,checks:[]};
const env={...process.env,MCP_DEVICE_SKILL_HOME:path.join(work,'agent-home')};
delete env.MCP_DEVICE_SKIP_SKILL_INSTALL;
delete env.MCP_DEVICE_INSTALL_SKILLS_FORCE;
const npmCommand=process.platform==='win32'?process.execPath:'npm';
const npmPrefix=process.platform==='win32'?[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')]:[];
let plugin;
function record(name,passed,details={}){report.checks.push({name,passed,...details});assert.equal(passed,true,name);}
function npmRun(label,args){
  const stdout=path.join(work,label+'.stdout.log'),stderr=path.join(work,label+'.stderr.log');
  const out=fs.openSync(stdout,'wx'),err=fs.openSync(stderr,'wx'),start=performance.now();
  const r=spawnSync(npmCommand,[...npmPrefix,...args],{cwd:work,env,stdio:['ignore',out,err],windowsHide:true,timeout:600000});
  fs.closeSync(out);fs.closeSync(err);
  report.checks.push({name:label,passed:r.status===0,args,exitCode:r.status,error:r.error?.message,elapsedMs:performance.now()-start,stdout,stdoutSha256:sha(stdout),stderr,stderrSha256:sha(stderr)});
  assert.equal(r.status,0,label+': '+fs.readFileSync(stderr,'utf8').slice(-2000));
}
function bin(args){
  const shim=path.join(work,'node_modules','.bin','palace'+(process.platform==='win32'?'.cmd':''));
  const r=process.platform==='win32'
    ?spawnSync('cmd.exe',['/d','/c',shim,...args],{cwd:work,env,encoding:'utf8',windowsHide:true,timeout:15000})
    :spawnSync(shim,args,{cwd:work,env,encoding:'utf8',timeout:15000});
  report.checks.push({name:'palace-bin',args,passed:r.status===0,exitCode:r.status,stdout:r.stdout,stderr:r.stderr});
  assert.equal(r.status,0,r.stderr);return r.stdout;
}
try{
  fs.writeFileSync(path.join(work,'package.json'),JSON.stringify({name:'v12-cold-acceptance-fixture',private:true,version:'0.0.0'})+'\n',{flag:'wx'});
  npmRun('npm-install',['install','--omit=dev','--no-audit','--no-fund','--save-exact',archive]);
  const packageRoot=path.join(work,'node_modules','@hcu-lab.me',product);
  report.packageRoot=packageRoot;
  const info=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8'));
  report.version=info.version;
  record('package-identity',info.name==='@hcu-lab.me/'+product&&info.version==='1.0.12');
  if(product==='palace'){
    record('no-device-package-dependency',!info.dependencies?.['@hcu-lab.me/mcp-device']&&!fs.existsSync(path.join(work,'node_modules/@hcu-lab.me/mcp-device')));
  }
  record('actual-installed-cli-help',/status\|search/.test(bin(['--help'])));
  record('skill-asset',fs.existsSync(path.join(packageRoot,'skills/palace-cli/SKILL.md')));
  const skillTargets=['.agents/skills/palace-cli/SKILL.md','.pi/agent/skills/palace-cli/SKILL.md'].map(p=>path.join(env.MCP_DEVICE_SKILL_HOME,p));
  report.skillDiscoveryFiles=skillTargets.map(p=>({path:p,exists:fs.existsSync(p)}));
  if(product==='mcp-device')record('default-skill-installation',report.skillDiscoveryFiles.every(x=>x.exists));
  const logs=path.join(work,'fixture-logs'),dataRoot=path.join(work,'fixture-data');
  fs.mkdirSync(logs);fs.writeFileSync(path.join(logs,'events.log'),'Error COLD_PALACE_MARKER: preserve source identity through package installation.\n');
  const imported=await import(pathToFileURL(path.join(packageRoot,'dist/plugins/palace/plugin.js')).href);
  plugin=await imported.createPlugin({dataRoot,deviceId:'cold-'+product+'-fixture',sourceRoots:[logs],projectRoots:[],settings:{autoIndex:false,discoverKnownSources:false}});
  await plugin.start();
  const context={signal:new AbortController().signal,services:{invoke:async()=>{throw new Error('No dependencies permitted in this fixture');}}};
  await plugin.invoke('knowledge.ingest',{},context);
  const status=JSON.parse(bin(['--data-root',dataRoot,'status']));
  record('live-read-only-status',status.ok===true&&status.mode==='read-only'&&status.totals.cards>=1);
  const search=JSON.parse(bin(['--data-root',dataRoot,'search','COLD_PALACE_MARKER','--limit','1']));
  record('live-search',search.returned===1&&search.items.length===1);
  const selected=JSON.parse(bin(['--data-root',dataRoot,'read',search.items[0].id]));
  record('honest-snapshot-evidence',selected.evidenceVerifiedNow===false&&selected.card.id===search.items[0].id);
  const evidence=await plugin.invoke('knowledge.read',{ref:search.items[0].id,evidence:true},context);
  record('canonical-source-byte-verification',evidence.evidence[0].verifiedBytes===true);
  await plugin.stop();plugin=undefined;
  record('persisted-cli-after-writer-stops',JSON.parse(bin(['--data-root',dataRoot,'status'])).totals.cards>=1);
  npmRun('dependency-tree',['ls','--omit=dev','--json']);
  report.status='PASS';
}catch(error){report.status='FAIL';report.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{
  if(plugin)try{await plugin.stop();}catch(error){report.cleanupError=error.message;report.status='FAIL';process.exitCode=1;}
  report.endedAt=new Date().toISOString();
  fs.writeFileSync(path.join(work,'cold-install-receipt.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  if(receiptDirArg){
    const prefix='cold-'+process.platform+'-'+product;
    fs.writeFileSync(path.join(receiptDirArg,prefix+'.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    for(const name of ['npm-install.stdout.log','npm-install.stderr.log','dependency-tree.stdout.log','dependency-tree.stderr.log'])if(fs.existsSync(path.join(work,name)))fs.copyFileSync(path.join(work,name),path.join(receiptDirArg,prefix+'-'+name),fs.constants.COPYFILE_EXCL);
  }
  console.log(JSON.stringify({status:report.status,product,platform:report.platform,node:report.node,artifactSha256:report.artifactSha256,packageRoot:report.packageRoot,checks:report.checks.map(x=>({name:x.name,passed:x.passed})),error:report.error,receipt:path.join(work,'cold-install-receipt.json')}));
}
