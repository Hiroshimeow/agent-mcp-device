const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{execFileSync}=require('child_process'),PizZip=require('pizzip');
const root='E:/git-project/agent-mcp-device-v12',evidence=path.join(root,'evidence/v12-e2e-20261024-g6'),prefix='evidence/v12-e2e-20261024-g6/';
const read=n=>JSON.parse(fs.readFileSync(path.join(evidence,n),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const diskPath=p=>p.startsWith('/mnt/e/')?'E:/'+p.slice(7):p;
const report=read('release-checklist.json'),artifact=read('artifacts-final.json'),validation=read('validation-source-final.json');
assert.equal(report.verdict,'RELEASE_BLOCKED_WITH_EVIDENCE');
for(const item of validation.manifest)assert.equal(sha(fs.readFileSync(path.join(root,item.path))),item.sha256,item.path);
for(const item of artifact.artifacts)assert.equal(sha(fs.readFileSync(item.file)),item.sha256,item.file);
for(const file of ['platform-windows-final.json','platform-linux-final.json','server-suite-windows-final.json','server-suite-linux-final.json','core-parity-windows-final.json','root-suite-windows-after-cleanup.json','native-parity-port-free-windows.json']){
 const r=read(file);for(const key of ['stdout','stderr'])assert.equal(sha(fs.readFileSync(diskPath(r[key].path))),r[key].sha256,file+':'+key);
}
const raw=fs.readFileSync(report.liveCli.rawOutput);assert.equal(sha(raw),report.liveCli.rawOutputSha256);
fs.writeFileSync(path.join(evidence,'cli-live-final.jsonl'),raw,{flag:'wx'});
report.liveCli.rawOutputEvidenceCopy='cli-live-final.jsonl';
report.repository.inventory=execFileSync('git',['status','--porcelain=v1','--untracked-files=normal'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
report.repository.inventoryCapturedAt=new Date().toISOString();
report.reviewBundle='D0-review-bundle.zip';
report.verification='final-verification.json';
fs.writeFileSync(path.join(evidence,'release-checklist.json'),JSON.stringify(report,null,2)+'\n');
for(const [file,addition] of [
 ['FINAL_REPORT.md','\nBộ review đã chuẩn bị: [D0-review-bundle.zip](D0-review-bundle.zip), [bundle-manifest.json](bundle-manifest.json). Bản sao raw 1.000 lượt: [cli-live-final.jsonl](cli-live-final.jsonl). Kiểm chứng tệp: [final-verification.json](final-verification.json).\n'],
 ['D0-review-packet.md','\nReview bundle: D0-review-bundle.zip, with bundle-manifest.json and the included source manifest. Prepared locally; not sent. See FINAL_REPORT.md for the completed evidence checkpoint.\n']
])fs.appendFileSync(path.join(evidence,file),addition);
fs.appendFileSync(path.join(root,'specs/008-v12-platform/RUN_STATE.md'),'\nReview bundle sẵn sàng tại evidence/v12-e2e-20261024-g6/D0-review-bundle.zip; chưa gửi. Kiểm chứng cuối: final-verification.json và evidence-index.json cùng thư mục.\n');
const selected=[
'AGENTS.md','LICENSE','package.json','package-lock.json','src/distribution.ts','src/device/device.ts','src/device/core.ts','src/mcp-device.ts',
'scripts/v12/build-palace-package.mjs','scripts/v12/install-palace-skill.cjs','scripts/v12/run-device-parity.mjs','scripts/v12/run-platform-tests.mjs','skills/palace-cli/SKILL.md',
'test/test-canonical-release-cleanup.js','test/test-green-hardening.js','test/test-mcp-device-branding.js','test/test-version-consistency.js',
'specs/008-v12-platform/V12_END_TO_END_COMPLETION_SPEC.md','specs/008-v12-platform/ONE_AGENT_EXECUTION_PROMPT.md','specs/008-v12-platform/plugin-contract.md','specs/008-v12-platform/palace-design.md','specs/008-v12-platform/RUN_STATE.md'
];
function collect(rel){for(const entry of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){const file=path.posix.join(rel,entry.name);assert.equal(entry.isSymbolicLink(),false,file);if(entry.isDirectory())collect(file);else selected.push(file);}}
for(const dir of ['src/platform','src/plugins/palace','src/log-palace','test/v12'])collect(dir);
for(const name of ['D0-review-packet.md','FINAL_REPORT.md','release-checklist.json','implementation-diff.patch','patch-check.json','preservation-and-diff.json','artifacts-final.json','validation-source-final.json','reviews-status.json','parity-interpretation.json','parity-port-free-receipt.json','skill-safety-after.json','skill-safety-after.stdout.log','cli-contract-red.json','cli-contract-red.stdout.log','cli-contract-green.json','platform-windows-final.json','platform-linux-final.json','server-suite-windows-final.json','server-suite-linux-final.json','core-parity-windows-final.json','live-cli-1000-windows-final-result.json','cli-live-final.jsonl'])selected.push(prefix+name);
const zip=new PizZip(),entries=[];
for(const file of [...new Set(selected)].sort()){const bytes=fs.readFileSync(path.join(root,file));zip.file(file,bytes);entries.push({path:file,bytes:bytes.length,sha256:sha(bytes)});}
const readme='# G6 D0 review bundle\n\nStatus: REVIEW_PENDING_G6_ONLY / RELEASE_BLOCKED_WITH_EVIDENCE.\n\nStart at evidence/v12-e2e-20261024-g6/D0-review-packet.md and FINAL_REPORT.md. The source files reproduce the current uncommitted G6 slice; runtime artifacts are identified by SHA-256 in artifacts-final.json. Initial WIP preservation and test limitations are explicit. No reviewer signoff or deployment has occurred. The bundle was prepared locally and has not been sent.\n';
zip.file('REVIEW_BUNDLE_README.md',readme);
zip.file('REVIEW_SOURCE_MANIFEST.json',JSON.stringify({createdAt:new Date().toISOString(),head:report.repository.head,artifactSourceSha256:artifact.sourceSha256,validationSourceSha256:validation.sourceSha256,entries},null,2)+'\n');
const bytes=zip.generate({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
const bundle=path.join(evidence,'D0-review-bundle.zip');fs.writeFileSync(bundle,bytes,{flag:'wx'});
const reopened=new PizZip(fs.readFileSync(bundle));
for(const item of entries)assert.equal(sha(reopened.file(item.path).asNodeBuffer()),item.sha256,item.path);
const meta={schemaVersion:1,createdAt:new Date().toISOString(),file:bundle,bytes:bytes.length,sha256:sha(bytes),entries:entries.length+2,sourceEntries:entries,reopenedAndVerified:true,sent:false,reviewStatus:'REVIEW_PENDING_G6_ONLY'};
fs.writeFileSync(path.join(evidence,'bundle-manifest.json'),JSON.stringify(meta,null,2)+'\n',{flag:'wx'});
const verified={schemaVersion:1,verifiedAt:new Date().toISOString(),status:'PASS_EVIDENCE_CONSISTENCY_ONLY',releaseVerdict:report.verdict,sourceManifestVerified:validation.sourceSha256,artifactManifestVerified:artifact.runtimeManifestSha256,artifactHashes:artifact.artifacts.map(x=>({product:x.product,sha256:x.sha256})),runtimeLogHashesVerified:true,liveRawLines:raw.toString('utf8').trimEnd().split('\n').length,reviewBundleHash:meta.sha256,reviewBundleRoundtripVerified:true,patchApplyCheck:read('patch-check.json').status,unexpectedSourceChanges:read('preservation-and-diff.json').unexpectedChanges,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),externalReview:false,publication:false,deployment:false,activeSoak:false};
assert.equal(verified.head,report.repository.head);assert.equal(verified.liveRawLines,1000);
for(const doc of ['FINAL_REPORT.md','D0-review-packet.md']){const text=fs.readFileSync(path.join(evidence,doc),'utf8');for(const m of text.matchAll(/\]\(([^)]+)\)/g))if(!/^[a-z]+:/.test(m[1])&&m[1]!=='final-verification.json')assert.ok(fs.existsSync(path.resolve(evidence,m[1])),doc+':'+m[1]);}
fs.writeFileSync(path.join(evidence,'final-verification.json'),JSON.stringify(verified,null,2)+'\n',{flag:'wx'});
const index=[];function walk(rel=''){for(const ent of fs.readdirSync(path.join(evidence,rel),{withFileTypes:true})){const file=path.posix.join(rel,ent.name);if(ent.isDirectory())walk(file);else if(file!=='evidence-index.json'){const content=fs.readFileSync(path.join(evidence,file));index.push({path:file,bytes:content.length,sha256:sha(content)});}}}walk();
fs.writeFileSync(path.join(evidence,'evidence-index.json'),JSON.stringify({schemaVersion:1,createdAt:new Date().toISOString(),files:index.length,entries:index},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:verified.status,releaseVerdict:verified.releaseVerdict,sourceManifest:verified.sourceManifestVerified,bundle:{path:bundle,bytes:meta.bytes,sha256:meta.sha256,entries:meta.entries,sent:false},evidenceFiles:index.length,head:verified.head,activeSoak:false}));
