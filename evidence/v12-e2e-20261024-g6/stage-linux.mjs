import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const source='/mnt/e/test/mcp-device-v12-e2e-20261024-g6/candidate-two';
const cold='/tmp/mcp-device-v12-e2e-20261024-g6/cold-device';
const installed=path.join(cold,'node_modules/@hcu-lab.me/mcp-device');
const target='/tmp/mcp-device-v12-e2e-20261024-g6/platform';
const evidence='/mnt/e/git-project/agent-mcp-device-v12/evidence/v12-e2e-20261024-g6';
const receipt=JSON.parse(fs.readFileSync(path.join(cold,'cold-install-receipt.json'),'utf8'));
assert.equal(receipt.status,'PASS');assert.equal(process.platform,'linux');
if(fs.existsSync(target))throw new Error('LINUX_SNAPSHOT_EXISTS');
fs.mkdirSync(target);
const input=JSON.parse(fs.readFileSync(path.join(evidence,'candidate-two-source.json'),'utf8')).manifest;
for(const {path:rel} of input){const dest=path.join(target,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,rel),dest);}
for(const dir of ['dist','control-plane','skills','config'])if(fs.existsSync(path.join(installed,dir)))fs.cpSync(path.join(installed,dir),path.join(target,dir),{recursive:true});
fs.symlinkSync(path.join(cold,'node_modules'),path.join(target,'node_modules'),'dir');
const hashes=[];
function walk(dir){for(const ent of fs.readdirSync(path.join(target,dir),{withFileTypes:true})){const rel=path.join(dir,ent.name);if(ent.isDirectory())walk(rel);else hashes.push({path:rel,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(target,rel))).digest('hex')});}}
walk('dist');
const result={schemaVersion:1,createdAt:new Date().toISOString(),platform:process.platform,node:process.version,target,source,installedPackageRoot:installed,artifactSha256:receipt.artifactSha256,runtimeFiles:hashes.length,runtimeManifestSha256:crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),hashes};
fs.writeFileSync(path.join(evidence,'linux-platform-snapshot.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...result,hashes:undefined}));
