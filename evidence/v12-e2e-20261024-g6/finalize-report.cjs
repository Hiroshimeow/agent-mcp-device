const config={
  "gates": [
    {
      "id": "S0",
      "state": "BLOCKED",
      "summary": "Đã chụp G6 và bảo toàn WIP; G8 và review D0 nằm ngoài phạm vi chỉ G6 hiện hành.",
      "evidence": [
        "environment.json",
        "preservation-and-diff.json",
        "D0-review-packet.md"
      ]
    },
    {
      "id": "S1",
      "state": "FAIL",
      "summary": "Cold install hai gói trên hai OS đạt; liên kết Skill hỏng sau di chuyển gói vẫn tái hiện. Lifecycle upgrade/disable/uninstall và notice của gói độc lập chưa khép lại.",
      "evidence": [
        "final-package/cold-win32-mcp-device.json",
        "final-package/cold-linux-mcp-device.json",
        "cold-win32-palace.json",
        "final-package/cold-linux-palace.json",
        "skill-safety-after.json"
      ]
    },
    {
      "id": "S2",
      "state": "BLOCKED",
      "summary": "Read-only CLI, budget, evidence semantics và 1.000 live reads đạt. Chính sách mutation/learning khi runtime hoạt động chưa được D0 chấp thuận và kiểm chứng.",
      "evidence": [
        "cli-contract-green.json",
        "platform-windows-final.json",
        "live-cli-1000-windows-final-result.json"
      ]
    },
    {
      "id": "S3",
      "state": "NOT_RUN",
      "summary": "Chưa có phiên Pi/Codex thật tự khám phá và dùng Skill; việc tạo tệp Skill trong HOME fixture không thay thế gate này.",
      "evidence": [
        "final-package/cold-win32-mcp-device.json",
        "final-package/cold-linux-mcp-device.json"
      ]
    },
    {
      "id": "S4",
      "state": "NOT_RUN",
      "summary": "Chưa có hai candidate từ công việc thật, procedure được tái hiện độc lập hoặc corpus truy vấn thực được gán nhãn trước.",
      "evidence": []
    },
    {
      "id": "S5",
      "state": "NOT_RUN",
      "summary": "0 cặp A/B với usage từ provider; input/output/billed tokens và CI chưa đo. Tiết kiệm token: NOT_PROVEN.",
      "evidence": [
        "actual-token-ab.json"
      ]
    },
    {
      "id": "S6",
      "state": "FAIL",
      "summary": "Platform 87/87 và server 42/42 mỗi OS đạt; Core comparator đạt. Native parity còn ba lỗi ở cả v11/v12, hai no-op bị loại khỏi acceptance, và các nhóm/cross-OS/upgrade chưa chạy đủ.",
      "evidence": [
        "platform-windows-final.json",
        "platform-linux-final.json",
        "server-suite-windows-final.json",
        "server-suite-linux-final.json",
        "core-parity-windows-final.json",
        "parity-interpretation.json"
      ]
    },
    {
      "id": "S7",
      "state": "NOT_RUN",
      "summary": "Chưa chạy soak 24 giờ hoặc so sánh tải nền/CPU/RSS của writer. Stress 1.000 CLI ngắn không được tính là soak.",
      "evidence": [
        "soak-status.json",
        "live-cli-1000-windows-final-result.json"
      ]
    },
    {
      "id": "S8",
      "state": "BLOCKED",
      "summary": "Chưa cập nhật G8, chưa có production rollback verification; phạm vi chỉ G6 và các release gate chưa qua.",
      "evidence": [
        "runtime-after.json",
        "g6-after-metadata.json"
      ]
    },
    {
      "id": "S9",
      "state": "BLOCKED",
      "summary": "Không triển khai fleet. FJP được loại trừ; Z99 offline và chưa có artifact/lệnh nâng cấp được chấp nhận.",
      "evidence": [
        "../fleet-rollout.json"
      ]
    }
  ],
  "blockers": [
    {
      "id": "B1",
      "owner": "D0 reviewer / execution scope",
      "detail": "Đặc tả yêu cầu M365 Opus 5.5 trên FJP. Chỉ dẫn hiện hành chỉ cho G6, nên D0 chưa gửi; D1–D3 chưa chạy."
    },
    {
      "id": "B2",
      "owner": "S1 Skill lifecycle",
      "detail": "Dangling managed Skill link sau package relocation; chưa có ownership record đủ để sửa/gỡ link an toàn. Copy có khác biệt được bảo toàn nên upgrade bản copy cũ còn hạn chế."
    },
    {
      "id": "B3",
      "owner": "S1 package closure",
      "detail": "Inventory tarball Palace không có LICENSE trong khi package khai báo MIT; cần đưa notice phù hợp vào trước phân phối công khai."
    },
    {
      "id": "B4",
      "owner": "D0 / S2 mutation contract",
      "detail": "Chưa quyết định có review liệu chỉ cho mutation khi runtime dừng có đủ cho agent workflow, hay cần mở rộng control path của writer hiện có."
    },
    {
      "id": "B5",
      "owner": "S3–S5 real validation",
      "detail": "Chưa có real agent discovery/use, independently validated real procedure, corpus held-out và 20 paired tasks có actual provider token usage."
    },
    {
      "id": "B6",
      "owner": "S6 parity harness and coverage",
      "detail": "Ba paired failures: expected edit-success text, root-directory fixture đặt C:/ trong khi home fixture nằm E:, và Windows directory symlink EPERM. Chưa waiver hoặc đổi baseline; root runner có no-op và sanitizer test dùng local copy thay vì production function."
    },
    {
      "id": "B7",
      "owner": "S7 soak",
      "detail": "Không có soak >=24h hoặc số đo so sánh CPU/RSS/background load trên artifact cuối."
    },
    {
      "id": "B8",
      "owner": "S8–S9 release",
      "detail": "Chưa có D3 SHIP, backup/rollback production được xác minh, G8 update, fleet rollout hoặc offline Z99 package preparation được chấp nhận."
    }
  ]
};

const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6');
const read=name=>JSON.parse(fs.readFileSync(path.join(evidence,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(evidence,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const text=(name,value)=>fs.writeFileSync(path.join(evidence,name),value,{flag:'wx'});
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const q=x=>String.fromCharCode(96)+x+String.fromCharCode(96);
const link=x=>'['+x+']('+x+')';
const now=new Date().toISOString(),artifacts=read('artifacts-final.json'),preservation=read('preservation-and-diff.json'),patch=read('patch-check.json'),runtime=read('runtime-after.json'),g6=read('g6-after-metadata.json');
assert.equal(read('windows-final-completion.json').status,'PASS');assert.equal(read('linux-final-result.json').status,'PASS');assert.equal(patch.status,'PASS');
for(const a of artifacts.artifacts)assert.equal(sha(a.file),a.sha256);
const suites=['platform-windows-final.json','platform-linux-final.json','server-suite-windows-final.json','server-suite-linux-final.json','core-parity-windows-final.json'].map(name=>({file:name,...read(name)}));
for(const r of suites){assert.equal(r.exitCode,0);assert.equal(r.counts.fail,0);assert.equal(r.counts.skipped,0);assert.ok(r.counts.tests>0);}
const rootSuite=read('root-suite-windows-after-cleanup.json');
assert.equal(rootSuite.exitCode,0);
const rootOutput=fs.readFileSync(rootSuite.stdout.path,'utf8').replace(/\x1b\[[0-9;]*m/g,'');
assert.match(rootOutput,/Total tests:\s+66/);assert.match(rootOutput,/Passed:\s+66/);assert.match(rootOutput,/Failed:\s+0/);
const live=read('live-cli-1000-windows-final-result.json');
assert.equal(live.status,'PASS');assert.equal(live.samples.length,1000);assert.equal(live.errors.length,0);
const rawLive=fs.readFileSync(live.rawOutput,'utf8').trimEnd().split('\n');assert.equal(rawLive.length,1000);
const parity=read('parity-port-free-receipt.json');
const noOp=parity.results.filter(x=>x.test==='test/test-error-sanitization.js');
assert.equal(noOp.length,2);
const interpretation={schemaVersion:1,recordedAt:now,rawSummary:parity.summary,reportedRows:parity.results.length,excludedFromAcceptance:noOp.map(x=>({target:x.label,test:x.test,reason:'DIRECT URL/path guard is false; no test body ran. The file also copies sanitizer logic instead of importing the production implementation.'})),pairedFailures:[...new Set(parity.results.filter(x=>x.status==='FAIL').map(x=>x.test))].map(test=>({test,baseline:parity.results.find(x=>x.label==='baseline'&&x.test===test)?.status,candidate:parity.results.find(x=>x.label==='candidate'&&x.test===test)?.status})),coreComparatorStatus:parity.results.find(x=>x.label==='comparator')?.status,verdict:'FAIL_INCOMPLETE_PARITY',waiver:false,note:'35 reported PASS rows include 2 no-ops; do not claim 35 executed production checks. Matching failures are evidence of pre-existing/harness issues, not a waiver or proof of full parity.'};
write('parity-interpretation.json',interpretation);
const tokens={schemaVersion:1,status:'NOT_RUN',savingsVerdict:'NOT_PROVEN',pairedTasks:0,requiredPairedTasks:20,baseline:{inputTokens:null,outputTokens:null,billedTokens:null,billedCost:null},treatment:{inputTokens:null,outputTokens:null,billedTokens:null,billedCost:null},correctnessDifference:null,pairedBootstrap95CI:null,rawProviderUsage:[],reason:'Real agent/provider measurement and held-out evaluation have not been run. CLI bytes, MCP schema estimates and tool counters are not token-usage evidence.'};
write('actual-token-ab.json',tokens);
const soak={schemaVersion:1,status:'NOT_RUN',requiredDurationHours:24,measuredSoakDurationHours:0,activeSessionId:null,startedAt:null,endedAt:null,stressReceipt:'live-cli-1000-windows-final-result.json',stressDurationMs:live.elapsedMs,resourceComparison:'NOT_RUN',reason:'Current candidate has open release gates; the short synthetic operational stress was not substituted for a 24-hour soak.'};
write('soak-status.json',soak);
const reviews=['D0','D1','D2','D3'].map(gate=>({gate,status:gate==='D0'?'REVIEW_PENDING_G6_ONLY':'NOT_RUN',requiredModel:'M365 Opus 5.5',requiredHost:'FJP',turnId:null,verifiedModelLabel:null,verdict:null,sent:false}));
write('reviews-status.json',{schemaVersion:1,recordedAt:now,reviews,packet:'D0-review-packet.md',scopeReason:'Only G6 via md is authorized by the latest user instruction.'});
const oldFleet=read('fleet-before.json'),newFleet=read('fleet-after-metadata.json');
const fleet={schemaVersion:1,recordedAt:now,status:'BLOCKED_RELEASE_GATES',deploymentAttempted:false,acceptedArtifactSha256:null,testCandidates:artifacts.artifacts.map(x=>({product:x.product,sha256:x.sha256})),devices:oldFleet.devices.map(b=>{const a=newFleet.devices.find(x=>x.deviceId===b.deviceId);const excluded=b.name==='fjp',offline=a?.online===false;return {deviceId:b.deviceId,name:b.name,host:b.host,os:b.os,oldAgentVersion:b.oldAgentVersion,observedAgentVersionAfter:a?.agentVersion??null,originalIdentity:b.originalIdentity,observedIdentityAfter:a?.deviceId??null,onlineAfter:a?.online??null,connectionEpochBefore:b.connectionEpoch,connectionEpochAfter:a?.connectionEpoch??null,usageBefore:b.usageBefore,usageAfter:a?.usage??null,state:excluded?'EXCLUDED_BY_USER':offline?'DEFERRED_OFFLINE':'BLOCKED',reason:excluded?'FJP is excluded from rollout':offline?'Offline; no accepted release artifact or safe upgrade command exists yet':'Release gates incomplete; no deployment attempted',deploymentAttempted:false,artifactSha256:null,rollbackVerified:false,offlinePreparationComplete:false,safeUpgradeCommand:null};})};
fs.writeFileSync(path.join(root,'evidence/fleet-rollout.json'),JSON.stringify(fleet,null,2)+'\n',{flag:'wx'});
const report={schemaVersion:1,recordedAt:now,verdict:'RELEASE_BLOCKED_WITH_EVIDENCE',version:'1.0.12',scope:'G6 only via md; Windows and WSL Ubuntu-22.04',repository:{path:root,head:preservation.head,branch:preservation.branch,dirty:true,commitsCreated:0,reviewRequiredBeforeCommit:true,inventory:preservation.status},artifactSourceSha256:artifacts.sourceSha256,validationSourceSha256:read('validation-source-final.json').sourceSha256,artifacts:artifacts.artifacts,gates:config.gates,blockingIssues:config.blockers,tests:suites.map(x=>({file:x.file,command:[x.command,...x.args],startedAt:x.startedAt,endedAt:x.endedAt,exitCode:x.exitCode,counts:x.counts,node:x.node,platform:x.platform})),rootRunner:{file:'root-suite-windows-after-cleanup.json',exitCode:0,modulesReported:66,modulesReportedPass:66,assertionCount:null,everyModuleExecutesAssertions:false},liveCli:{status:live.status,reads:1000,errors:0,appendedRecords:live.appendedRecords,finalCards:live.finalCards,elapsedMs:live.elapsedMs,latencyMs:live.latencyMs,concurrency:live.concurrency,fixtureKind:live.fixtureKind,secondLeaseDenied:live.secondLeaseDenied,leaseHeldThroughout:live.leaseHeldThroughout,integrity:live.integrity,rawOutput:live.rawOutput,rawOutputSha256:sha(live.rawOutput),performanceComparison:false,concurrentParityWorkload:true},actualTokenAB:tokens,soak,reviews,production:{deploymentAttempted:false,G8Verified:false,G6ObservedVersion:g6.agentVersion,protectedListenersPreserved:runtime.expectedOwnersPreserved,port8104Released:runtime.port8104Released,isolatedStateRestore:'PASS',productionRollback:'NOT_RUN'},preservation:{unexpectedChanges:preservation.unexpectedChanges,canonicalDistUnchanged:preservation.canonicalDistUnchanged,canonicalDistFiles:preservation.canonicalDistFiles,allInitialWipBackupsMatch:true,initialWipModifiedOnly:'scripts/v12/install-palace-skill.cjs',patchCheck:patch.status,patchSha256:patch.patchSha256},nextSafeAction:'D0 packet is ready. Review on the required FJP/Opus workflow needs scope beyond the current G6-only instruction. Resolve the ownership/packaging and parity blockers, then run real agent/learning/token gates, final-artifact soak and D3 before any deployment.'};
for(const gate of report.gates)for(const file of gate.evidence)assert.ok(fs.existsSync(path.join(evidence,file)),file);
write('release-checklist.json',report);
const rows=(header,body)=>['| '+header.join(' | ')+' |','| '+header.map(()=> '---').join(' | ')+' |',...body.map(row=>'| '+row.join(' | ')+' |')].join('\n');
const lines=[
'# MCP Device v12 + Palace — báo cáo G6',
'',
'**RELEASE_BLOCKED_WITH_EVIDENCE**',
'',
'Đã sửa các lỗi có bằng chứng, đóng gói và kiểm tra bản ứng viên trên Windows/WSL của G6. Các gate phát hành còn thiếu hoặc thất bại được giữ nguyên trạng thái; không có phê duyệt Opus, npm publish, tag, push hay triển khai.',
'',
'## 1. Nguồn, phiên bản và bảo toàn',
'',
'- Phiên bản ứng viên: '+q(report.version)+'. Kho: '+q(root)+'.',
'- Nhánh: '+q(report.repository.branch)+'; HEAD: '+q(report.repository.head)+'.',
'- Working tree còn dirty; không tạo commit khi các slice chưa được review bắt buộc.',
'- Nguồn build: '+q(report.artifactSourceSha256)+'. Nguồn validation sau sửa cleanup của test: '+q(report.validationSourceSha256)+'. Runtime sau rebuild được xác nhận trùng toàn bộ manifest tarball.',
'- Bảy WIP/đặc tả ban đầu có bản sao byte-identical. Chỉ installer WIP được sửa có chủ đích; các WIP khác giữ nguyên. Không có thay đổi ngoài danh sách dự kiến; 347 tệp dist của kho chính không đổi.',
'- Diff: '+link('implementation-diff.patch')+'; kiểm tra áp vào trước-image: '+link('patch-check.json')+' (PASS, không thực sự apply vào baseline). Kiểm kê: '+link('preservation-and-diff.json')+'.',
'',
'Các thay đổi: CLI giữ ngân sách byte gồm newline và abstain truy vấn rỗng token; installer giữ bản Skill đã sửa/thêm tệp; fallback phiên bản đồng bộ 1.0.12; test hợp đồng theo v12; test Windows chờ owned child đóng trước khi xóa cwd. Hai file regression mới: palace-cli-contract và palace-skill-preservation.',
'',
'## 2. Artifact bất biến — chưa được chấp nhận phát hành',
'',
rows(['Gói','Bytes','SHA-256'],artifacts.artifacts.map(a=>[a.product,String(a.bytes),q(a.sha256)])),
'',
...artifacts.artifacts.map(a=>'- '+a.product+': '+q(a.file)),
'',
'Manifest đầy đủ: '+link('artifacts-final.json')+'. Gói Palace không có dependency tới MCP Device. Inventory của Palace hiện thiếu tệp LICENSE; cần khép lại trước phân phối công khai.',
'',
'## 3. S0–S9',
'',
rows(['Gate','Trạng thái','Kết quả / phần thiếu','Bằng chứng'],config.gates.map(g=>[g.id,g.state,g.summary,g.evidence.map(link).join(' · ')||'Chưa chạy'])),
'',
'## 4. Hai demo cài đặt đã thực hiện',
'',
'Các demo dùng npm install --omit=dev --no-audit --no-fund --save-exact trên tarball thật, scripts bật, prefix mới và MCP_DEVICE_SKILL_HOME riêng. Không dựa vào node_modules của checkout.',
'',
rows(['Demo','Windows','Linux','Hành vi kiểm chứng'],[
['Palace độc lập',link('cold-win32-palace.json'),link('final-package/cold-linux-palace.json'),'Không có gói Device; bin Palace thật; plugin ingest/search/read; evidence gốc được xác minh; dữ liệu đọc lại được sau stop'],
['MCP Device mặc định',link('final-package/cold-win32-mcp-device.json'),link('final-package/cold-linux-mcp-device.json'),'Default Palace và Skill trong .agents/skills, .pi/agent/skills của HOME fixture; CLI và source verification qua gói đã cài']
]),
'',
'Vị trí Windows: '+q(path.join(work,'windows/cold-palace'))+' và '+q(path.join(work,'windows/final/cold-device'))+'. Linux cuối: '+q('/var/tmp/mcp-device-v12-e2e-20261024-g6/final/palace')+' và '+q('/var/tmp/mcp-device-v12-e2e-20261024-g6/final/mcp-device')+'.',
'',
'Generic host disable trong server E2E giữ native read_file hoạt động và cached evidence dùng được. Đây không thay thế demo uninstall/upgrade package+Skill: dangling-link và cleanup lifecycle vẫn chưa đạt. Không tuyên bố agent thật đã tự khám phá Skill.',
'',
'## 5. CLI live, evidence và learning',
'',
'Các lệnh thực: palace --data-root <fixture-data> status; search COLD_PALACE_MARKER --limit 1; read <ID trả về>. Status/search/read trả ok=true, mode=read-only. Read báo evidenceVerifiedNow=false; kiểm chứng qua canonical provider trả verifiedBytes=true cho byte nguồn gốc. Các fixture nằm trong receipt cold tương ứng.',
'',
'Artifact cuối chạy 1.000 CLI process, concurrency 4, luân phiên status/search/read/skills trong khi process Palace qua generic PluginHost index log bổ sung. Kết quả: 1.000/1.000, 0 lỗi, '+live.appendedRecords+' append, '+live.finalCards+' cards cuối, integrity_check=ok, writer lease thứ hai bị từ chối.',
'',
'Thời gian '+(live.elapsedMs/1000).toFixed(3)+' giây; p50 '+live.latencyMs.p50.toFixed(2)+' ms, p95 '+live.latencyMs.p95.toFixed(2)+' ms, p99 '+live.latencyMs.p99.toFixed(2)+' ms. Lượt này có workload parity khác trên G6; đây không phải so sánh hiệu năng được cô lập. RSS trong harness là của harness, không phải writer.',
'',
'Raw 1.000 lượt: '+q(live.rawOutput)+'. Receipt: '+link('live-cli-1000-windows-final-result.json')+'. Đây là fixture vận hành tổng hợp; chưa có một procedure từ công việc thật được tác tử độc lập tái hiện và chấp nhận.',
'',
'## 6. A/B actual token',
'',
rows(['Điều kiện','Số cặp','Input tokens','Output tokens','Billed tokens/cost','Correctness / paired 95% CI'],[['Baseline','0','Chưa đo','Chưa đo','Chưa đo','Chưa đo'],['Palace treatment','0','Chưa đo','Chưa đo','Chưa đo','Chưa đo']]),
'',
'**Token savings: NOT_PROVEN.** Không suy từ byte JSON, số cards, MCP schema estimate hoặc bộ đếm tool. Thiết kế held-out, tối thiểu 20 cặp, raw provider usage và checker độc lập chưa chạy. '+link('actual-token-ab.json')+'.',
'',
'## 7. Kiểm thử, parity và giới hạn',
'',
rows(['Nhóm','Windows','Linux','Giới hạn'],[
['Platform','87/87 PASS, 0 skip','87/87 PASS, 0 skip','Runtime đối chiếu với manifest artifact'],
['Server','42/42 PASS, 0 skip','42/42 PASS, 0 skip','Fixture xác thực/OAuth/pairing/restore; default catalog không có knowledge.*'],
['Root npm test','66/66 module exit 0','Chưa chạy toàn bộ root runner','Một số entrypoint legacy no-op; không tính thành 66 assertion suites'],
['Core comparator v11/v12','PASS: 14 result families + 4 side-effect families','Chưa chạy comparator native tương ứng','Frozen v11 HEAD/dist không bị sửa'],
['Port-free exported parity','35 reported PASS / 6 FAIL trên 41 hàng','Chưa chạy','2 PASS sanitizer là no-op bị loại khỏi acceptance; ba lỗi lặp trên cả hai phiên bản']
]),
'',
'Các failed paired suites: test-edit-block-occurrences.js (success-message assertion); test-allowed-directories.js (C:/ root trong khi isolated home ở E:); test-symlink-security.js (EPERM khi tạo directory symlink). Không xóa lỗi, sửa baseline hoặc dùng việc cả hai cùng fail làm waiver. Xem '+link('parity-interpretation.json')+', '+link('parity-port-free-receipt.json')+' và '+link('parity-log-manifest.json')+'.',
'',
'Full server suite có các compatibility fixture chủ động bật legacy knowledge MCP; test dual-listener mặc định xác nhận knowledge.* không được quảng bá. Các Device Core remote trong E2E là process fixture trên G6, không phải rollout máy khác.',
'',
'Các lượt đỏ/harness failure được giữ: lỗi env skip installer ở baseline đầu; /tmp WSL mất giữa phiên; ba root contract lỗi cũ; EBUSY cleanup trước khi chờ child close; patch check ban đầu gặp test file đã thêm cho TDD. Receipt sửa tương ứng được ghi riêng, không ghi đè.',
'',
'## 8. Soak, production và fleet',
'',
'Soak 24 giờ: NOT_RUN; 0 giờ được chấp nhận; không có phiên soak đang chạy. Chưa đo so sánh CPU/RSS/load nền. Stress 58,5 giây không được đổi tên thành soak. '+link('soak-status.json')+'.',
'',
'G6 live vẫn 1.0.11, cùng device ID và connection epoch. Listener 8101/8102 vẫn PID 47816; 8103 vẫn PID 50388; 8104 đã nhả. Không thấy Node process mang marker thư mục fixture trong lần kiểm tra cuối; phép quét này không chứng minh mọi process không liên quan đều đã đóng.',
'',
'Stopped-state backup/restore trong fixture Windows/Linux PASS, bao gồm paired identity, OAuth refresh và exact evidence. Production rollback: NOT_RUN. G8/Cloudflare không được kiểm tra hoặc thay đổi trong phạm vi chỉ G6.',
'',
'Fleet: '+link('../fleet-rollout.json')+' và '+link('../fleet-rollout.md')+'. Không máy nào được triển khai; FJP EXCLUDED_BY_USER. Z99 vẫn offline, chưa có safe upgrade command hoặc accepted artifact; không đánh dấu offline preparation hoàn tất.',
'',
'## 9. Review và việc tiếp theo',
'',
rows(['Review','Trạng thái','Turn ID','Model được xác minh','Verdict'],reviews.map(r=>[r.gate,r.status,'null','Chưa có','Chưa có'])),
'',
'Yêu cầu đến từ V12_END_TO_END_COMPLETION_SPEC.md §7 và ONE_AGENT_EXECUTION_PROMPT.md: D0 phải có trước quyết định kiến trúc package/IPC; commit các slice đã review; D1–D3 theo milestone. Giới hạn chỉ G6 ngăn chạy reviewer yêu cầu trên FJP. Không tự duyệt thay Opus. Packet đã sẵn sàng: '+link('D0-review-packet.md')+'.',
'',
...config.blockers.map(b=>'- **'+b.id+' — '+b.owner+':** '+b.detail),
'',
'Bước tiếp theo: giải quyết phạm vi review D0 trên FJP theo workflow đã chỉ định, dùng packet/diff/receipts sẵn có. Sau quyết định có review, hoàn thiện Skill ownership/lifecycle và package notice, khép lại các failure/coverage parity, chạy real-agent/procedure/token A/B, soak artifact cuối và D3. Chỉ sau đó mới cập nhật G8 và fleet theo backup/rollback đã xác minh.',
'',
'Không có deployment, publication, review request đã gửi hoặc background soak chưa khai báo. Toàn bộ phiên thực thi G6 đã dừng ở checkpoint có bằng chứng này.',
''
];
text('FINAL_REPORT.md',lines.join('\n'));
const fleetLines=['# Fleet rollout — chưa triển khai','', '**BLOCKED_RELEASE_GATES**. Chỉ có inventory metadata; mọi lệnh chạy trên G6. Không accepted release artifact, rollback production hoặc safe offline command.','',rows(['Máy','ID','Version trước','Version quan sát sau','Online sau','Trạng thái'],fleet.devices.map(d=>[d.name,q(d.deviceId),d.oldAgentVersion,d.observedAgentVersionAfter,String(d.onlineAfter),d.state])),'','FJP được loại trừ bởi người dùng. Z99 offline, preparationComplete=false. Không có máy nào được coi là đã nâng cấp. Counter/epoch trước và sau nằm trong fleet-rollout.json; chúng không phải token usage LLM.',''];
fs.writeFileSync(path.join(root,'evidence/fleet-rollout.md'),fleetLines.join('\n'),{flag:'wx'});
const state=['# MCP Device v12 + Palace — RUN_STATE','', '**RELEASE_BLOCKED_WITH_EVIDENCE**','', '- Cập nhật: '+now+'. Chỉ G6 qua md; không tác nhân phụ, không scheduler.','- Kho '+q(root)+'; nhánh '+q(preservation.branch)+'; HEAD '+q(preservation.head)+'. Working tree dirty; chưa commit do chưa có review bắt buộc.','- Báo cáo đầy đủ: '+q('evidence/v12-e2e-20261024-g6/FINAL_REPORT.md')+'. Checklist máy đọc: '+q('evidence/v12-e2e-20261024-g6/release-checklist.json')+'.','- Windows Node 22.22.2; WSL Ubuntu-22.04 Node 22.21.0.','', '## Gates','',rows(['Gate','Trạng thái','Bằng chứng / thiếu'],config.gates.map(g=>[g.id,g.state,g.summary])),'', '## Bằng chứng cuối','', '- Platform 87/87 mỗi OS, server 42/42 mỗi OS, đều không skip.','- Root npm test 66 module exit 0; không dùng làm 66 assertion suites vì entrypoint legacy có no-op.','- Core comparator PASS 14 result + 4 side-effect families; port-free parity 35 PASS / 6 FAIL, trong PASS có 2 no-op bị loại. Ba failure xuất hiện trên cả baseline/candidate.','- Live CLI cuối: 1000/1000, '+live.appendedRecords+' appends, SQLite integrity ok, elapsed '+(live.elapsedMs/1000).toFixed(3)+' s; không phải 24h soak hoặc token evidence.','- Device SHA '+q(artifacts.artifacts.find(x=>x.product==='mcp-device').sha256)+'. Palace SHA '+q(artifacts.artifacts.find(x=>x.product==='palace').sha256)+'.','- Artifact source '+q(artifacts.sourceSha256)+'; validation source '+q(report.validationSourceSha256)+'.','- Bảy WIP gốc có backup khớp. Installer là WIP duy nhất được sửa có chủ đích; 347 canonical dist files không đổi. Diff patch check PASS.','- G6 live vẫn 1.0.11; 8101/8102 PID 47816, 8103 PID 50388, 8104 đã nhả. Không deployment.','', '## Các file / workspace để tiếp tục','', '- Evidence: '+q(evidence)+'.','- Artifact: '+q(path.join(work,'artifacts/final'))+'.','- Bản nguồn/validation: '+q(path.join(work,'candidate-three'))+'.','- Git worktree parity riêng: '+q(path.join(work,'parity-worktree'))+' (detached HEAD, nội dung xác minh bằng manifest; không coi Git status của bản copy là thay đổi tại kho chính).','- Raw parity runs: '+q(path.join(work,'windows/parity-port-free'))+'; receipt/log đã chép vào evidence.','- Linux native retained: '+q('/var/tmp/mcp-device-v12-e2e-20261024-g6/final')+'. /tmp trước đó đã mất; receipts còn trên ổ E.','- D0 packet chuẩn bị, chưa gửi; không turn ID/verified model/verdict. D1–D3 NOT_RUN.','', '## Tiếp tục an toàn','', '1. Đọc FINAL_REPORT.md, release-checklist.json và preservation-and-diff.json; xác minh lại Git HEAD, các port và receipt trước mọi retry.','2. Review D0 trên FJP cần phạm vi vượt giới hạn chỉ G6 hiện tại. Không giả signoff hoặc thay reviewer.','3. Khép lại Skill ownership/relocation/uninstall, notice gói và parity failures; không sửa baseline v11 hoặc bỏ qua no-op.','4. Chạy real agent/procedure/token evidence, >=24h soak và D3 trên artifact cuối; chỉ sau đó mới G8/fleet rollout.','5. Không có retained job/soak đang chạy. Timeout md phải được đối chiếu với receipt, không gửi lặp mutation khi chưa rõ trạng thái.',''];
fs.writeFileSync(path.join(root,'specs/008-v12-platform/RUN_STATE.md'),state.join('\n'));
console.log(JSON.stringify({verdict:report.verdict,recordedAt:now,files:['release-checklist.json','FINAL_REPORT.md','actual-token-ab.json','soak-status.json','reviews-status.json','parity-interpretation.json'],fleetFiles:['evidence/fleet-rollout.json','evidence/fleet-rollout.md'],head:preservation.head,artifactHashes:artifacts.artifacts.map(x=>({product:x.product,sha256:x.sha256}))}));
