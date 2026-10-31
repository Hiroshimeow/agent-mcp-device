// Real cold MCPDevice/Core/PluginHost lifecycle. Only the remote Gateway
// transport is inert: this is not Gateway authentication/rollout acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const dist=new URL('../../dist/',import.meta.url).href;
for(const mode of ['enabled','disabled','faulted'])test(`cold Device ${mode}: real local provider/native lifecycle without a TCP listener`,{timeout:45000},async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'device-cold-local-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:50}));
 const gateway=path.join(root,'inert-gateway.mjs'),loader=path.join(root,'loader.mjs'),script=path.join(root,'fixture.mjs');
 await fs.writeFile(gateway,`export class GatewayDeviceChannel{constructor(options){this.options=options;}async start(){this.options.runtimeState();}async stop(){}updateCapabilities(){return true;}}`);
 await fs.writeFile(loader,`export async function resolve(specifier,context,next){const result=await next(specifier,context);if(result.url===${JSON.stringify(new URL('device/gateway-channel.js',dist).href)})return{url:${JSON.stringify(pathToFileURL(gateway).href)},shortCircuit:true};return result;}`);
 await fs.writeFile(script,`
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import net from 'node:net';import{syncBuiltinESMExports}from'node:module';
const root=${JSON.stringify(root)},mode=${JSON.stringify(mode)};os.homedir=()=>root;syncBuiltinESMExports();
const listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...args){assert.equal(typeof args[0],'string','cold fixture must never open a TCP listener');return listen.apply(this,args);};
process.env.MCP_DEVICE_CONFIG_DIR=path.join(root,'.mcp-device');process.env.MCP_GATEWAY_URL='http://127.0.0.1:1';process.env.MCP_DEVICE_SKIP_SKILL_INSTALL='1';
const [{MCPDevice},{PluginHost},{bundledPluginManifests},{GatewayDeviceIdentity},{probeRuntimeOwner}]=await Promise.all(['device/device.js','platform/plugin-host.js','distribution.js','device/gateway-identity.js','device/runtime-owner.js'].map(x=>import(${JSON.stringify(dist)}+x)));
const state=process.env.MCP_DEVICE_CONFIG_DIR,workspace=path.join(root,'workspace');await fs.mkdir(workspace,{recursive:true});
await fs.mkdir(path.join(state,'logs'),{recursive:true});await fs.writeFile(path.join(state,'logs/shell-fixture.log'),'Error A5_DEVICE_SHELL_MARKER: preserve original evidence during repair.\\n');
const seed=new PluginHost({stateRoot:state,deviceId:'cold-device-fixture'});
await seed.install(bundledPluginManifests().find(x=>x.id==='palace'),{enabled:mode!=='disabled',settings:{autoIndex:false,discoverKnownSources:false}});await seed.close();
if(mode==='faulted'){const registry=JSON.parse(await fs.readFile(seed.registryPath,'utf8'));registry.revision++;registry.plugins.palace.state='faulted';registry.plugins.palace.error='PLUGIN_START_FAILED: cold persisted fault';await fs.writeFile(seed.registryPath,JSON.stringify(registry));}
// The enrollment fixture exists only below this test's disposable home.
await fs.writeFile(path.join(state,'gateway-config.json'),JSON.stringify({version:1,gatewayUrl:'http://127.0.0.1:1',allowedRoots:[workspace],proxy:{mode:'direct'},securityProtocolFloor:1}));
const identity=new GatewayDeviceIdentity();await identity.loadOrCreate();await identity.markEnrolled();
const beforeIdentity=await fs.readFile(path.join(state,'gateway-identity.json'),'utf8');
const device=new MCPDevice();const started=performance.now();
try{
 await device.start();console.log('A5_STAGE:started');assert.ok(performance.now()-started<15000,'cold local startup exceeds 15s bound');
 const core=device.core;assert.ok(core,'real Device must own the real PlatformDeviceCore');assert.ok((await probeRuntimeOwner()).pid===process.pid);
 assert.ok(core.capabilities.includes('platform.invoke'));assert.ok(core.capabilities.some(x=>!x.startsWith('knowledge.')&&!x.startsWith('platform.')),'native capabilities survive every plugin mode');
 const record=core.plugins.list().find(x=>x.manifest.id==='palace');assert.equal(record.state,mode);
 assert.equal(core.capabilities.includes('knowledge.search'),mode==='enabled');
 if(mode==='enabled'){
  const result=await core.invoke('knowledge.search',{query:'cold fixture',scope:'all'});assert.ok(Array.isArray(result.items));
  const pid=core.plugins.drivers.get('palace').child.pid;assert.notEqual(pid,process.pid);assert.doesNotThrow(()=>process.kill(pid,0));
  // Real Device shell adapter; only command shims point at the isolated compile.
  // No package install, live runtime, remote transport, or source-root mutation.
  const bin=path.join(workspace,'bin');await fs.mkdir(bin);
  for(const [name,module] of [['palace','plugins/palace/cli.js'],['mcp-device','mcp-device.js']]){
   const target=new URL(module,${JSON.stringify(dist)});const file=decodeURIComponent(target.pathname).replace(/^\\/([A-Za-z]:)/,'$1');
   const shim=path.join(bin,name+(process.platform==='win32'?'.cmd':''));
   await fs.writeFile(shim,process.platform==='win32'?'@echo off\\r\\n"'+process.execPath+'" "'+file+'" %*\\r\\n':'#!/bin/sh\\nexec "'+process.execPath+'" "'+file+'" "$@"\\n');if(process.platform!=='win32')await fs.chmod(shim,0o700);
  }
  process.env.PATH=bin+path.delimiter+process.env.PATH;
  const shell=async command=>{const out=await core.invoke('shell_execute',{command,working_directory:workspace,timeout_ms:10000});assert.equal(out.timedOut,false);return out;};
  console.log('A5_STAGE:ingest');await core.invoke('knowledge.ingest',{});console.log('A5_STAGE:shell');
  const available=await shell('palace status');assert.equal(available.exitCode,0,JSON.stringify(available));assert.equal(JSON.parse(available.stdout).runtimeDir,state);
  const search=await shell('palace search A5_DEVICE_SHELL_MARKER --limit 1 --max-bytes 8000');assert.equal(search.exitCode,0,JSON.stringify(search));const found=JSON.parse(search.stdout);assert.ok(found.items.length>0,'shell must retrieve ingested fixture evidence');
  const read=await shell('palace read '+found.items[0].id+' --max-bytes 16000');assert.equal(read.exitCode,0,JSON.stringify(read));assert.equal(JSON.parse(read.stdout).card.id,found.items[0].id);
  const disabled=await shell('mcp-device plugins disable palace');assert.equal(disabled.exitCode,0,JSON.stringify(disabled));
  const unavailable=await shell('palace status');assert.equal(unavailable.exitCode,1);assert.equal(JSON.parse(unavailable.stdout).code,'PALACE_DISABLED');
  process.send?.({a5:true,transport:'real isolated Device shell_execute adapter; Gateway inert',commands:['palace status','palace search A5_DEVICE_SHELL_MARKER --limit 1 --max-bytes 8000','palace read <fixture-id> --max-bytes 16000','mcp-device plugins disable palace','palace status'],disabledCode:'PALACE_DISABLED'});
  const deadline=Date.now()+6000;while(core.capabilities.includes('knowledge.search')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));assert.equal(core.capabilities.includes('knowledge.search'),false);
  const stoppedBy=Date.now()+6000;let alive=true;while(alive&&Date.now()<stoppedBy){try{process.kill(pid,0);await new Promise(r=>setTimeout(r,25));}catch(error){assert.equal(error.code,'ESRCH');alive=false;}}assert.equal(alive,false,'external disable must terminate the old child, not only hide its capabilities');
 }
 assert.equal(await fs.readFile(path.join(state,'gateway-identity.json'),'utf8'),beforeIdentity,'local provider lifecycle must not mutate fixture identity');
}finally{console.log('A5_STAGE:shutdown');await device.shutdown();}
assert.equal(await probeRuntimeOwner(),null);process.send?.({ok:true,mode,elapsedMs:performance.now()-started});process.disconnect();
`);
 const child=spawn(process.execPath,['--experimental-loader',pathToFileURL(loader).href,script],{env:{...process.env,HOME:root,USERPROFILE:root,MCP_DEVICE_CONFIG_DIR:path.join(root,'.mcp-device'),MCP_GATEWAY_URL:'http://127.0.0.1:1',MCP_DEVICE_SKIP_SKILL_INSTALL:'1'},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
 let stdout='',stderr='',receipt;child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.on('message',value=>{if(value.a5)t.diagnostic(JSON.stringify(value));else receipt=value;});
 const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 const timer=setTimeout(()=>child.kill(),40000);try{assert.equal(await exit,0,stdout+'\n'+stderr);assert.equal(receipt?.ok,true);t.diagnostic(JSON.stringify(receipt));}finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){child.kill();await exit;}}
});
