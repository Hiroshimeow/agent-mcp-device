# Feature Specification: Device-local Context cho mọi agent

**Feature Branch**: `002-device-local-context`  
**Created**: 2026-10-04  
**Revised**: 2026-10-04 after independent Opus review round 1  
**Status**: DRAFT FOR REVIEW — documentation only; implementation authorization is separate.  
**Input**: Device-owned history của chính mcp-device, repo-scoped retrieval/graph dùng chung cho agent local và remote, portable skill ưu tiên local CLI, graph enrichment theo yêu cầu thay vì mỗi tool/idle. Manual Wiki generation được tách khỏi implementation của feature 002; chỉ reserve public tool name để tránh một vòng catalog refresh sau này.

## User Scenarios & Testing

### User Story 1 — Tìm lại bằng chứng công việc của đúng repo (Priority: P1)

Là người dùng ChatGPT hoặc MCP client bất kỳ, tôi muốn tìm tool call, file, command và kết quả cũ trên device được cấp quyền, không cần session của Pi/Codex và không chuyển corpus lên gateway.

**Independent Test**: Hai repo A/B có marker riêng. Import/capture event, restart device, sync theo yêu cầu rồi search/read A. Kết quả dẫn về đúng evidence gốc, không có marker B. Với store khả dụng, mỗi invocation có đúng một committed event; khi fault-inject recorder, execution outcome không bị replay và coverage gap được báo rõ.

**Acceptance Scenarios**:
1. Tool đã thực thi ở A → agent mới search A → nhận ref, evidence class, timestamp, outcome, bounded snippet và coverage.
2. Payload lớn/hết retention/redacted → read ref → trả continuation hoặc trạng thái thiếu; không dựng lại raw content từ graph/summary.
3. Shell/project/image/direct route không đi qua inner handler → vẫn đi qua một canonical observer → không missing/double capture khi recorder khỏe.
4. Recorder không commit intent trong bounded timeout → tool không bị retry vì recorder; response/health surface báo capture gap. Nếu intent đã commit nhưng process chết trước outcome → event là `unknown_after_restart`, không suy outcome.
5. Tool ngoài repo hoặc scope mơ hồ → chỉ ghi owner-scoped minimal metadata; không index payload vào repo bất kỳ.

### User Story 2 — Agent local dùng cùng context qua CLI và skill (Priority: P1)

Là người dùng Codex/Pi/VS Code trên device, tôi muốn research context trực tiếp bằng local CLI rồi tiếp tục dùng native tools, không vòng qua gateway.

**Independent Test**: Gateway/network không dùng được nhưng local state root có quyền đọc/ghi cần thiết → CLI search/read/status vẫn hoạt động. Cùng owner/repo/generation thì CLI và MCP trả cùng evidence ref/content sau khi bỏ transport metadata. Sandbox không mở được state root phải fail typed, không bypass bằng remote fallback.

**Acceptance Scenarios**:
1. CLI chạy trên đúng host/state root → skill ưu tiên local CLI, không OAuth/gateway cho local read.
2. Index missing/stale và task cần context cấu trúc → agent có thể gọi bounded `sync`; không sync mỗi read/search/turn.
3. Native editor thay file → optional checkpoint lưu Git metadata observed và summary reported; không fabricate native tool trace/test success.
4. CLI absent → remote fallback chỉ khi device/repo đã được xác định và authorize; `ACCESS_DENIED`/sandbox denial không được fallback sang đường yếu hơn.
5. Device re-pair → local CLI mặc định chỉ dùng active owner namespace; namespace cũ sealed khỏi skill/MCP và không tự merge/adopt.

### User Story 3 — Context bền vững, có scope/quota/crash semantics rõ (Priority: P1)

Tôi muốn context tồn tại qua restart, worktree, concurrent local/remote access và migration mà không leak repo/account hoặc giả rằng 1.000 log entry là đủ.

**Independent Test**: Crash ở pre-intent/post-intent/post-side-effect/pre-outcome, concurrent writer, disk full, DB busy/corrupt, two worktrees, clone cùng origin, re-pair, cursor tamper và quota saturation.

**Acceptance Scenarios**:
1. Hai worktree của cùng local repository chia sẻ historical event store nhưng current-code metadata phân biệt worktree/revision.
2. Hai clone có cùng origin không tự gộp store chỉ từ remote URL/root commit.
3. Remote account mới sau re-pair không đọc namespace cũ; local skill cũng không tự mở namespace sealed.
4. Rebuild bị dừng → last-good generation còn đọc được; generation staging chưa publish không xuất hiện.
5. Purge là local owner-admin operation ngoài agent MCP surface; source repo không bị sửa/xóa và registry giữ content-free tombstone/audit cần thiết.

### User Story 4 — Tìm quan hệ activity có provenance, không cần LLM (Priority: P2)

Tôi muốn hỏi file/process/command/test/event liên quan bằng typed relations và FTS, không có “bộ não” suy causal relation.

**Independent Test**: Fixture có read/edit success/failure/dry-run, process start/output/end, error/test run, rename và hub node. Search/graph phải phân biệt observed/parsed/reported, bound traversal thật bên trong thuật toán và expose coverage.

**Acceptance Scenarios**:
1. Sync activity relations chỉ materialize edge có evidence; failed/dry-run edit không thành modified-success; temporal adjacency không thành caused-by.
2. Search exact path/identifier + FTS + bounded related-node expansion; không embedding/LLM.
3. High-degree node → frontier/visited/edge/time budgets dừng query và báo partial cùng examined counts.
4. Source-code symbol parser/Tree-sitter graph không phải acceptance requirement của increment đầu; có thể thêm trong increment sau bằng cùng generation/provenance contract.

### User Story 5 — Công bố tool contract ổn định mà không phá 1.0.10 (Priority: P2)

Tôi muốn đăng ký một lần nhóm `local_*` đủ cho context, cùng domain behavior với CLI, trong khi dispatcher/process/resource accounting vẫn do 1.0.10 sở hữu.

**Independent Test**: Manifest/schema/risk annotations được snapshot; old device trả unsupported; marker scan chứng minh gateway không persist content; combined compatibility chạy trên handoff 1.0.10 cuối cùng.

**Acceptance Scenarios**:
1. Read-only tools không gây index mutation/provider call.
2. `local_index` chỉ làm bounded derived-state maintenance/checkpoint; destructive owner administration không được nhét vào MCP action mà agent có thể tự “confirm”.
3. `local_wiki` được reserve trong catalog nhưng feature 002 chỉ hỗ trợ disabled/status contract; generation/provider egress thuộc feature 003.
4. Project-list/NMem/external broker/dispatcher removal là change set riêng; không lén gộp vào context feature.
5. Gateway route không có server-side fallback/store/search implementation; unsupported device fail typed.

### Edge Cases

Repo chưa Git; shallow clone; nhiều root commit; worktree khác branch; rebase; symlink/junction; repo move/delete; cwd ở thư mục cha chạm nhiều repo; path ngoài repo; process mapping mất sau restart; binary/base64/secret; malformed legacy JSONL; duplicate import; Unicode tiếng Việt/camelCase/snake_case; graph cycle/hub; concurrent writers; disk full/locked/corrupt DB; sandbox chỉ cho write workspace; account re-pair; stale/tampered cursor; store quota; generation schema change; no index; local workspace/container/WSL/SSH không phải device state host.

## Requirements

### Functional Requirements

- **FR-001**: Canonical content nằm ở device state root, partition theo owner namespace rồi repository. Gateway không persist event/snippet/blob/index/graph. Owner có một minimal unscoped store chỉ cho capture coverage metadata khi repo không resolve/ambiguous; unscoped payload không tham gia repo search.
- **FR-002**: Canonical observer cố ghi một durable intent record trước dispatch trong bounded timeout, rồi cập nhật outcome sau dispatch. Recorder failure không được replay side effect. Intent committed nhưng không có outcome sau restart được biểu diễn `unknown_after_restart`.
- **FR-003**: Nếu pre-dispatch intent không thể persist trong bounded timeout, existing tool behavior được ưu tiên: execution có thể tiếp tục nhưng capture phải được đánh dấu degraded/gap trên safe metadata/health surface; feature không được tuyên bố complete coverage cho invocation đó.
- **FR-004**: Redaction/exclusion chạy trước mọi persistence/index/blob/export. Raw secret bị phát hiện không được “giấu” trong blob; evidence phải mang `redacted`/omitted state và hash của retained bytes.
- **FR-005**: Event committed có ID, accepted/outcome timestamps, public tool, sanitized args/result metadata, owner/repo/worktree resolution state, execution outcome, request/process correlation, payload state và recording state.
- **FR-006**: Owner/repo scope được authorize trước lookup ref/cursor/job. Evidence refs là opaque random IDs scoped server-side; cursors phải bind owner/repo/generation/query hash/position/expiry bằng authenticated token hoặc server-side state để agent không forge scope/position.
- **FR-007**: Same local Git repository được nhận diện bằng local repository identity/worktree metadata; cùng origin không đủ merge clone. Move/relink không tự diễn ra từ tên/origin.
- **FR-008**: Search dùng exact path/identifier + FTS lexical + bounded activity relation expansion, có filters source/time và trả bounded snippets/refs/coverage; không LLM/embedding.
- **FR-009**: Read evidence có aggregate byte budget, input-order preservation, per-ref error, retention/redaction/truncation state và continuation; không substitute current file cho historical evidence.
- **FR-010**: `local_status`, search/read/graph không tự sync/rebuild/checkpoint/provider call. Response nêu generation watermark, indexed-through event, pending events, freshness/coverage và active job.
- **FR-011**: Kết quả của `local_*` bị observer filter khỏi self-ingestion. Maintenance audit/tombstone không được index như user work evidence.
- **FR-012**: Local CLI dùng cùng ContextService/store mà không cần gateway/daemon cho read/search/status khi OS/sandbox cho phép state access. Nếu state root/WAL không mở được, fail typed `LOCAL_STATE_UNAVAILABLE`/`ACCESS_DENIED`; skill không remote-fallback trên permission denial.
- **FR-013**: CLI và MCP dùng cùng domain service, validation, refs/errors/generation semantics; chỉ transport metadata khác.
- **FR-014**: Portable skill hướng dẫn search/read trước, selective sync, checkpoint ở meaningful work boundary, current-source verification bằng native tools và safe fallback. Skill không đọc DB schema, transcript, credential hoặc tự cài/update.
- **FR-015**: Checkpoint lưu repo/worktree/Git metadata observed + optional summary/evidence refs reported. Reported claim không biến thành observed tool/test fact.
- **FR-016**: Feature không đọc `.pi`, `.codex`, VS Code transcript hoặc intercept native local agent tools. Không quảng cáo checkpoint là full native tool history.
- **FR-017**: SQLite writer transactions ngắn và bounded; capture có priority cao hơn maintenance. Busy timeout hữu hạn; maintenance yield/retry trong budget, không block tool vô hạn. DB failure/degraded state observable.
- **FR-018**: FTS/relations dùng append/incremental generation watermark. Ordinary sync không clone toàn corpus. Full rebuild tạo shadow derived generation rồi atomic publish pointer; cursor pin generation/query và hết hạn. Compaction không xóa generation còn cursor hợp lệ.
- **FR-019**: Metadata event retention tách khỏi large payload retention. Quota gồm owner stores, repo-store count, DB/blob bytes, jobs, handles, query expansion và caches. Chạm repo thoáng qua không được tạo unbounded empty stores.
- **FR-020**: Import legacy JSONL idempotent, source-preserving, báo malformed/duplicate/unknown owner/repo. Unknown-owner record ở quarantine/unscoped state; không tự gán cho account vừa pair.
- **FR-021**: Active owner namespace là default duy nhất cho CLI/skill/MCP. Namespace cũ sau re-pair sealed khỏi automatic search; access/migration/purge của namespace cũ là explicit local owner-admin workflow, không agent fallback.
- **FR-022**: Destructive admin (`purge`, namespace adoption/relink) không nằm trong agent MCP surface của 002. Nếu có CLI admin, nó phải là explicit local owner operation và ghi content-free audit/tombstone; preview token chỉ chống stale selection, không được gọi là bằng chứng “human approval”.
- **FR-023**: Sync/rebuild chỉ khởi chạy bởi explicit `local_index`/CLI request; không chạy mỗi tool/idle/search. Agent được tự chọn bounded incremental sync theo skill; rebuild derived state được phép khi missing/corrupt và vẫn không đụng source evidence.
- **FR-024**: Activity relations chỉ biểu diễn observed/parsed/reported facts với evidence refs; không sinh causal/fixes/decision edge từ thứ tự thời gian hay exit code chung.
- **FR-025**: Core retrieval/activity graph không phụ thuộc NMem, embedding, LLM hoặc source-code parser. Symbol/code graph parser là follow-up increment, không blocker cho 002 MVP.
- **FR-026**: Không có always-on context worker/scheduler. Maintenance chạy foreground/bounded khi daemon offline; nếu vượt offline budget trả typed limit thay vì spawn hidden persistent worker. Khi daemon online có thể trả scoped job handle/cancel theo 1.0.10 process/resource contract.
- **FR-027**: Public tool set cho 002 là `local_status`, `local_search`, `local_read`, `local_graph`, `local_index`, `local_wiki`; không dùng `repo_*`.
- **FR-028**: `local_status/search/read/graph` read-only; `local_index` write/idempotency-aware nhưng không provider/destructive-admin; `local_wiki` open-world/write-reserved và trong 002 chỉ trả disabled/status semantics. Không gộp read status với purge/relink.
- **FR-029**: `local_index` actions của 002: `sync`, `checkpoint`, `rebuild`, `cancel`. Unknown action bị reject. `rebuild` chỉ thay derived state, không source events/blobs.
- **FR-030**: `local_wiki` name/schema được reserve để tránh catalog reinstall vòng sau, nhưng generate/update/provider implementation thuộc feature 003; 002 phải chứng minh startup/search/sync tạo 0 provider call.
- **FR-031**: Không remove/merge `project_list`, external broker, NMem tools hoặc canonical dispatcher trong feature này. Tool removal cần evidence/owner decision riêng.
- **FR-032**: Integration acceptance chỉ sau handoff 1.0.10 cho canonical observer/dispatcher, outcome/process correlation, shared budgets, observer exclusion hook và shutdown/readiness; material 1.0.10 change invalidates dependent evidence.

### Key Entities

Owner namespace; registry/store manifest; local repository identity; worktree/revision; tool intent/outcome event; capture gap; process execution reference; redacted payload/blob ref; checkpoint; index generation/watermark; activity node/edge; cursor; maintenance job; admin tombstone.

## Success Criteria

- **SC-001**: Với store khỏe trên route fixture, 100% supported invocations tạo đúng một committed intent/event identity và một final outcome update. Fault-injected recorder tạo explicit counted capture gap hoặc `unknown_after_restart`, không duplicate side effect và không được báo là complete coverage.
- **SC-002**: Cross-repo/account/path/ref/cursor adversarial suite có 0 unauthorized content hits; gateway disk scan có 0 context marker sau success/error/truncation.
- **SC-003**: Cùng owner/repo/generation, CLI và MCP trả cùng evidence refs/content/errors. Gateway offline không ảnh hưởng local read khi state accessible; sandbox denial trả typed error và không fallback.
- **SC-004**: Không có explicit sync/index request thì startup/tool/read/search/status/idle tạo 0 graph-build/code-parse/provider work.
- **SC-005**: Frozen retrieval corpus đạt 100% top-3 cho exact path/identifier queries và Recall@8 >= 0.90 cho error/command/natural-language history queries; mọi result dùng để kết luận có valid evidence ref.
- **SC-006**: Rebuild không đổi source-event count/hash; repeated import không nhân đôi; interrupted rebuild không publish partial generation; concurrency/crash/dirty-worktree fixtures pass trên Windows và Linux.
- **SC-007**: Benchmark report có correctness-checked median/p95/max + resource counters cho capture/search/sync/contention/no-op; không có SLA “<1 ms” nếu raw evidence không chứng minh.
- **SC-008**: Public catalog/schema snapshot đo total tool count/bytes/token estimate; mục tiêu total schema estimate <= 10,000 tokens hoặc cần owner-approved compression/scope decision trước rollout.

## Assumptions and Scope Boundaries

Feature 002 target release không bị ràng buộc vào patch 1.0.10. Plan có thể chọn runtime floor/dependency khác nếu được ghi là compatibility decision riêng và không sửa pre-implementation 1.0.10 ngầm.

Không thuộc implementation scope 002: source-code Tree-sitter graph; embedding/vector DB; automatic wiki generation/provider; always-on worker; automatic cross-device context sync; NMem HTTP conversion; session transcript ingestion; tool removals; full runtime rewrite.

Wiki manual/human-readable vẫn là hướng đã chốt nhưng triển khai ở feature 003. Feature 002 reserve `local_wiki` contract/disabled response để tránh buộc client re-register khi 003 được enable.

## Dependencies and Clarification Record

1. 1.0.10 owns canonical dispatcher/observer, process outcome/correlation, shared resource accounting, readiness/shutdown. 002 may implement store/redaction/repository resolver/FTS/search/read/CLI/checkpoint/activity fixtures independently; live capture/gateway wiring waits for an explicit handoff.
2. Opus review round 1 identified human-confirmation semantics, capture durability, unscoped events, redaction task, sandbox behavior and re-pair namespace gaps. This revision resolves them in requirements rather than treating a preview token as human consent.
3. Latest user instruction supersedes earlier idle 10/30-minute graph idea: graph/index maintenance is cooperative/on-demand. Wiki generation is separate and manual.
