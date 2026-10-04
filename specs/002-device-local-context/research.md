# Research — Device-local Context

**Ngày kiểm tra**: 2026-10-04. Research/design evidence, không phải implementation result.

## 1. Nguồn và độ tin cậy

### Nội bộ đã kiểm tra

| ID | Nguồn | Điều chứng minh |
| --- | --- | --- |
| I-01 | `wt-mcp-device-110-integrate/.specify/memory/constitution.md` | Constitution 1.0.10 là proposed/unratified; compatibility/bounds/Windows/Linux/canonical dispatch là gate, không phải acceptance đã qua. |
| I-02 | `specs/001-mcp-runtime-review/{spec,plan,tasks}.md` | 1.0.10 vẫn pre-implement/review; dispatcher/process/resource accounting thuộc 001. |
| I-03 | Baseline `ee87d0f...` | GatewayChannel gọi adapter; adapter có direct shell/project/image routes; server.ts recorder cũ không bao phủ canonical public boundary. |
| I-04 | `src/utils/toolHistory.ts` | JSONL hiện tại bounded/recent, không phải durable canonical research store. |
| I-05 | Gateway tool manifest | `project_list`/external broker/NMem removal không đủ evidence để gộp vào 002. |
| I-06 | Live device catalog | 19 tools, 26,573 schema bytes, ~6,644 estimated schema tokens ở snapshot hiện tại. |
| I-07 | Opus independent review round 1 | Verdict `REVISE_SPEC`; chỉ ra confirmation semantics, capture durability, unscoped event, redaction, sandbox, re-pair gaps. |
| I-08 | Live `node -v` trên 8/8 online devices | Fleet hiện quan sát: Node 22.22.x/22.23.x hoặc 24.14–24.18; không có Node 18/20 trong live fleet hôm nay. Đây không chứng minh mọi external install đều như vậy. |
| I-09 | FTS5 probe trên Linux Node 22/24 và Windows g6/fjp | Built-in `node:sqlite` tạo/search FTS5 thành công trên các đại diện Windows/Linux đã thử. Node 22 in warning experimental; Node 24 current docs đã nâng stability nhưng vẫn cần platform tests của project. |

Snapshot 001 được giữ làm reference; nếu source docs 001 drift sau snapshot, handoff phải refresh thay vì sửa snapshot cũ.

### Public primary sources

| ID | URL | Dùng để |
| --- | --- | --- |
| P-01 | https://github.github.com/spec-kit/reference/agentic-sdd.html | Spec Kit workflow/quality gates. |
| P-02 | https://sqlite.org/fts5.html | FTS5/BM25/query syntax; không suy latency của project. |
| P-03 | https://sqlite.org/wal.html | WAL: nhiều reader, một writer; checkpoint/durability trade-off. |
| P-04 | https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html | `node:sqlite` introduced 22.5; unflagged từ 22.13; current Node 24 docs classify SQLite release candidate. |
| P-05 | https://github.com/WiseLibs/better-sqlite3/blob/master/package.json | Current better-sqlite3 requires Node >=22; native dependency adds install/platform surface. |
| P-06 | https://git-scm.com/docs/git-rev-parse | Worktree root/git common dir resolution. |
| P-07 | https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html | Future code-graph parser option; không nằm MVP 002. |
| P-08 | https://github.com/microsoft/llmwiki | Candidate wiki core; moved to separate feature 003. |
| P-09 | https://github.com/FSoft-AI4Code/CodeWiki | Alternative repo-doc generation; 003 only. |
| P-10 | Pi/VS Code/Codex Agent Skills docs | Skill portability/discovery cần version-specific validation; không bảo đảm auto-invocation. |

## 2. Decisions after Opus review round 1

### D-01 — Context thuộc device
Một `ContextService` ở device; local CLI và remote MCP chỉ là adapters. Gateway auth/routes, không persist corpus.

### D-02 — Owner + repo physical partition, có unscoped metadata lane
Layout:
`context/registry.sqlite`,
`context/owners/<owner-key>/unscoped.sqlite`,
`context/owners/<owner-key>/repos/<repo-key>/{context.sqlite,blobs/}`.
Unscoped/ambiguous events chỉ giữ minimal coverage metadata, không payload searchable. Registry không chứa evidence body.

### D-03 — Repository UUID local
Local UUID/worktree metadata là authority. Origin/root commit chỉ metadata. Same-origin clone không tự merge. Move/relink là owner-admin operation ngoài agent MCP.

### D-04 — Capture durability = pre-intent + post-outcome
Observer cố commit intent record trước dispatch trong bounded timeout; sau dispatch update outcome. Committed intent thiếu outcome sau restart = `unknown_after_restart`. Nếu pre-intent persistence fail/timeout, existing tool execution vẫn có thể tiếp tục nhưng capture gap phải observable; recorder không được replay side effect. Spec không hứa mathematically lossless capture dưới disk failure.

Power-loss durability level (SQLite synchronous mode) là policy/benchmark choice; process-crash semantics ở trên là contract bắt buộc.

### D-05 — Redaction trước persistence
Args/results/payload được filter/redact trước DB/blob/FTS/export. Retained blob hash là hash của bytes thực giữ sau redaction. Không có “raw secret hidden blob”.

### D-06 — FTS/activity graph cooperative
Capture event tự động; FTS/activity materialization chỉ qua explicit `sync`/rebuild. Search/read/status không hidden-write. Activity relation only; source-code Tree-sitter graph deferred khỏi first implementation increment.

### D-07 — Query/ref/cursor security
Ref là random opaque ID resolved only after owner/repo authorization. Cursor bind owner/repo/generation/query-hash/position/expiry bằng HMAC hoặc equivalent server-side state. No raw SQL/Cypher.

### D-08 — Runtime floor cho feature 002: Node >=22.13
Không đổi 1.0.10 patch âm thầm. 002 được xem là post-1.0.10/minor compatibility change và dùng built-in `node:sqlite`, không native SQLite package. Rationale:
- 8/8 live devices đã ở >=22.22/24.x.
- Node docs: sqlite available từ 22.5, unflagged từ 22.13.
- FTS5 probe pass trên representative Windows/Linux.
- tránh native install/prebuild matrix của better-sqlite3.

Gate còn lại: package release/migration note phải nói rõ Node-floor change; Windows/Linux project tests vẫn bắt buộc.

### D-09 — Writer policy ưu tiên capture, bounded busy
DatabaseSync operations phải ngắn; no parse/network trong write transaction. Capture có priority cao hơn maintenance. `busy_timeout`/retry budget hữu hạn; maintenance yield trước. Capture benchmark phải đo event-loop stall/concurrent latency. Nếu sync path không đạt budget đã chốt, implementation có thể chuyển storage call sang worker nhưng không thay domain contract.

### D-10 — Generation là watermark, không full-copy mỗi sync
Ordinary sync append/update derived rows và publish generation watermark/indexed-through-event. Rebuild duy nhất dùng shadow derived generation + atomic pointer. Cursor pin generation/query; compaction không xóa generation còn cursor hợp lệ.

### D-11 — Local sandbox và re-pair fail closed
CLI offline works only when OS/sandbox can access state. State root/WAL denial returns typed local-state/access error; skill không fallback remote để bypass. Re-pair selects active owner namespace only; old namespace sealed, không auto-search/adopt.

### D-12 — Tool surface: 6 stable names, admin destructive out-of-band
`local_status`, `local_search`, `local_read`, `local_graph`, `local_index`, `local_wiki`.
Read tools are truly read-only. `local_index` only sync/checkpoint/rebuild/cancel. Purge/relink/namespace adoption are local owner-admin CLI, not MCP agent actions.
`local_wiki` is reserved in 002 but disabled/status-only; actual provider generation is feature 003. User explicitly prefers publishing tool names in one catalog change, so reserving the name is intentional.

### D-13 — Preview token != human consent
Any preview hash/token only binds selection/generation/expiry. It cannot prove the user approved because the same agent can obtain/replay it. Therefore feature 002 does not expose destructive admin through MCP. Wiki egress in 003 must rely on local owner provider allowlist/config plus user-request policy, not a self-issued token claim.

### D-14 — Retrieval quality target
Frozen fixture target before implementation:
- exact path/identifier: relevant evidence in top 3 for 100% cases;
- error/command/natural-language history: Recall@8 >= 0.90 overall;
- unauthorized cross-scope hits: 0.
Latency measurements are invalid if correctness target fails.

### D-15 — Wiki implementation split to 003
002 reserves `local_wiki` contract and proves no provider call. LLMWiki/CodeWiki reuse, egress, cost, source-quality, revisions belong 003 and do not block context MVP.

### D-16 — 1.0.10 handoff ownership
002 independently owns store/redaction/repo identity/FTS/search/read/CLI/checkpoint/activity relations. 001 owns canonical observer/dispatcher/process/resource accounting/readiness/shutdown. Live capture, process correlation and gateway adapters wait for explicit handoff. Observer filter for `local_*` and pre-intent/outcome hook points are part of handoff checklist.

## 3. Implementation gates remaining

| Gate | Required before source implementation/rollout |
| --- | --- |
| G-110 | Canonical observer hook, pre/post outcome semantics, process correlation, shared budgets, observer exclusion hook, readiness/shutdown contract from 001. Only live wiring waits; store/search fixture work does not. |
| G-POLICY | Numeric repo-store quota, event metadata/payload/blob limits, busy timeout, retention and capture degraded behavior. Values must be chosen before enabling real capture. |
| G-SCHEMA | Six-tool manifest, annotations, errors, total schema bytes/token estimate <= 10k target or explicit owner exception. |
| G-ACCEPT | Windows/Linux isolation/crash/concurrency/retrieval/perf/parity + independent review. |

**G-DB resolved for design**: Node >=22.13 + built-in `node:sqlite`/FTS5, subject to implementation tests and release-note approval.  
**G-WIKI removed from 002**: feature 003.

## 4. NMem boundary

NMem handles explicit preference/rule/decision that tool evidence cannot observe. 002 does not upload graph to NMem, does not depend on NMem and does not remove/change NMem tooling.

## 5. Performance evidence correction

Prior synthetic “0.096 ms 2-hop” is invalid as representative graph evidence: seed had no outgoing neighborhood; earlier seed count label also drifted after reducing rows. Do not use it in SLA.

New benchmark must report correctness + actual visited/examined work, DB/WAL bytes, event-loop/concurrency impact, median/p95/max and Windows/Linux environment identity. Capture/search/sync each get separate workloads.

## 6. What remains intentionally deferred

Tree-sitter code graph; embeddings/vector search; wiki provider/generation; automatic skill installer; long-lived offline maintenance worker; backup/export/relink convenience. Deferral is scope control, not rejection of future capability.
