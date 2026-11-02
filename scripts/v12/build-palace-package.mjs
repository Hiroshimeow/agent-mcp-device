#!/usr/bin/env node
// Assemble a separately installable Palace plugin/CLI from the SAME compiled source as MCP Device.
// This is a packaging adapter, not a second engine, MCP endpoint, daemon or knowledge store.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { completeDeclarationClosure, completeRuntimeClosure, verifyPackageImports } from './palace-package-closure.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const workspace=path.join(root,'.tmp','v12-palace-standalone');
// Tests and review tools may assemble packages concurrently. Their consumers must
// never observe another invocation deleting or replacing the directory returned
// here. Release scripts opt into the stable path explicitly.
const output=process.argv.includes('--stable')
  ?path.join(workspace,'package')
  :path.join(workspace,'runs',`${process.pid}-${randomUUID()}`,'package');
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
for(const item of ['dist/plugins/palace/plugin.js','dist/plugins/palace/cli.js','dist/plugins/palace/skill-manager.js','dist/platform/coordination-lock.js','dist/platform/process-identity.js','dist/platform/runtime-root.js','dist/platform/plugin-contract.js','dist/log-palace/store.js','dist/log-palace/formats.js','dist/config.js','LICENSE'])await fs.access(path.join(root,item));
await fs.rm(output,{recursive:true,force:true});
for(const item of ['dist/plugins/palace','dist/log-palace','skills/palace-cli']){
  const target=path.join(output,item);await fs.mkdir(path.dirname(target),{recursive:true});await fs.cp(path.join(root,item),target,{recursive:true});
}
await fs.mkdir(path.join(output,'dist','platform'),{recursive:true});
for(const file of ['coordination-lock.js','process-identity.js','runtime-root.js','plugin-contract.js'])await fs.copyFile(path.join(root,'dist','platform',file),path.join(output,'dist','platform',file));
await fs.copyFile(path.join(root,'dist','config.js'),path.join(output,'dist','config.js'));
await fs.copyFile(path.join(root,'LICENSE'),path.join(output,'LICENSE'));
await fs.mkdir(path.join(output,'scripts'),{recursive:true});
await fs.copyFile(path.join(root,'scripts','v12','install-palace-skill.cjs'),path.join(output,'scripts','install-palace-skill.cjs'));
const { palacePluginManifest } = await import(new URL('../../dist/plugins/palace/manifest.js', import.meta.url));
const pluginManifest={...palacePluginManifest(),version:pkg.version,entry:'dist/plugins/palace/plugin.js'};
await fs.writeFile(path.join(output,'palace.plugin.json'),JSON.stringify(pluginManifest,null,2)+'\n');
const manifest={
  name:'@hcu-lab.me/palace',version:pkg.version,type:'module',license:pkg.license||'MIT',
  description:'Independently installable Palace CLI and PluginHost adapter using the canonical MCP Device implementation.',
  engines:{node:'>=22.13.0'},bin:{palace:'dist/plugins/palace/cli.js'},
  exports:{'.':'./dist/plugins/palace/index.js','./plugin':'./dist/plugins/palace/plugin.js','./cli':'./dist/plugins/palace/cli.js','./skill':'./skills/palace-cli/SKILL.md','./manifest':'./palace.plugin.json'},
  files:['dist','skills/palace-cli','scripts/install-palace-skill.cjs','palace.plugin.json','LICENSE'],
  scripts:{postinstall:'node scripts/install-palace-skill.cjs'},repository:pkg.repository,dependencies:{}
};
await fs.writeFile(path.join(output,'package.json'),JSON.stringify(manifest,null,2)+'\n');

const runtimeClosure=await completeRuntimeClosure(root,output);
const declarations=await completeDeclarationClosure(root,output);
const importClosure=await verifyPackageImports(output);
if(!importClosure.ok)throw new Error('PALACE_IMPORT_CLOSURE_FAILED: '+JSON.stringify(importClosure.unresolved));
console.log(JSON.stringify({ok:true,output,version:pkg.version,independentPackage:manifest.name,importClosure,runtimeClosure,declarations}));
