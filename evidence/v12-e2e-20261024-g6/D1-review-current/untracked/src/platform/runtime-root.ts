import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CapabilityError } from './plugin-contract.js';
import { processBirth, sameProcessNamespace, type ProcessNamespace } from './process-identity.js';

export interface RuntimeRootInspection { root:string; activeLease:boolean; palaceRegistry:boolean; leaseInspectable:boolean; }

async function activeLease(root:string):Promise<{active:boolean;inspectable:boolean}> {
  const file=path.join(root,'server-runtime.lock');
  let body:{pid?:number;processBirth?:string;namespace?:ProcessNamespace};
  try{body=JSON.parse(await fs.readFile(file,'utf8'));}catch{return {active:false,inspectable:true};}
  const pid=Number(body.pid);if(!Number.isSafeInteger(pid)||pid<1)return {active:false,inspectable:false};
  try{process.kill(pid,0);}catch(error){return (error as NodeJS.ErrnoException).code==='ESRCH'?{active:false,inspectable:true}:{active:false,inspectable:false};}
  if(!body.namespace||!body.processBirth)return {active:false,inspectable:false};
  if(!await sameProcessNamespace(body.namespace))return {active:false,inspectable:false};
  const birth=await processBirth(pid);if(birth===null)return {active:false,inspectable:false};
  return {active:birth===body.processBirth,inspectable:true};
}
async function palaceRegistry(root:string):Promise<boolean> {
  try{return Boolean(JSON.parse(await fs.readFile(path.join(root,'plugins','registry.json'),'utf8'))?.plugins?.palace);}
  catch{return false;}
}
export async function inspectRuntimeRoot(root:string):Promise<RuntimeRootInspection> {
  root=path.resolve(root);const [lease,registry]=await Promise.all([activeLease(root),palaceRegistry(root)]);
  return {root,activeLease:lease.active,palaceRegistry:registry,leaseInspectable:lease.inspectable};
}
export async function resolveRuntimeRoot(explicit?:string):Promise<string> {
  if(explicit)return path.resolve(explicit);
  if(process.env.MCP_DEVICE_CONFIG_DIR)return path.resolve(process.env.MCP_DEVICE_CONFIG_DIR);
  const device=path.resolve(os.homedir(),'.mcp-device'),server=path.join(device,'server');
  const rows=await Promise.all([inspectRuntimeRoot(server),inspectRuntimeRoot(device)]);
  const active=rows.filter(row=>row.activeLease);
  if(active.length===1)return active[0].root;
  if(active.length>1)throw new CapabilityError('RUNTIME_AMBIGUOUS',`Multiple MCP Device runtimes are active: ${active.map(x=>x.root).join(', ')}. Pass --runtime-dir explicitly.`);
  const registered=rows.filter(row=>row.palaceRegistry);
  if(registered.length===1)return registered[0].root;
  if(registered.length>1)throw new CapabilityError('RUNTIME_AMBIGUOUS',`Multiple MCP Device runtimes contain Palace: ${registered.map(x=>x.root).join(', ')}. Pass --runtime-dir explicitly.`);
  return server;
}
