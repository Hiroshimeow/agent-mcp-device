import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir = 'evidence/context/';
const git = args => execFileSync('git', args, { encoding: 'utf8' });
const x = git(['rev-parse', 'HEAD']).trim();
const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', '2cb91fc', '6652abf']);
let raw = `Code Commit X_final: ${x}\n$ git merge-base --is-ancestor 2cb91fc 6652abf; echo $?\n${ancestor.status}\n$ git rev-parse 6652abf^\n${git(['rev-parse', '6652abf^'])}$ git log --oneline 2cb91fc..HEAD\n${git(['log', '--oneline', '2cb91fc..HEAD'])}`;
for (const pattern of ['executeLiveCapture|executePublicGateway|executeFeature\\(', `from ['"].*context/(capture|gateway|store|service)`]) raw += `$ git grep -nE ${JSON.stringify(pattern)} -- src\n${git(['grep', '-nE', pattern, '--', 'src'])}`;
for (const [file, from, to] of [['src/device/gateway-tool-adapter.ts', 29, 44], ['src/device/gateway-tool-adapter.ts', 251, 256], ['src/context/tool-contract.ts', 1, 24], ['src/context/authorization.ts', 1, 100], ['src/context/device-adapter.ts', 1, 100], ['test/context/pinned-gates.test.js', 40, 52]]) {
 const lines = fs.readFileSync(file, 'utf8').split('\n'); raw += `\n${file}:${from}-${Math.min(to, lines.length)}\n` + lines.slice(from-1,to).map((line,i)=>`${from+i}: ${line}`).join('\n')+'\n';
}
raw += '\npackage.json files:\n'+JSON.stringify({ files: JSON.parse(fs.readFileSync('package.json')).files }, null, 2)+'\n';
fs.writeFileSync(dir+'checkpoint3-raw-evidence.txt',raw);
const logs = ['checkpoint3-build.txt','checkpoint3-context.tap','checkpoint3-regression.tap','checkpoint3-targeted-red.tap','checkpoint3-raw-evidence.txt'];
fs.writeFileSync(dir+'checkpoint3-artifacts.sha256', logs.map(file=>`${createHash('sha256').update(fs.readFileSync(dir+file)).digest('hex')}  ${dir+file}`).join('\n')+'\n');
fs.writeFileSync(dir+'checkpoint3-footers.txt', ['checkpoint3-context.tap','checkpoint3-regression.tap'].map(file=>file+'\n'+fs.readFileSync(dir+file,'utf8').replace(/\x1b\[[0-9;]*m/g,'').split('\n').slice(-22).join('\n')).join('\n'));
console.log(x);
