# Checkpoint 2 review packet — Phases 4–6

Branch: `feat/mcp-device-1.0.11-context`. Environment: Windows x64, Node 22.22.2, built-in node:sqlite/FTS5. Requested disposition: READY_TO_PROCEED / REVISE_IMPLEMENTATION / BLOCKED. This packet is implementation evidence, not independent approval or release authorization.

## Delivered surfaces

- Phase 4: local ContextService CLI, read-only state access, JSON/error parity, checkpoint observed Git vs reported summaries, portable source skill and behavioral tests.
- Phase 5: quota admission/accounting including sealed namespaces, trusted owner-admin cleanup, retention/cursor invalidation, restart unknown-outcome semantics, generation/privacy/concurrency tests.
- Phase 6: typed evidence-backed activity graph on explicit sync, bounded keyset BFS and deterministic truncation, neighbors/path/timeline/related, CLI graph, selective search relations, scoped foreground cancel and no-auto-maintenance tests. See `us4.md` for exact supported input facts and limits.

## N1–N7 closure status (reviewer must verify)

| Finding | Implementation status | Remaining gate |
| --- | --- | --- |
| N1 fail-open capture/gap | Domain gaps and unknown-after-restart exposed; synthetic crash tests exist | Actual observer fail-open wiring/route coverage remains Phase 7; not end-to-end closed |
| N2 bounded writer batches/yield | Existing acquisition and transaction tests; sync remains synchronous bounded-count foreground work | NOT CLOSED: real per-batch yield/heartbeat responsiveness and 5/50 ms lock budgets need independent measurement/remediation before live capture |
| N3 total quota/admin cleanup | Device/owner/repo admission and explicit local TTY cleanup implemented/tested | Independent durability/privacy review and platform matrix still required; no enablement approval inferred |
| N4 pinned membership | Search membership generation predicate, authenticated keyset; graph evidence visibility filtered by published generation and current retention | No historical content MVCC claim; future mutation/deletion needs explicit stale/view semantics |
| N5 persistence redaction | Import/capture/checkpoint persist redacted retained text; graph parses only retained evidence and exposes opaque entity keys | Live observer normalization still needs integration tests |
| N6 shared root key | Installation key, separate signing/redaction subkeys, scope-bound cursors and adversarial tests retained | Platform ACL/rotation regression remains part of final matrix |
| N7 disabled wiki | Reserved disabled/status manifest and no provider loading in graph/maintenance | Public registration/parity deferred Phase 8 |

## Evidence

- `checkpoint2-complete.tap`: full context suite, actual command `node --test test/context/*.test.js`.
- `phase6-build.log`: actual `npm run build` output and strict TypeScript compilation.
- `phase6-graph-benchmark.json`: 100-event shared-file hub, 20 measured traversals with real examined/visited counts.
- `us4.md`: scope/task mapping, tighter safety ceilings, privacy and cancellation limitations.
- Existing Phase 4/5 test files: `cli`, `checkpoint`, `skill-contract`, `event-model`, `quota`, `concurrency`, `generation`, `privacy`.

Ask the independent reviewer to check graph truth vs unknown legacy outcomes, hidden derived writes, scope/retention isolation, query plan/index boundedness, synchronous maintenance/cancel limitations, and N2/N3 enablement gates. Linux/manual client discovery/actual gateway capture are NOT_MEASURED here. Do not mark all N findings closed merely because the local suite passes.
