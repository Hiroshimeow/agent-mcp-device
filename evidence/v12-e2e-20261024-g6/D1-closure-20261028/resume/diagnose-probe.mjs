// DIAGNOSTIC ONLY. Instrument isolated compiled fixture, never acceptance/source.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PalaceStore} from './dist/plugins/palace/store.js';
const base=process.cwd(),root=await fs.mkdtemp(path.join(os.tmpdir(),'d1-stage-diagnostic-')),home=path.join(root,'home'),data=path.join(root,'data'),pkg=path.join(root,'node_modules/@hcu-lab.me/mcp-device');
await fs.mkdir(pkg,{recursive:true});for(const name of ['dist','skills','package.json'])await fs.cp(path.join(base,name),path.join(pkg,name),{recursive:true});
const cli=path.join(pkg,'dist/plugins/palace/cli.js'),manager=path.join(pkg,'dist/plugins/palace/skill-manager.js');
const env={...process.env,HOME:home,USERPROFILE:home,MCP_DEVICE_SKILL_HOME:home,PALACE_DATA_ROOT:data};delete env.MCP_DEVICE_CONFIG_DIR;delete env.MCP_DEVICE_SKIP_SKILL_INSTALL;delete env.MCP_DEVICE_INSTALL_SKILLS_FORCE;
const install=spawnSync(process.execPath,[cli,'skill','install'],{env,encoding:'utf8',timeout:15000});assert.equal(install.status,0,install.stderr);new PalaceStore(data,'diagnostic').close();
const ledger=path.join(home,'.mcp-device/palace-skill/owners.json'),before=await fs.readFile(ledger);
let c=await fs.readFile(cli,'utf8');
const replace=(s,a,b)=>{assert.ok(s.includes(a),'instrumentation anchor missing: '+a);return s.replace(a,b);};
c=replace(c,'const pkg = packageInfo();','const d = globalThis.__d1 = {start:performance.now()}; const pkg = packageInfo(); d.packageMs=performance.now()-d.start; const probeStart=performance.now();');
c=replace(c,'const skillState = skill.state;','d.probeMs=performance.now()-probeStart; const skillState = skill.state; const rootStart=performance.now();');
c=replace(c,'const explicitDataRoot =','d.runtimeRootMs=performance.now()-rootStart; const explicitDataRoot =');
c=replace(c,'emit(response, maxBytes);','d.remainingMs=performance.now()-rootStart-d.runtimeRootMs; process.stderr.write("D1_STAGES "+JSON.stringify(d)+"\\n"); emit(response, maxBytes);');
await fs.writeFile(cli,c);
let m=await fs.readFile(manager,'utf8');
m=replace(m,'stat = lstatSync(ledgerPath);','const at=performance.now(); stat = lstatSync(ledgerPath); globalThis.__d1.ledgerStatMs=performance.now()-at;');
m=replace(m,"const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));","const at=performance.now(); const text=readFileSync(ledgerPath,'utf8'); globalThis.__d1.ledgerReadMs=performance.now()-at; const parsedAt=performance.now(); const ledger=JSON.parse(text); globalThis.__d1.ledgerParseMs=performance.now()-parsedAt; const validatedAt=performance.now();");
m=replace(m,'validateLedger(ledger);\n        if (ledger.pending)','validateLedger(ledger); globalThis.__d1.ledgerValidateMs=performance.now()-validatedAt;\n        if (ledger.pending)');
await fs.writeFile(manager,m);
const samples=[];const defenderOut=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$s=Get-MpComputerStatus -ErrorAction Stop;$p=Get-MpPreference -ErrorAction Stop;[PSCustomObject]@{AntivirusEnabled=$s.AntivirusEnabled;RealTimeProtectionEnabled=$s.RealTimeProtectionEnabled;DisableRealtimeMonitoring=$p.DisableRealtimeMonitoring;ExclusionPath=$p.ExclusionPath;ExclusionProcess=$p.ExclusionProcess}|ConvertTo-Json -Compress"],{encoding:'utf8',timeout:15000});
assert.equal(defenderOut.status,0,defenderOut.stderr);const defender=JSON.parse(defenderOut.stdout);assert.equal(defender.AntivirusEnabled,true);assert.equal(defender.RealTimeProtectionEnabled,true);assert.equal(defender.DisableRealtimeMonitoring,false);
try{for(let pair=0;pair<200;pair++){for(const skip of pair%2?[true,false]:[false,true]){const child={...env};if(skip)child.MCP_DEVICE_SKIP_SKILL_INSTALL='1';const start=performance.now(),out=spawnSync(process.execPath,[cli,'--data-root',data,'status'],{env:child,cwd:home,encoding:'utf8',timeout:10000});const wallMs=performance.now()-start;assert.equal(out.status,0,out.stderr);const body=JSON.parse(out.stdout);assert.equal(body.skillState,skip?'disabled':'present-recorded');assert.equal(body.skill.verification,'ledger-only');assert.equal(body.skill.observational,true);const stages=JSON.parse(out.stderr.split(/\r?\n/).find(x=>x.startsWith('D1_STAGES ')).slice(10));samples.push({pair,skip,wallMs,...stages});}if(pair%25===24){console.log('DIAGNOSTIC pairs='+String(pair+1));await fs.writeFile(path.join(base,'diagnostic-partial.json'),JSON.stringify(samples,null,2));}}assert.deepEqual(await fs.readFile(ledger),before);const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];const groups={};for(const skip of [false,true]){const rows=samples.filter(x=>x.skip===skip);groups[skip?'skip':'normal']=Object.fromEntries(['wallMs','packageMs','probeMs','ledgerStatMs','ledgerReadMs','ledgerParseMs','ledgerValidateMs','runtimeRootMs','remainingMs'].map(key=>[key,{p95:p95(rows.map(x=>x[key]??0)),max:Math.max(...rows.map(x=>x[key]??0)),mean:rows.reduce((a,x)=>a+(x[key]??0),0)/rows.length}]))}const result={label:'INSTRUMENTED DIAGNOSTIC ONLY; NOT ACCEPTANCE',samplesPerArm:200,defender,ledgerUnchanged:true,ledgerSha256:createHash('sha256').update(before).digest('hex'),groups,samples};await fs.writeFile(path.join(base,'diagnostic-receipt.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(groups,null,2));}finally{await fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50});}
