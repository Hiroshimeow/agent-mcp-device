import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const sourceRoot = 'E:/git-project/agent-mcp-gateway';
const targetRoot = 'E:/git-project/agent-mcp-device-v12';
const expectedHead = '7a5a30b4a5f6226cf65b395ddfa0424677184592';
const sha = String(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot })).trim();
if (sha !== expectedHead) throw new Error('Gateway source revision changed');
const tracked = String(execFileSync('git', ['ls-files', '-z'], { cwd: sourceRoot })).split('\0').filter(Boolean);
const trackedSet = new Set(tracked);
const files = new Set();
const runtimeEntries = ['scripts/authenticated-mcp-wrapper.mjs', 'scripts/admin.mjs', 'scripts/device-admin.mjs'];
const stack = [...runtimeEntries];
for (const file of tracked.filter(f => f.startsWith('tests/') && !f.includes('/.'))) {
  files.add(file);
  if (file.endsWith('.mjs')) stack.push(file);
}
for (const file of tracked.filter(f => f.startsWith('scripts/skills/'))) files.add(file);
for (const file of ['scripts/sync-skills.mjs','scripts/smoke-mcp-schemas.mjs','scripts/check-device-public-contract.mjs']) {
  if (trackedSet.has(file)) stack.push(file);
}
files.add('contracts/device-public-contract-v1.json');
files.add('config/mcp-servers.example.toml');
files.add('LICENSE');
const visited = new Set();
while (stack.length) {
  const file = stack.pop();
  if (visited.has(file)) continue;
  visited.add(file);
  if (!trackedSet.has(file)) throw new Error('Import outside tracked source: '+file);
  files.add(file);
  const text = fs.readFileSync(path.join(sourceRoot,file),'utf8');
  for (const match of text.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)) {
    if (!match[2].startsWith('.')) continue;
    const target = path.relative(sourceRoot,path.resolve(sourceRoot,path.dirname(file),match[2])).replaceAll('\\','/');
    if (fs.existsSync(path.join(sourceRoot,target)) && fs.statSync(path.join(sourceRoot,target)).isFile()) stack.push(target);
  }
}
const rows=[];
for (const file of [...files].sort()) {
  const input=path.join(sourceRoot,file);
  const target=file==='LICENSE'?'control-plane/scripts/GATEWAY-LICENSE.txt':'control-plane/'+file;
  const output=path.join(targetRoot,target);
  if (fs.existsSync(output)) throw new Error('Refusing overwrite '+output);
  const bytes=fs.readFileSync(input);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,bytes);
  rows.push({source:file,target,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,reason:file==='LICENSE'?'Gateway MIT attribution required for redistributed source':file.startsWith('scripts/skills/')?'disk-backed Skills asset':file.startsWith('tests/')?'retained behavioral fixture':file.startsWith('scripts/')?'explicit module import closure':'contract/config fixture'});
}
const manifest={
  schemaVersion:1,sourceRepository:'agent-mcp-gateway',sourceRoot,sourceHead:sha,
  targetProduct:'@hcu-lab.me/mcp-device',targetVersion:'1.0.12',
  strategy:'Explicit reachable control-plane modules, retained tests and disk Skills assets; no Git merge, no runtime/private config copy.',
  entries:runtimeEntries,files:rows,
  excluded:['.git','.runtime','node_modules','private config/mcp-servers.toml','private .env','service/tunnel launchers','legacy product packaging'],
  transformations:'Subsequent edits are visible in target Git diff against these recorded source bytes.'
};
fs.writeFileSync(path.join(targetRoot,'specs/008-v12-platform/gateway-import-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({copied:rows.length,bytes:rows.reduce((n,r)=>n+r.bytes,0),sourceHead:sha,modules:[...files].filter(f=>f.startsWith('scripts/')&&f.endsWith('.mjs')).length}));
