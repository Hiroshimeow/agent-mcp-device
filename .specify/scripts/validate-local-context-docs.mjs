// Documentation-only validation. Does not edit product code or planning inputs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const feature = path.join(root, 'specs/002-device-local-context');
const read = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const spec = read(path.join(feature, 'spec.md'));
const tasks = read(path.join(feature, 'tasks.md'));
const required = [
  'spec.md','plan.md','research.md','data-model.md','integration-110.md','quickstart.md','tasks.md',
  'contracts/context-api.md','contracts/context-policy.md','contracts/skill-contract.md',
  'checklists/requirements.md','checklists/implementation-gates.md'
];
const errors = [];
for (const p of required) if (!fs.existsSync(path.join(feature,p))) errors.push('missing: '+p);

const fr = [...spec.matchAll(/^- \*\*(FR-\d{3})\*\*/gm)].map(m=>m[1]);
const sc = [...spec.matchAll(/^- \*\*(SC-\d{3})\*\*/gm)].map(m=>m[1]);
const stories = [...spec.matchAll(/^### User Story (\d+)/gm)].map(m=>'US'+m[1]);
const taskLines = tasks.split('\n').filter(l=>/^- \[[ xX]\] T\d{3}/.test(l));
const entries = taskLines.map(l=>{
  const m=l.match(/^- \[([ xX])\] (T\d{3})(?: (\[P\]))?(?: \[(US\d+)\])? (.+)$/);
  if(!m){errors.push('bad task format: '+l);return null;}
  return {id:m[2],checked:m[1]!==' ',parallel:!!m[3],story:m[4]||'setup-foundation-polish',description:m[5]};
}).filter(Boolean);

for (const [i,t] of entries.entries()) if(t.id!=='T'+String(i+1).padStart(3,'0')) errors.push('nonsequential task: '+t.id);
for (const id of fr) if(!new RegExp('^\\| '+id+' \\|','m').test(tasks)) errors.push('unmapped requirement: '+id);
for (const id of sc) if(!tasks.includes(id+':')) errors.push('unmapped success criterion: '+id);
for (const m of tasks.matchAll(/^\| FR-\d{3} \| ([^\n]+)\|$/gm)) {
  for (const id of m[1].match(/T\d{3}/g)||[]) if(!entries.some(t=>t.id===id)) errors.push('unknown coverage task: '+id);
}
if(fr.length===0 || sc.length===0 || stories.length===0 || entries.length===0) errors.push('empty artifact inventory');
if(entries.some(t=>t.checked)) errors.push('implementation task checked prematurely');

const docs = required.map(p=>path.join(feature,p)).concat(path.join(root,'.specify/memory/constitution.md'));
for(const file of docs){
  const body=read(file);
  if(/\[NEEDS CLARIFICATION:|\[FEATURE\]|\[###-feature-name\]/.test(body)) errors.push('unfilled scaffold: '+path.relative(root,file));
  for(const m of body.matchAll(/\[[^\]\n]+\]\(([^)]+)\)/g)){
    let link=m[1].split('#')[0];
    if(!link||/^[a-z]+:\/\//i.test(link)||link.startsWith('mailto:')) continue;
    const target=path.resolve(path.dirname(file),link);
    if(!fs.existsSync(target) && !['analysis.md','run-report.md'].includes(path.basename(target))) errors.push('broken link: '+path.relative(root,file)+' -> '+link);
  }
}

const manifestPath=path.join(feature,'references/runtime-110-manifest.json');
const snapshots=[];
if(fs.existsSync(manifestPath)){
  const manifest=JSON.parse(read(manifestPath));
  const origin=path.resolve(root,'../wt-mcp-device-110-integrate');
  const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  for(const item of manifest.files||[]){
    const copied=path.join(feature,item.snapshot);
    const live=path.join(origin,item.source);
    const row={source:item.source,snapshot_matches_manifest:fs.existsSync(copied)&&hash(copied)===item.sha256,source_unchanged_since_snapshot:fs.existsSync(live)&&hash(live)===item.sha256};
    snapshots.push(row);
    if(!row.snapshot_matches_manifest) errors.push('snapshot integrity mismatch: '+item.source);
  }
}

const trackedChanges = execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8',cwd:root}).trim().split('\n').filter(Boolean);
if(trackedChanges.length) errors.push('unexpected tracked product changes: '+trackedChanges.join(','));

const report={
  kind:'documentation-validation-not-runtime-acceptance',
  created_at:new Date().toISOString(),
  branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8',cwd:root}).trim(),
  requirements:fr.length,
  success_criteria:sc.length,
  user_stories:stories.length,
  tasks:entries.length,
  unchecked_tasks:entries.filter(t=>!t.checked).length,
  parallel_marked:entries.filter(t=>t.parallel).length,
  task_counts_by_story:entries.reduce((a,t)=>(a[t.story]=(a[t.story]||0)+1,a),{}),
  required_docs:required.length,
  tracked_product_changes:trackedChanges,
  upstream_snapshots:snapshots,
  errors,
  passed:errors.length===0
};
console.log(JSON.stringify(report,null,2));
process.exitCode=errors.length?1:0;
