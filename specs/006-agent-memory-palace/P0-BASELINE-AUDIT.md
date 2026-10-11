# P0 — Device 1.0.11 current-state evidence audit

**Audit date:** 2026-10-11, G6 Windows.

**Audited source:** Device `main@2c4e90b14d07a4e12588bb987ccf4bd78ec9c0f7`, package `1.0.11`.

**Report state:** DONE — bounded current-state audit and required independent review reconciled. **Full 006 P0 evaluation gate remains INCOMPLETE / NOT_MEASURED.**
**Authorization:** User's P0 brief permits source/runtime reads, focused non-destructive checks, this report, and a report-only commit if validated. No implementation, schema/identity changes, service changes, deployment, branch switching, providers or scheduler are authorized.

## 1. Conclusions and status vocabulary

This is a **current-state audit**, not delivery of the entire 006 P0 evaluation gate. `VERIFIED` below means source checked and, where identified, a fresh bounded reproduction. It does not mean full production acceptance. `PARTIAL` means an existing seam covers only part of a requirement. `MISSING` means absent from the audited implementation path, not absent from every external product. `NOT_MEASURED` means no admissible fresh measurement; `OUTDATED` identifies contradicted historical documentation.

- Existing: owner/repository-local redacted evidence, durable invocation intent/outcome seam, SQLite schema v3 with FTS5, explicit incremental sync/rebuild, bounded search → selected read, optional activity graph and CLI, six Device Context schemas. These should be preserved rather than rebuilt wholesale.
- **Not an active automatic capture pipeline:** live capture needs trusted observer installation and signed feature approval. Both feature defaults and the installed approval checks were false here. Current Device startup supplies Context identity but no observer. The inspected current-repository Context store had **zero events/evidence/FTS rows/graph nodes/edges**, despite a published generation.
- **Capture/parser mismatch:** actual canonical capture writes `tool` / `args`; graph materialization reads `toolName` / `arguments`. The actual observer fixture produced one event node and zero edges. Hand-shaped graph fixtures demonstrate graph machinery, not working capture-to-graph integration.
- **Late outcome indexing gap:** a published watermark can cross a pending intent; a subsequently attached result at that older event ID is not picked up by ordinary sync. A disposable reproduction returned zero search matches until rebuild, then one. No production incident is asserted.
- No authoritative agent session/turn/task lineage, supported full-session adapter, task-success authority, shared Wiki, owner-scoped cross-clone Palace, automatic startup recall or learned-skill curator is implemented by this Context path. `local_wiki` remains disabled.
- Fresh domain byte receipts exist, but real successful-session recall, full MCP model-visible recall bytes, billing/model tokens, cold-agent transfer and amortized savings are **NOT_MEASURED / NOT_PROVEN**. `coverage.complete=true` is not proof of complete session capture.

## 2. Identity, environment and safety receipts

| Fact | Expected | Fresh observed evidence |
| --- | --- | --- |
| Device root / branch / HEAD | G6 canonical source, no downgrade | `pwd; git rev-parse --show-toplevel HEAD; git branch --show-current` → `E:/git-project/agent-mcp-device`, `main`, exact SHA above; independently repeated through `device_shell_execute` on G6 |
| Initial tracked/untracked state | Clean | `git status --short --untracked-files=all` empty; `git diff --exit-code` empty before report |
| Ignored state | Classify, do not clean | 21,951 ignored paths: `dist` 293, `node_modules` 21,651, `test` 7. Ignored output/dependencies are not new source; no removal |
| Main PI environment | Persistent interactive requested model | `PI_PROVIDER=cliproxy-2080`, `PI_MODEL=gpt-6.1-sol`, `PI_REASONING_LEVEL=high`, `PI_SESSION_ID=1f2644ed-42ff-42ef-8975-a8dfa3fd2f26`; Windows process 39852 is `node.exe …/pi-coding-agent/…/cli.js`, session ID and workflow-file flag, **no `-p`**; session header records repository CWD |
| Node / source package | >=22.13, Device 1.0.11 | `node --version` → `v22.22.2`; `package.json:3` version `1.0.11` |
| G6 Gateway source | Launch brief says synchronized develop | `git -C E:/git-project/agent-mcp-gateway …` → clean `develop@7a5a30b4a5f6226cf65b395ddfa0424677184592` |
| G8 canonical Gateway source | Same base | Read-only `device_shell_execute`, G8 `hp450-79844b90`, CWD `/home/ayumi/Workspace/git_project/agent-mcp-gateway-develop` → clean `develop@7a5a30b4a5f6226cf65b395ddfa0424677184592` |
| G8 Device source | Separate older checkout | Same bounded command → clean `main@8f3794a552627850a7e74876d376f8f6ec379ee9`; not downgraded/copied/changed. `git diff --name-only 8f3794a… 2c4e90b… -- src package.json package-lock.json` has **zero paths**: different source revisions, same tracked product code across these two commits |
| Installed Device metadata | Distinct from checkout SHA | `device_list_devices` reported online G6/G8 agent version `1.0.11`, Context capabilities; this is broker-advertised metadata, **not a verified binary digest** |
| G8 production Gateway 8102 | Do not touch | `c5862aa` is launch-brief information only; runtime SHA/process/port **NOT_MEASURED**, no reload or PM2 operation |

**OUTDATED:** `docs/STATUS.md:12,55` and `spec.md` describe old G6 Gateway `89f7123`/missing dependencies; `plan.md` correctly retains G8 as the canonical integration base. Fresh source identity above supersedes that description, not its safety policy. Gateway Context exposure was not merged or positively tested in this audit; advertised Device capabilities do not establish a Gateway public route.

**Safety disclosure:** focused checks use throwaway temporary SQLite/config state, never installed approval/identity/SQLite mutation. The pre-existing `test/context/repositories.test.js:8-20` creates a temporary Git repository, worktree and clone; running it incidentally exceeded the brief's literal no-worktree instruction. Its temporary tree was removed by the fixture; **no project worktree, branch or checkout was changed**. No additional worktree operations were performed by the main agent; child-agent command compliance is reconciled separately in §3. SQLite read-only queries may use ordinary SQLite shared-memory bookkeeping; they did not run migrations, recovery, index writes or identity activation on real state.

## 3. Required independent workflow

**COMPLETE: 3/3 Explore findings and 1/1 independent Plan review returned successfully.** The completion notification's “4/20 agents” is a harness count/limit label; the script requests four agents, and four successful journal entries were verified, not twenty completed audits. No missing or failed **agent result** is concealed.

The startup process had the workflow flag, and three child JSONL session headers started at `05:25:19Z`, with this main session as `parentSession`, provider/model `cliproxy-2080/gpt-6.1-sol`, reasoning `high`. Their presence contradicts the assertion that no child sessions were created, but does not itself prove final results. `get_subagent_result("capture-session")` returned `Agent not found`; that handle lookup was not evidence of failure of the startup children.

After the user's explicit follow-up authorization, the main agent invoked `SubagentWorkflow` with the verified existing file `E:\git-project\_mcp-consolidation-20261011\pi-p0-audit.workflow.js`; it returned **`wf_a28aef3ec70f`**. This is a user-authorized rerun, not a claim that the first run succeeded. The file launches three independent Explore readers (capture/session, storage/search, graph/retrieval), then a Plan reviewer, all requesting the exact model and high effort. It truncates each reader's text to 6,500 characters **for reviewer input**; final full-source conclusions require reconciliation beyond that window. No more workflows or replacement agents were launched by the main agent.

The authoritative full journal was read, not just the notification's truncated preview:

`C:\Users\admin\AppData\Local\Temp\pi-subagents-0\git-project-agent-mcp-device\1f2644ed-42ff-42ef-8975-a8dfa3fd2f26\tasks\wf_a28aef3ec70f.workflow.jsonl`

Journal SHA-256: `1d35003d1d7cb84cb08b1af3fff82a96c235f813ed626237b273ad2977880f8a`. This is a local temporary artifact, not a promised durable repository attachment; conclusions and reproducible source/command evidence are retained in this report.

| Journal index / agent | Actual result | Model / effort verification | Reconciled contribution |
| --- | --- | --- | --- |
| 0 — Explore capture/session | `ok=true`, 10,857 text characters | Child header `05:29:51.209Z`, exact provider/model, high | Optional hooks vs absent production observer installation, process PID session ≠ conversation ID, incomplete durable intent, no capture ACK/delivery queue/session adapter |
| 1 — Explore storage/search | `ok=true`, 25,746 characters | Child header `05:29:51.345Z`, exact provider/model, high | No BM25 rank, explicit local indexing, late-outcome watermark hole, coverage limits, bounded rebuild/read/cursor semantics, read-only-open vs recovery distinction |
| 2 — Explore graph/retrieval | `ok=true`, 20,477 characters | Child header `05:29:51.496Z`, exact provider/model, high | Association not causality, canonical payload mismatch, absent outcome chain, first-evidence node anchoring, no graph continuation, no portable clone recall |
| 3 — independent Plan reviewer | `ok=true`, 8,298 characters | Child header `05:34:45.196Z`, exact provider/model, high | Directly challenged capture activation, intent/session IDs, task success, late-result indexing, two-call/body-free locators, byte-vs-token claims and cross-clone identity; added evidence-ref graph-event collapse |

**Failed tool calls, explicitly accounted for:** capture child first attempted nonexistent `src/context/migrations/001-repository.sql` and an ambiguous device path-hint lookup; it recovered via actual `migrations/index.ts` and explicit G6 device ID. Graph child attempted nonexistent `src/activity`; actual graph is `src/context/graph.ts`. Storage child and reviewer had no tool errors in their JSONL. No model-error messages were found in these four child records. These failed lookups are not source proof or failed whole-agent audits.

The four children **inspected tests, did not execute them**. Their calls were bounded reads/search/listing, Git identity/status/diff and broker device discovery/read-only commands; no write/edit/install/worktree/test/service calls were found in the required rerun's child tool-call records. Fresh PASS and real-state/byte observations in this report are **main-agent measurements**, not attributed to those readers. Their UNKNOWN runtime statements are narrowed only by the separately documented main receipts.

### Reviewer reconciliation

- **VERIFIED:** optional capture seams but no installer in inspected production source; normal capture lacks authoritative session/turn/task/parent fields. Explicit manually supplied `session_ref` **can** form a graph association; do not call all session support absent.
- **REFUTED as current functionality:** captured successful exit is proof of task repair, rich fixture graph proves actual session→error→edit→test-pass causality, automatic independent-clone/cross-device recall, or byte bounds prove token savings. The final report makes none of these claims.
- **VERIFIED source hazards:** field contract mismatch and late-outcome omission. Main disposable actual-observer reproductions independently demonstrate both; no production incidence asserted.
- **NOT_MEASURED:** installed binary equivalence, live observer installation in every external runtime, typical agent two-call recall, real-session quality/latency/tokens, autonomous cold-agent transfer and amortized maintenance savings. Local gate/empty-store checks are not substitutes.
- **Added to final report:** pre-dispatch authorization can prevent execution; graph event identity collapses deduplicated evidence refs; first-evidence anchoring/retention and recovery-on-open remain source-level risks, not freshly tested incidents.

The reviewer only received 6,500 characters per reader through the fixed workflow, so its verdict is **not** independent verification of every tail finding or the main report's extra measurements. The main agent read all four full journal results and checked the additional producer/consumer, transport and graph identities against source. No claim of a second independent review of every word of this report.

The workflow reported 331,584 aggregate tokens, 232 tool uses and 416,678 ms. These are **harness-reported audit usage**, not a frozen Palace A/B or billing ledger; the user-authorized rerun duplicated prior startup investigative work. No efficiency claim is drawn from those numbers.

## 4. Actual dataflow, not the proposed Palace diagram

```text
Existing MCP server / dispatcher / Device gateway-tool adapter
  observePublicInvocation({tool,args}, execute)
  ├─ no installed observer OR nested capture → execute normally, no Context write
  └─ explicitly installed, authorized CanonicalObserver
       beginIntent → events(invocation_id, accepted_at, pending, payload_ref=NULL)
       execute exactly once
       completeOutcome → serialize {tool,args,result/status/error/durationMs}
          special process-range payload: {tool,result,status}
          → redact/cap (64 KiB) → evidence(ref, retained text/hash/bytes/state)
          → UPDATE same events row (execution/recording status, payload_ref)
          ↘ capture failure → fail-open execution; in-memory gap / degraded metadata
          ↘ writable reopening → pending becomes unknown_after_restart (no replay)

Separate explicit store.append / scoped importLegacy / checkpoint
  → redacted evidence + events (no implicit transcript import)

Explicit sync/rebuild ONLY
  events LEFT JOIN evidence ON events.payload_ref=evidence.ref
  → bounded event-ID batch, transactional shadow generation
  ├─ search_documents(ref, source, time, first/last/deleted generation)
  ├─ evidence_fts(ref, folded redacted text), SQLite FTS5
  └─ materializeActivity(retained JSON)
       expects {toolName,arguments,session_ref,process_ref,revision,error_signature}
       actual canonical {tool,args} → event node only (no normalization seam)
  → publish generation + indexed_through_event watermark

CLI or Device Context adapter (authorized owner + repo scope)
  search → exact-substring bucket OR quoted FTS tokens → compact-ish cards
           first 512 bytes of raw retained text, generation/freshness/cursor
  read   → chosen refs / domain+Device byte ranges → bounded retained content
  graph  → optional directed BFS/path/timeline/related → bounded opaque nodes/edges
  status → index/gap accounting; not transcript-completeness certification

No implemented session adapter → no authoritative turn/task join
No active Wiki / cross-device Palace / learning queue / skill curator
```

Sources: `src/tool-dispatcher.ts:28-32`, `src/server.ts:1190`, `src/device/gateway-tool-adapter.ts:146-151,255-259`, `src/device/device.ts:148`; `src/context/capture.ts:14-39,45-164`; `store.ts:119-129,225-246`; `importer.ts:6-53`; `indexer.ts:6-45`; `graph.ts:19-61`; `search.ts:43-172`; `cli.ts:185-254`; `device-adapter.ts:15-66`.

## 5. Stored fields, joins, coverage and identity boundaries

| Layer | Existing fields / key / join | Missing or important qualification |
| --- | --- | --- |
| Registry | `owners(owner_key,pairing_hash,status,created_at,accounted_bytes)`; one active owner; `repositories(repo_uuid,owner_key,identity,…)`; `worktrees(…,repo_uuid,canonical_root)` | Local opaque namespace, not globally stable authenticated Palace owner/device namespace. Re-pair seals old owner; caller does not choose an owner in public query |
| Repository identity | `sha256(realpath(git common-dir))`; worktree identity hashes real root | Links worktrees sharing a Git common-dir, **not distinct clones**, even with identical remote/commit. No semantic owner-wide reuse or portable raw ref authority |
| Intent/event | Integer `event_id`; unique `invocation_id`; `accepted_at`; `execution_status`; `recording_status`; nullable `payload_ref` | Invocation defaults to random UUID; no durable tool/args payload at intent commit. Crash before outcome leaves no retained tool name/args. No normalized `owner_id/device_id/session_id/turn_id/task_id/parent_call_id`, execution location or revision columns |
| Evidence | 48-hex `ref`; retained `text`, SHA-256 `hash`, `original_bytes`, `retained_bytes`, `redaction_state`, `partial`, `retention_state` | Safe retained evidence, **not full raw transcript**. Secrets use installation-keyed HMAC tags; final content hash is unkeyed SHA-256 of already-redacted retained bytes. The comment in `store.ts:244` must not be read as “all hashes are keyed” |
| Canonical payload | `tool`, `args`, result/status/error/duration; process-range variant omits args/duration and retains result `_meta.process` | `args.session_id` on a process tool is a process handle/PID input, not agent chat session identity. No reliable task-success authority. `_meta` process identity is not automatically an activity `process_ref` |
| Search document | `ref` FK evidence, source kind, timestamp, first/last/deleted generation | Typed search only query, source kinds, time, cursor/limits, optional related refs. No first-class tool/status/path/error/session/task/device/revision/cross-repo filter |
| FTS | Stored-content FTS5 `ref UNINDEXED,text`, `unicode61 remove_diacritics 2`; folded text | Actual rank is **exact=0 / FTS=1**, then timestamp descending and ref ascending; **not BM25 ranking**. Tokens are quoted and OR-joined; a match can contain only one query term |
| Graph | Nodes keyed by SHA-256(kind,key) prefix; edges carry source/target/relation/evidence ref; joins back through evidence/search generations | Parses selected top-level fields, not transcripts/result/error text. No `Turn`, `Task`, `Tool`, explicit returned result/test outcome, Wiki or skill node. Parsed historical data is not trusted instruction or causal proof |
| Checkpoint | Explicit observed HEAD/worktree/dirty/changed paths + separate reported summary/evidence refs | Reported completion is not a verified test pass. Parser does not pull nested `observed.head` into a revision node |
| Import | Scoped JSONL, redacted retained ID/content dedupe, quarantine unknown scope | Max source 64 MiB; reads/splits entire file; no durable source offset/checkpoint or bounded crash-resumable session queue. Legacy conversion retains toolName/arguments/output but omits input status/session lineage |
| Health | Status: in-memory gap count + unknown-after-restart + quota gaps. Search/read/graph: unknown-after-restart envelope | `coverage.complete` does **not** enumerate all absent sessions/turns or disabled capture. In-memory gaps disappear with new service instance. Freshness tracks indexed event IDs, not completeness of all historical reasoning |

Exact definitions: `migrations/index.ts:4-24,52-64`; `repositories.ts:11-35`; `store.ts:138-172,225-246,271-300,315-321`; `capture.ts:17-21,64-79,102-124,158-160`; `redact.ts:17-48`; `search.ts:6-7,47-52,64-97`; `service.ts:69-87,113-132`; `importer.ts:7-38`.

### Capture and retention are useful but narrower than 006 L0

- Signed installed-module feature artifacts are revalidated; defaults alone do not authorize capture (`authorization.ts:7-60`, `service.ts:11-12,24-45`). Current checks: both installed approvals false. No token/signature contents were inspected or recorded.
- Nested AsyncLocalStorage capture avoids double recording; `local_*`, recent-history/UI tracking are excluded (`capture.ts:14-39`). No query-triggered LLM or silent sync was found.
- One durable intent/outcome, 25 ms SQLite busy budget, quota/fencing; storage failures must not retry tool execution (`capture.ts:45-88,91-164`). The 25 ms per-connection setting is **not** an end-to-end deadline: connections open before it is set. Pre-dispatch authorization rejection can throw before executing `action()`, so “capture never affects execution” is not a blanket guarantee. Writable reopening marks pending “unknown”, not succeeded; it does not check originating runtime liveness and can reclassify an in-flight intent opened by another writer. Concurrent-runtime impact **NOT_MEASURED** (`store.ts:123-127`).
- Outcome retry idempotency exists for a committed intent; identical canonical process range can reuse retained payload, but these are not exactly-once session ingestion/learning guarantees. `execute` returns the original tool result, not the capture receipt. Device channel `request_id` is not forwarded as observer `invocationId`; there is no application-level durable capture/delivery ACK queue in this path, and a changed/disconnected connection discards outgoing results (`gateway-channel.ts:453-492`). A successful retained event does not prove the caller received its output.
- Live capture calls redaction without `path`; path-based exclusions exist in redact/append/import, but a nested captured `.env` path alone does not invoke that exclusion. Pattern redaction is not a universal secret detector; no broad “zero secret leakage” claim.
- Query-only constructors/handles do not migrate or create state (`store.ts:67-83,271-279`). WAL/schema v3 verified on the current real repo. `PRAGMA query_only=0` does not negate the SQLite connection's `readOnly` open flag (`store.ts:11-21`).
- Explicit owner-admin cleanup expires text/removes FTS and search rows, revokes cursors and manages WAL checkpoint retries (`store.ts:542-597`). Graph rows are retained but hidden by retention/generation joins, not physically removed by that cleanup. No cleanup was executed. This is retention-managed local evidence, not a permanent immutable full-source log.

### Additional source-level lifecycle risks (NOT_MEASURED incidents)

- Shared graph entities use `INSERT OR IGNORE` and retain the first inserted evidence ref (`graph.ts:21-24`). Node resolution requires that anchor to remain retained and visible (`graph.ts:91-98`); expiration of the first ref can hide the shared entity despite later available edges. This is source-derived, not a fresh expiration reproduction.
- Rebuild is bounded replay, not unrestricted full graph reconstruction: service uses default 1,000 events; an internal caller can set at most 10,000. Larger corpora are rejected; rebuild clears FTS but does not clear every search/graph table (`indexer.ts:7-9,21-37`, `service.ts:65-70`). No claim that rebuild cures every omission at every corpus size.
- Graph seeds and pinned-search continuation refs require 48 lowercase hex; selected read allows strings up to 128 characters. A retained migrated legacy string/UUID can therefore be readable yet graph-incompatible, and continuation over such legacy refs is not established here (`search.ts:37-38,122`, `graph.ts:73`).

### Separate legacy logs are not automatically Context evidence

The dispatcher/server also have pre-Context logging paths. `toolHistory.addCall` is skipped for canonical capture, remote requests and two excluded history/UI tools (`tool-dispatcher.ts:231-235`, `server.ts:1463`). The legacy `ToolCallRecord` carries `timestamp/toolName/arguments/output/duration`, not owner/repository/session/turn/task IDs (`src/utils/toolHistory.ts:6-11,212-231`). It queues JSONL writes once per second, keeps 1,000 memory entries, trims a >5 MiB disk file toward 4 MiB and retains at least the last line; a single oversized record can exceed that bound (`toolHistory.ts:33-38,117-143,176-201`). It does not pass through Context redaction. Existing local legacy logs therefore must not be assumed safe to import or model-load. The audit did **not** import this module, inspect its private log bodies or invoke its write/trim processor.

`src/utils/trackTools.ts:13-40` logs timestamp/tool and local serialized args; in remote mode only argument count/bytes. It rotates at the configured size and has no outcome/task authority (`trackTools.ts:42-68`). Gateway usage metadata is another distinct source, not raw tool/session evidence. `importLegacy` requires explicit current owner/repo attribution; it does not automatically ingest either these files or PI conversations. No supported PI transcript bridge exists in the inspected Context path.

## 6. Graph reality and bounded retrieval

**Actual node kinds:** `event`, `file`, `session`, `process`, `command`, `test_run`, `error_signature`, `checkpoint`, `revision`.

**Actual relations:** `read_from`, `edit_succeeded`, `write_succeeded`, `attempted`, `started_process`, `observed_output`, `mentions`, `recorded_in`, `checkpoint_of` (`graph.ts:6-15`).

The parser recognizes explicit success plus not-dry-run for edits/writes, a process ref rather than PID alone, explicit revision/error signature/session refs, and `toolName=test_run`; it does not derive a test result artifact/pass from command exit or emit `caused_by`/`fixes` (`graph.ts:36-61`). Graph nodes are `parsed` except checkpoint `reported`, not “verified task solved”. Graph **event** identity is `hash('event', evidence_ref)`, not `events.event_id` or invocation ID (`graph.ts:21-26`): distinct process polls with one deduplicated ref collapse to one graph event. Event-level history still exists in SQLite but graph/search are evidence-document projections, not a one-to-one invocation timeline. Failed read still creates `read_from` when input path exists; that is input association, not proof of bytes successfully read.

Synthetic compatible payloads can share file/session/process nodes and connect events. A full **session → tool invocation → error → changed file → revision → verified test outcome** chain is **not provided end-to-end**: canonical field mismatch, missing IDs, no tool/result/outcome nodes, no authoritative test artifact join. Edges in hand-shaped fixtures are useful machinery evidence, but not proof that ordinary captured history supplies those fields.

Traversal defaults/maxima (`graph.ts:70-80`): hops 2/3, returned nodes 50/100, examined edges 500/2,000, visited nodes 200/1,000, bytes 65,536/131,072, wall 25/100 ms. Generation and current retention filter before expansion; BFS directions/relations/path/timeline supported. Partial/truncation reasons are explicit. **No graph continuation**: always `next_cursor=null`; Device rejects graph cursor. Domain supports relations; CLI does not expose a relation flag. Entities are opaque and need selected evidence reads for human details. Public `local_graph` schema allows hops up to 4 and nodes up to 200 (`tool-contract.ts:11`), but the domain caps are 3/100; those upper-range schema-valid requests fail domain budget validation. `max_visited` and explicit generation are domain/CLI controls, not fields in that public schema. `local_search` schema advertises a 32,768-byte default, but validation deliberately does not materialize defaults (`tool-contract.ts:9,33-36`); omitted budget actually uses the 65,536-byte domain default. These are existing compatibility nuances, not silently fixed here.

Search defaults/maxima (`search.ts:47-52`): results 8/50, bytes 65,536/131,072, query <=4,096 bytes. Cards include ref, source/evidence class, time, generic label, **first 512 retained bytes**, reason/redaction/truncation. A small body can appear in full in the snippet; this is not 006's strictly body-free titled one-line locator. No authoritative <=1,200-token claim.

Read (`search.ts:122-172`): 1–20 refs, aggregate JSON budget default 262,144/max 1,048,576 bytes, per-ref UTF-8 boundary-checked byte ranges, content hash/retention/truncation, authenticated continuation. Search pins old generation membership; read continuation becomes stale after generation changes. CLI supports whole-ref continuation **but has no byte-range flags**; domain/Device support ranges. Available unindexed evidence can be selected-read directly, even with null generation; read is not an implicit sync. Ranges refer to **retained redacted bytes**, not original secret-bearing input offsets. Typical two domain calls are possible; no automatic two-call agent workflow has been demonstrated. `activity` is accepted as a source filter, but current sync assigns only `history` or `checkpoint` (`indexer.ts:31-33`). Search's byte cap does not bound its SQL substring scan over all retained evidence; no search wall/corpus-scan budget or p95 has been measured (`search.ts:83-97`).

## 7. Fresh measurements and reproducible counterexamples

### 7.1 Real local state, no capture activation or import

Read-only `runContextCli(['status','--cwd',process.cwd(),'--json'])` returned exit 0:

```json
{"generation":1,"indexed_through_event":0,"pending_events":0,"fts_documents":0,"freshness":"current","capture_healthy":true,"in_memory_gaps":0,"unknown_after_restart":0,"quota_gaps":0,"wiki_enabled":false}
```

These are selected fields, not the exact wire envelope. Metadata-only read-only SQL additionally observed `schema_version=3`, `journal_mode=wal`, and all of `events/evidence/evidence_fts/activity_nodes/activity_edges=0`. The status does not prove active capture or known sessions. A no-match CLI search for `P0_CANARY`, limit 1, max bytes 2,000, returned **303 stdout UTF-8 bytes including newline**, SHA-256 `68b6507f6e5ef3e45fb83581aca52d66814408784f1612209b7d72fa8b68992a`:

```json
{"schema_version":1,"ok":true,"scope":{"repository_ref":"7c598e5f12f281e16d97ad7e2bc6f5786ef496f635061977"},"index":{"generation":1,"indexed_through_event":0,"pending_events":0,"freshness":"current"},"coverage":{"complete":true,"reasons":[]},"items":[],"partial":false,"next_cursor":null,"warnings":[]}
```

The PI `bash` result for the real no-match search, including its receipt wrapper and SQLite warning, was **836 model-visible text bytes**, SHA-256 `2b17f9b54c91f20b9b4d4d194363c2d04b44e346a4abad4eaa1428c3ce238bd8`, call `call_vtJdapRyb9nTBsbo9G9eA69O`. The status was combined with unrelated bounded inventory output in one result, **5,162 bytes**; that cannot be treated as status-only overhead. No real selected read is measured: there was no retained evidence to select. No private transcript was opened.

### 7.2 Exact synthetic locate → read receipts

A disposable store, synthetic owner/repo, no approved live capture, payload:

```json
{"toolName":"read_file","arguments":{"path":"src/example.ts"},"status":"failed","result":"P0_CANARY ENOENT: synthetic missing file; task outcome UNKNOWN"}
```

Payload is 154 UTF-8 bytes; accepted time set to `1700000000000`; explicit sync publishes G1. `search({query:'P0_CANARY',limit:1,max_bytes:2000})` then `read({refs:[selectedRef],max_bytes:2000})`:

| Measurement | Search | Selected read |
| --- | ---: | ---: |
| Input compact JSON UTF-8 bytes (domain options only) | 48 | 78 |
| Output compact JSON UTF-8 bytes | **721** | **805** |
| Output SHA-256 | `af79d38e5cf130ebcd692f6f496e159002a5443ab126615f91ebbb3e96b042b8` | `020b233c429b47326b41680cfe11d8b5169b9cb772de1e128f42729a01ad27de` |
| Exact body bytes in card/read | 154, entire payload appears as snippet | 154; captured range `[0,154)` |

Domain outputs together: **1,526 bytes**, **2 domain recall calls**. The single PI `bash` result printing setup metadata, input/receipt envelopes and a Node warning was **2,435 model-visible text UTF-8 bytes**, SHA-256 `2fe6135c757165a114e32b1d5ed42e59c7d5685834988ad3d12b61b885cf50aa`, tool call `call_p3WcA0rooM9SNGm8hTP1MXnS`. This is **one harness tool call**, not two real MCP recall calls; it excludes the command-input prompt and schema costs. Scope/ref random values are disposable IDs, not credentials. Source-defined domain byte budgets are not universal transport guarantees: `src/device/gateway-channel.ts:21,523-537` caps the complete outbound Device message at **56 KiB**, so schema-valid large domain responses may still become `DEVICE_OUTPUT_TOO_LARGE`. CLI human formatting also adds pretty-printing/header bytes outside the domain budget (`cli.ts:102-106,248`).

Exact compact domain output objects:

```json
{"schema_version":1,"ok":true,"scope":{"repository_ref":"3d35042864d859109526ec67c0fc29612adf6e91c52065b9"},"index":{"generation":1,"indexed_through_event":1,"pending_events":0,"freshness":"current"},"coverage":{"complete":true,"reasons":[]},"items":[{"ref":"c2f62822eb3c22a7b444d178ec91f6f6fef8ec45cd71a680","source_kind":"history","evidence_class":"observed","timestamp":1700000000000,"label":"Retained evidence","snippet":"{\"toolName\":\"read_file\",\"arguments\":{\"path\":\"src/example.ts\"},\"status\":\"failed\",\"result\":\"P0_CANARY ENOENT: synthetic missing file; task outcome UNKNOWN\"}","match_reason":"exact","redaction_state":"retained","truncated":false}],"partial":false,"next_cursor":null,"warnings":[]}
{"schema_version":1,"ok":true,"scope":{"repository_ref":"3d35042864d859109526ec67c0fc29612adf6e91c52065b9"},"index":{"generation":1,"indexed_through_event":1,"pending_events":0,"freshness":"current"},"coverage":{"complete":true,"reasons":[]},"items":[{"ref":"c2f62822eb3c22a7b444d178ec91f6f6fef8ec45cd71a680","source_kind":"history","evidence_class":"observed","content":"{\"toolName\":\"read_file\",\"arguments\":{\"path\":\"src/example.ts\"},\"status\":\"failed\",\"result\":\"P0_CANARY ENOENT: synthetic missing file; task outcome UNKNOWN\"}","hash":"e59c43f5ad301564ed63a0463ce04b1c0ecf784c0446d7994e064641a72a7380","captured_range":{"start":0,"end":154},"total_bytes":154,"redaction_state":"retained","retention_state":"available","truncated":false}],"partial":false,"next_cursor":null,"warnings":[]}
```

Reproduction, using current `dist` proven equal to source emit, writes **only its new temp directory**:

```sh
node --input-type=module - <<'JS'
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os'; import {join} from 'node:path';
import {ContextStore} from './dist/context/store.js';
import {ContextService} from './dist/context/service.js';
const root=mkdtempSync(join(tmpdir(),'p0-audit-')), s=new ContextStore(root);
try {
 const o=s.activateOwner('p0-synthetic-owner'), r=s.repository(o,'p0-synthetic-repo');
 const c=new ContextService(s);
 const p=JSON.stringify({toolName:'read_file',arguments:{path:'src/example.ts'},status:'failed',result:'P0_CANARY ENOENT: synthetic missing file; task outcome UNKNOWN'});
 const ref=s.append(o,r,p);
 s.repoDatabase(o,r).prepare('UPDATE events SET accepted_at=? WHERE payload_ref=?').run(1700000000000,ref);
 c.sync(o,r);
 const locate=c.search(o,r,{query:'P0_CANARY',limit:1,max_bytes:2000});
 const read=c.read(o,r,{refs:[locate.items[0].ref],max_bytes:2000});
 for(const x of [locate,read]) console.log(Buffer.byteLength(JSON.stringify(x)),JSON.stringify(x));
} finally {s.close();rmSync(root,{recursive:true,force:true});}
JS
```

Random refs vary but have fixed length. This example **does not freeze a real solved session**, show trusted failure authority, exercise remote authorization or prove token economy. Model/provider tokens, wire/schema duplication, p50/p95 recall, paid costs, background Wiki/skill costs, real two-call MCP recall: **NOT_MEASURED**.

### 7.3 Capture-to-parser boundary

A one-off `node --input-type=module` test used the existing `approvalFixture` to isolate all signature/config writes in a throwaway directory (`test/context/fixtures/capture-approval.js:12-40`); **no installed authorization changed**. Actual `beginIntent({tool:'edit_file',args:{path:'src/example.ts'}})` → pending/null ref; `completeOutcome({status:'succeeded',result:{exitCode:0},durationMs:7})` → committed/succeeded and retained:

```json
{"tool":"edit_file","args":{"path":"src/example.ts"},"status":"succeeded","result":{"exitCode":0},"durationMs":7}
```

Expected 1 event and no invented file edge under current parser; observed `graphKinds=["event"]`, `graphRelations=[]`; assertion **1/1 passed**. Compare with compatible hand-shaped graph fixtures at `test/context/activity-graph.test.js:17-38`. Root cause is the producer/consumer field contract, `capture.ts:108-111` vs `graph.ts:36-37`; no change was made.

### 7.4 Late outcome after sync

Disposable domain/SQL sequence (no real capture/service mutation): create store+service as above; append a committed event and sync; insert older intent `events(invocation_id='p0-pending',accepted_at=now,execution_status='pending')`; sync while `payload_ref=NULL`; create redacted late evidence with `store.append`, remove its newly generated synthetic event, and attach the ref/status to the older intent; ordinary sync; search; explicit rebuild; search.

Observed: `pendingId=2`, first sync `indexed_through_event=2`, second sync `indexed=0`, search before rebuild **0**, after rebuild **1**. Independently repeated through the **actual observer APIs without direct SQL** using isolated `approvalFixture`: `beginIntent → service.sync → completeOutcome(result='P0_REAL_OBSERVER_LATE') → service.sync → search → rebuild → search`. Actual observer result: `eventId=1`, first watermark 1, ACK recorded true, next sync indexed 0, search matches 0 before / 1 after rebuild; one-off assertion **1/1 passed**, runner 360 ms. This removes dependence on the SQL fixture as an explanation. `indexer.ts:22-28,39` skips the null payload but advances through it; `store.ts:318` counts only IDs above watermark. This demonstrates a correctness blind spot in late result visibility; it is not a concurrency load benchmark or observed live incident. An ordinary restart converting pending to unknown does not constitute proof of late-result reindexing.

Exact actual-observer reproduction (isolated existing approval fixture; no product or installed state writes):

```sh
node --input-type=module - <<'JS'
import test from 'node:test'; import assert from 'node:assert/strict';
import {approvalFixture} from './test/context/fixtures/capture-approval.js';
test('P0 late outcome behind watermark',async t=>{
 const f=approvalFixture(t);
 const token=await f.observer.beginIntent({tool:'read_file',args:{path:'src/late.ts'}});
 const before=f.service.sync(f.owner,f.repo);
 const ack=await f.observer.completeOutcome(token,{status:'succeeded',result:'P0_REAL_OBSERVER_LATE'});
 const after=f.service.sync(f.owner,f.repo);
 const missing=f.service.search(f.owner,f.repo,{query:'P0_REAL_OBSERVER_LATE'}).items.length;
 f.service.rebuild(f.owner,f.repo);
 const found=f.service.search(f.owner,f.repo,{query:'P0_REAL_OBSERVER_LATE'}).items.length;
 assert.equal(ack.recorded,true); assert.equal(after.indexed,0);
 assert.equal(missing,0); assert.equal(found,1);
 console.log(JSON.stringify({eventId:token.eventId,through:before.index.indexed_through_event,indexed:after.indexed,missing,found}));
});
JS
```

These assertions intentionally pin the current counterexample, **not desired future correctness**. The fixture must remain temp-only and not be reused to authorize real capture.

## 8. Existing vs uncovered 006 requirements

| 006 requirements | Current verdict | Evidence / boundary |
| --- | --- | --- |
| FR-01–06 tool/session ingestion | **PARTIAL** | Durable tool observer seam and scoped legacy import; no installed capture in inspected startup, no client transcript hook/session-turn-task authority, no durable offset session queue/coverage inventory. `capture.ts`, `importer.ts`, `device.ts:148` |
| FR-07 search | **PARTIAL** | SQLite FTS5/exact text/time/source filters; not BM25 ranking, no typed entity/status/session filters or cross-repo knowledge query. `search.ts:6,47-97` |
| FR-08 locator | **PARTIAL** | Bounded cards, but generic label and up to 512 bytes of raw retained body; not strict one-line body-free title cards. `search.ts:99-102` |
| FR-09 selected read | **VERIFIED domain function / PARTIAL product recall** | Ref/range aggregate caps and cursors, fresh Unicode tests; CLI lacks range flags; real model two-call workflow unmeasured. `search.ts:122-172`, `cli.ts:16,211-218` |
| FR-10–11 activity/causality | **PARTIAL** | Bounded evidence-backed association graph, no causal edge inference; field mismatch and missing session/test/outcome lineage prevent target chain. `graph.ts:6-61` |
| FR-12,35–36 compatible surface | **Existing baseline preserved** | Existing CLI + six local schemas tested; no new facade/tool/API. This audit does not remove existing public `local_graph` to implement proposed future CLI-first policy |
| FR-13 freshness | **PARTIAL** | Explicit sync, generations/pinned search/stale read, bounded partial output; missing transcript coverage and reproduced late-outcome hole. `indexer.ts`, `search.ts`, `service.ts` |
| FR-14 bypass/no-match | **No-match VERIFIED; automatic bypass MISSING** | Real local empty no-match response measured. Nothing in this path supplies Palace relevance policy/agent startup hook |
| FR-15–22 Wiki | **MISSING from Context** | `WIKI_DISABLED`, `wiki_enabled=false`, no provider/queue/link/revision/sync/contradiction implementation; offline Wiki behavior cannot be claimed. `tool-contract.ts`/`device-adapter.ts:19`, `service.ts:131` |
| FR-23–27 no-guide cross-repo bootstrap | **MISSING** | Instance-local common-dir identity and raw permission enforcement exist; no shared scoped knowledge identity or automatic locator. `repositories.ts:25-30` |
| FR-28–34 learning/lazy merging | **MISSING learning/curator** | Bundled Context skill and external Gateway lazy skill catalog are not evidence of learned-skill generation, validation/publish/rollback or scheduled merging. No schedule created |
| FR-37 Gateway preservation | **No changes; acceptance NOT_MEASURED** | Canonical develop SHAs pinned; no UI/auth/WSS/runtime regression suite or production operation |
| FR-38 owner/ref security | **VERIFIED scoped baseline / future Palace untested** | Active-owner/repo authorization before query/ref lookup, authenticated cursor binding, sealed-owner tests. No cross-owner Wiki implementation to accept |
| FR-39 bounded output | **PARTIAL** | Search/read cursors, graph quotas/typed errors; graph has no cursor, budgets are bytes not tokenizer contracts. No global efficiency claim |

No 006 task checkboxes were changed. Full 006 P0 tasks **T003–T007** (supported client capture, real replay/cross-device corpus, A/B freeze, baseline lifecycle costs, upstream version/license/security audit) remain unfulfilled except the explicitly reported narrow measurements. This report is not a provider selection or P1 authorization.

## 9. Fresh test/command receipts and limits

Commands were run once each, with bounded tool timeouts; no uncontrolled loops, package install, `npm test`, production jobs or build-output rewrite.

| Command / expected | Observed |
| --- | --- |
| `node scripts/check-context-acceptance.mjs` — retained 002 inventory consistency | Exit 0, `passed=true`, 32 requirements / 8 success criteria / 62 tasks, **9 checked_tasks**. Harness labels itself `implementation-consistency-not-independent-review`; not full acceptance proof |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Exit 0, 741 files, total reported 13.64 s; no emit. Build packaging/UI/CA copy steps **not run** |
| TypeScript API `readConfigFile → parseJsonConfigFileContent → createProgram → program.emit(callback comparing text to existing files)` | 142 emitted JS texts compared **in memory**, `emitSkipped=false`, **0 mismatches**. No `dist` write. Establishes these focused dist-based tests exercised current source, not freshness of every package asset |
| `node --test test/context/access.test.js test/context/graph-query.test.js test/context/mcp-contract.test.js test/context/read-ranges.test.js test/context/capture-outcomes.test.js test/context/activity-graph.test.js test/context/capture-faults.test.js` | **33/33 pass**, 0 failed/cancelled/skipped; 6,137 ms reported runner duration |
| `node --test --test-name-pattern='search/status are read-only\|stable exact-match bucket\|read cursor issued\|FTS syntax characters\|pinned keyset pagination' test/context/retrieval.test.js` | **5/5 selected pass**, 0 failed; 3,081 ms. Other retrieval tests not claimed |
| `node --test test/context/import.test.js test/context/redaction.test.js test/context/repositories.test.js` | **9/9 pass**, 0 failed; 1,660 ms. Temporary identity fixture worktree action disclosed in §2 |
| One-off actual observer fixtures (§7.3 and §7.4), separate invocations | **1/1 pass** each, 481/360 ms; counterexamples assert current mismatch/late-result behavior, not that integration is fixed |
| Byte/late-outcome harnesses (§7.2,7.4), real status/search/gate/metadata reads | Exit 0; exact observations above; temporary harness writes only temp trees |
| `git diff --exit-code; git status --porcelain=v1 --untracked-files=all` before report | Empty; source unchanged |

Total fresh assertions: **49** across the listed runs. They do not establish a green full Device/Gateway suite, Linux parity, production capture, new-repo recall or full 006 acceptance. SQLite experimental warnings observed. Historical `docs/STATUS.md:51-55` checks remain historical, not substituted for these receipts.

### Frozen narrow regression anchors (not a full Palace corpus)

All fixtures/tests are pinned by source SHA above. SHA-256 of executed source tests:

```text
fd9c56173a9297dd7a1e6dd05b2cb0eaa258c71f0660330fbb0c8441a2ccb987 test/context/capture-faults.test.js
a7973e8a5ab58da1893cb1709b8f68f71740d7fb522b1030a4875fbf732ef376 test/context/capture-outcomes.test.js
9f017b6083ef645df1eafd0dce329bc644805d5131e00164089343a02c9735ed test/context/activity-graph.test.js
e363d49940adfd296f9e65f19cf4b1c681b8badb3d92afea1100ca63321d6aea test/context/graph-query.test.js
0fac439920191b056f171c381656efc70e8de30b77ef5c3b31b08ee7139ca2c8 test/context/read-ranges.test.js
a88a66ec1ed759739515d7b2f72c234562b95a42c3ab5a6a96e8648a7a93cd76 test/context/retrieval.test.js
febc364bc5fe39d906399bdc9a6d18bf45598626be9e534aedae7cdf749aafc4 test/context/access.test.js
5ac7642e69f0f2663e254b6a4eb99ee4ed201f743f305a5b7a3149c70ab8db6a test/context/mcp-contract.test.js
```

## 10. Smallest next phase proposal — not execution authorization

**P0-B: freeze one supported client/event-boundary corpus before any Palace feature code.** Use an explicitly authorized **Pi** adapter candidate and disposable sanitized fixtures, not a provider install, schema migration or service deployment. Authoritative PI session JSONL shows session/message parent IDs, model changes and tool call/result messages; this audit inspected only session headers/control metadata, not private transcript bodies or a supported capture hook. Decide privacy/hook support explicitly; JSONL availability alone is not permission to ingest all chats.

Deliver one versioned proposed event contract and small frozen fixture manifest: explicit owner/device/repo-instance/revision, source adapter + cursor/event ID, real invocation join; optional session/turn/task/parent IDs with provenance/unknown labels; separate command exit/test artifact/task-reported outcome; coverage/gaps and retained input/output refs. Include success, failure, missing outcome, retry, delayed outcome, incompatible capture shape and unauthorized-scope controls. Keep 1.0.11 schemas unchanged.

**Gates before separately authorized implementation:**

1. A canonical observer-shaped event must yield only supported graph associations; freeze the current mismatch as a negative fixture. No fabricated session/error/test-pass relation.
2. A late outcome after a published sync watermark is either deterministically indexed next time or explicitly reported as a visibility gap; the current silent zero-result behavior must be caught by a regression.
3. Duplicate/out-of-order/restart replay has stable logical identity and bounded checkpoint progress; no executable tool replay, no conflation of identical bodies from distinct sessions.
4. Secret-path/payload tests, unknown/other owner, denied repository/ref and retention controls fail closed. Raw evidence stays source-authorized; no shared clone identity grants access.
5. Freeze same-client/model native-tool control and exact output/token accounting, including zero-match and known-file/no-memory controls. Real selected reads required; byte counts alone cannot prove token savings. Background Wiki/skill costs remain zero only because they are not yet implemented, not because future maintenance is free.

Only after that evidence, ask for a separate minimal P1 adapter/normalization task addressing the confirmed producer/consumer contract and late-result visibility. **Do not start it now.** ReMe/OpenViking evaluation, cross-repo Wiki transport and skill learning remain subsequent decisions; code graph/AST is not a prerequisite.

## 11. Final audit disposition

**DONE — bounded current-state audit with 3/3 Explore results and 1/1 Plan challenge reconciled.** This is not a full 006 P0 evaluation acceptance: real corpus/client hook/A/B/background cost/upstream evaluation gates remain **INCOMPLETE / NOT_MEASURED**. No product files changed; no deployment, Context merge, backend install, scheduler or P1 work. The temporary-worktree fixture deviation is explicitly disclosed in §2.

Pre-commit validation freshly **PASS**: paired Markdown fences; no draft/pending markers; exact embedded JSON receipt lengths/hashes (721/805 bytes); eight pinned regression-test digests; 67 source citation bounds; both embedded Node repro scripts syntax-checked without execution; no recognized credential-prefix matches; all 51 006 task checkboxes still open; four successful workflow entries and exact journal digest. Product/spec/config tracked diffs were empty, and the report was the only untracked path. The validator initially hit a Windows UTF-8 decoding default and incomplete abbreviated-path resolution; explicit UTF-8 and unique source-path mapping corrected those validation-harness errors, with a subsequent clean PASS.

Delivery is one report-only commit on existing `main`; staged-only diff and post-commit tree/status verification are recorded by the persistent PI session. The commit SHA is supplied in the final delivery response (a report cannot embed its own Git commit SHA). **Stop here and await the user's next instruction.**
