# Quickstart nghiệm thu — feature 002 sau implementation

**Cảnh báo**: Đây là validation guide cho phần mềm tương lai. Không dùng dữ liệu production để smoke-test một implementation chưa qua gates.

## Preconditions

- implementation authorization đã có;
- Node >=22.13;
- built-in `node:sqlite` + FTS5 pass trên host;
- dùng temporary `MCP_DEVICE_CONFIG_DIR`;
- chuẩn bị repo fixture A/B, hai worktree của A, một same-origin separate clone, một non-repo directory;
- nếu chạy live capture/gateway thì G-110 handoff phải được chấp nhận.

## Q1. Store/retrieval independent lane

Không cần live observer. Import/synthesize event fixture cho A/B, gồm:
- read/edit success;
- failed/dry-run edit;
- shell/test error;
- process references;
- redacted canary secret;
- malformed legacy JSONL.

Run:
```text
mcp-device context status --cwd <A> --json
mcp-device context sync --cwd <A> --json
mcp-device context search --cwd <A> --query "fixture-marker" --json
mcp-device context read --cwd <A> --ref <ref> --json
mcp-device context graph --cwd <A> --action neighbors --ref <ref> --json
```

Expected:
- exact/path/identifier and FTS hits have valid refs;
- B marker never appears in A;
- redacted canary absent from DB/blob/FTS/output;
- read preserves retained bytes/ranges;
- graph relation has evidence ref;
- no provider/network call;
- repeated import no duplicate source event.

## Q2. Capture lifecycle after G-110

Exercise every supported public execution route with healthy store.

Expected:
- exactly one committed intent identity per invocation;
- one final outcome update;
- direct shell/project/image routes not missed;
- `local_*` results not self-ingested.

Fault injection:
1. pre-intent DB unavailable/busy beyond budget;
2. crash after committed intent before dispatch;
3. crash after side effect before outcome update;
4. outcome update failure.

Expected:
- never replay side effect because recorder failed;
- healthy route is exactly-once;
- gap/degraded counter visible when pre-intent fails;
- committed unresolved event becomes `unknown_after_restart`;
- transport/delivery state never overwrites execution outcome.

## Q3. Scope and re-pair

Test:
- two worktrees same local repo;
- same-origin distinct clone;
- cwd outside repo;
- ambiguous parent cwd;
- account/device re-pair;
- forged ref/cursor;
- cursor from wrong generation/query/scope.

Expected:
- worktrees share repo history but current revision stays separate;
- distinct clone not auto-merged;
- unscoped/ambiguous event stores metadata only, no searchable payload;
- old namespace sealed from new remote account/skill/default CLI;
- forged/tampered cursor denied before query;
- no arbitrary DB path.

## Q4. Local CLI / sandbox

Block gateway/network.

When state root is accessible, `status/search/read/graph` still work and match MCP domain outputs on same generation.

Run the same CLI under a sandbox/profile that cannot access/write required SQLite WAL state. Expected typed `LOCAL_STATE_UNAVAILABLE` or `ACCESS_DENIED` and **no suggested/automatic remote fallback**.

Checkpoint:
- observed Git metadata is observed;
- free-form summary remains reported;
- no fabricated command/test event.

## Q5. Cooperative maintenance

Without explicit `sync/rebuild/checkpoint`:
- startup/read/search/status/idle produce zero index mutation;
- no hidden worker.

`sync`:
- consumes pending retained events;
- updates FTS/activity relations incrementally;
- advances generation watermark;
- no full-copy generation.

`rebuild`:
- builds shadow derived state;
- interrupted rebuild leaves last-good active;
- publish does not alter source-event count/hash.

High-degree graph query:
- asserts visited/examined counts;
- stops by internal node/edge/time/byte budget;
- partial result explains truncation.

## Q6. Retrieval quality

Freeze query corpus before performance tuning.

Pass criteria:
- exact path/identifier: relevant evidence top-3 in 100% cases;
- error/command/natural-language history: Recall@8 >= 0.90 overall;
- unauthorized cross-scope hits: 0.

Latency measurements from samples failing correctness are invalid.

## Q7. Concurrency/durability

Run concurrent capture/sync/read on Windows/Linux:
- one SQLite writer contention;
- bounded busy timeout;
- maintenance yields to capture;
- disk full/DB corrupt;
- crash during migration/rebuild;
- cursor generation pinned while maintenance occurs.

No infinite wait. No parse/network/source IO inside write transaction. Report process-crash durability separately from power-loss durability mode.

## Q8. Public tools and gateway

Snapshot six tool schemas:
`local_status`, `local_search`, `local_read`, `local_graph`, `local_index`, `local_wiki`.

Expected:
- first four read-only;
- local_index actions only sync/checkpoint/rebuild/cancel;
- local_wiki in 002 is disabled/status-only and makes zero provider calls;
- old device returns unsupported, no gateway-side execution;
- gateway filesystem/log/DB marker scan finds no context content;
- total schema token estimate <=10,000 or owner-approved exception exists.

Do not remove project_list/NMem/external broker in this feature.

## Q9. Skill

Use source skill manually/explicitly on supported Codex/Pi/VS Code profiles; no automatic installer required.

Scenarios:
- “research work yesterday” → search/read;
- missing/stale relevant index → bounded sync;
- ordinary read/grep/typo → no sync;
- “update graph” → sync/activity graph, not wiki;
- permission denial → no remote bypass;
- re-pair old namespace → not auto-selected.

## Q10. Performance

Reuse accepted 1.0.10 harness for combined live route tests.

Report:
- capture off/on;
- healthy and busy/failure capture;
- exact/FTS/hybrid;
- sync no-op/incremental/rebuild;
- activity graph low/high-degree;
- concurrency.

For each: correctness identity, workload count, median/p95/max, CPU/RSS/event-loop delay if available, DB/WAL/blob bytes, visited/examined counts. No “<1 ms” claim without raw evidence.

## Exit criteria

- independent lane tests pass;
- G-110 integration tests pass where applicable;
- Windows/Linux matrix pass;
- retrieval target pass;
- privacy/scope/adversarial pass;
- CLI/MCP parity pass;
- schema/help/skill source match implementation;
- independent review returns no Critical/High spec/implementation blockers;
- owner explicitly authorizes merge/release separately.
