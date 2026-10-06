# US4 activity relations — Phase 6 implementation evidence

## Scope and task mapping

The owner explicitly authorized Phase 6 implementation and a local commit in the current session. No merge/publish/live capture authorization is inferred. The owner's T038–T044 summary and checked-in `tasks.md` use different task descriptions. This increment covers both: typed graph materialization (T038/T039), bounded queries/tests (T040/T041), graph CLI and index-job tests (T042), scoped cancel/job behavior (T043), and this acceptance/review packet (T044).

Design: reuse existing repo-local `activity_nodes`/`activity_edges`, with opaque deterministic keys and directional evidence-backed edges. Parse retained redacted JSON only during explicit sync; ordinary capture/import does not build relations. Unknown/unstructured/redaction-invalid JSON produces only an event node rather than invented facts. Use indexed per-node keyset adjacency reads (`LIMIT 1`), deterministic BFS and a visited set. No parser, provider, background scheduler or general graph framework.

## Supported facts

- Events link to file/session/command/durable process execution/revision/error/test-run entities when fields are explicitly present.
- Supported synthetic/import JSON fields: `toolName`, `arguments.path`, `arguments.command`, `status`, `dry_run`, `session_ref`, `process_ref`, `revision`, `error_signature`. Successful edits/writes/process starts require explicit `status=succeeded`; dry-run edits remain attempted. Legacy output alone does not prove success.
- Checkpoint Git metadata stays observed in source evidence; summaries/claims stay reported. Graph extraction is labeled parsed (checkpoint nodes reported), never an observed native trace.
- No caused-by/fixes/decision edges. PID alone is ignored. Graph stores no raw labels/paths/commands or secret metadata.
- Sync runs in the existing quota admission/transaction; repeated sync/rebuild preserves deterministic node/edge identities.

## Query and CLI contract

`ContextService.graph`: neighbors/path/timeline/related, ref or node seeds, directed/both traversal, relation filters, optional published generation. Current retention always overrides generation visibility. Another repository's seeds are not found; sealed-owner access fails before lookup. Graph queries open query-only handles and never sync.

Default hops=2, hard hops=3; default nodes=50, hard nodes=100 (owner-requested tighter ceilings than policy-v1's 4/200). Examined edges 500/2000; visited nodes 200/1000; UTF-8 response bytes 65536/131072; wall budget 25/100 ms. Counts and `truncated_by` accompany partial results. Deterministic truncation is chosen instead of graph continuation; `next_cursor=null`. Rerun with larger permitted budgets to inspect more. Wall-time checks bound cooperative algorithm work, not OS/SQLite statement preemption; response serialization and database opening are not included in traversal wall budget.

CLI example:

```text
mcp-device context graph --cwd . --action neighbors --ref <evidence-ref> --max-hops 2 --json
```

Optional search `include_related=true` expands each returned hit with a small bounded graph, returning related refs plus partial/examined metadata. Existing exact/FTS ordering and authenticated pagination remain unchanged. Foreground cancel releases only a scoped pending job; synchronous running work completes before another request can execute. No persistent daemon cancellation protocol is claimed.

## Verification and representative work

Build and full test output are retained in `phase6-build.log` and `checkpoint2-complete.tap`. Tests cover successful/failed/dry-run relations, cycles, high-degree caps, depth, bytes, generation visibility, retention, sealed namespaces, wrong repositories, quota saturation, CLI/domain parity, selective search expansion, explicit-sync-only behavior and scoped jobs/cancel/idempotency.

`phase6-graph-benchmark.json` retains 20 correctness-checked Windows/Node 22.22.2 samples over a 100-event shared-file hub. Each sample visits/returns 100 nodes, examines 101 edges and returns 99 edges, stopping on returned-node cap. This is nonzero-degree bounded work, not an empty-query latency claim. Linux and Node-floor measurements remain NOT_MEASURED; final cross-platform/performance acceptance belongs to T057/T058.

## Review limitations

No independent reviewer was available inside this delegated execution; Checkpoint 2 approval is NOT_GRANTED. Existing maintenance batching/yield and real gateway-loop responsiveness require N2 review before live wiring. Historical imported events need explicit status/correlation fields for stronger relations. Derived rebuild replays immutable retained evidence transactionally rather than providing historical content versions. No new package dependency or package version/engine change is needed for this Phase 6 increment; T059 owns release/runtime metadata.
