# Proposed Data Model: Reconciled Runtime and Canonical Dispatch

Status: NOT READY FOR IMPLEMENTATION. Numeric fields reference a future approved policy,
not previously proposed values as binding limits. Semantic constraints are explicit below.

## CandidateIncrement (US1/US5)

Fields: ID, source HEAD, tracked patch hash, untracked path/content hashes, evidence hashes,
lane acceptance provenance, requirement IDs, existing source paths, new-file rationale,
disposition, decision classes, prerequisites, rollback, independent approval.
Constraints: `candidate identity includes source and evidence hashes`;
`lane DONE is not final integration acceptance`;
`new source files require an existing-module insufficiency rationale`.
Disposition enum keep/revise/revert/pending; state captured/reconciled/trial/review/accepted/
rejected/blocked. File inputs 2968280+6a5f43f; dirty process identity captured before change.

## ToolDefinition, Dispatcher and RequestContext (US6)

Definition fields: canonical name, public schema, existing handler, result/error contract,
capabilities, resource admission class, transport mapping references. Dispatcher owns
validation/invocation; adapters own protocol mapping, not duplicate business logic.
Context fields: trusted origin stdio/gateway, remote boolean, client attribution, roots,
config/runtime scope, UI/history/telemetry policy, cancellation/deadline.
Constraints: `one canonical dispatcher, multiple transport adapters`;
`request context is isolated per invocation`;
`untrusted metadata cannot grant remote privileges`;
`accepted Gateway runtime spawns zero self-MCP-server children`.
Runtime fields: readiness/reason, immutable generation, lifecycle ownership; no self child
PID required, nullable compatibility update childPid allowed after evidence. States
initializing/ready/unavailable/stopping/stopped. External stdio remains a supported adapter.

## ResourcePolicy (all stories)

Fields: revision, covered routes, resource dimension/scope/unit, byteLimit/countLimit/
maxAge/queueDeadline, classification, source evidence, calibration, saturation/expiry,
owner approval and boundary tests. Class enum externally-constrained-hard-limit /
baseline-observed / proposed-calibration / acceptance-tier / owner-decision.
Constraints: `all covered legacy and opt-in routes share aggregate accounting`;
`unapproved policy cannot be activated`;
`every managed dimension has byte/count/age coverage or a justified not-applicable record`.
Dimensions include retained/decoded output, chunk/metadata records, waiter/request counts,
queue payload/keys, input/replacement/result expansion, worker/session/history counts,
parser stdout/stderr/media allocations, spill bytes/lease/files and evidence retention.
Numeric limit null denotes pending calibration and BLOCKS activation, never unlimited.
Memory guardrails distinguish managed reservation from measured RSS/library overhead.

## ProcessSession, OutputRange and ReadRequest (US2)

Session fields: immutable ID (not PID alone), PID, authorized context, root state,
nullable root exitCode/signal, stdout/stderr closure, outputFinal, capturedEndOffset,
oldestAvailableOffset, gap ranges, lease refs, creation/activity/completion/expiry,
waiters, stdin FIFO/EOF, lifetime/pipe/kill deadlines and cleanup owner.
Constraints: `reads are idempotent over retained captured ranges`;
`absolute offsets do not change on eviction`;
`expired ranges return OFFSET_EXPIRED with explicit gaps`;
`no server-side consumer registry is required`;
`expiry does not depend on reader drain`.

Read fields: sessionID, nonnegative integer absoluteOffset/maxBytes/waitMs, returned
start/end, nextOffset, retentionUntil, rangeComplete and runtime state. Budgets/deadlines
validate against approved profile; wait=0 is nonblocking in new path. Legacy offset/line
adapter preserved. Records: absolute byte start/end, stream stdout/stderr, observed receipt
sequence, raw bytes and UTF-8 decoder fragments; coalescing bounds count overhead.
Nullable exitCode is not converted to zero. Root states requested/spawned/running/exited/
spawn_failed; capture states open/closed/forced_incomplete/expired; termination states
none/requested/graceful/forced/verified/failed. A reader at end is not global drained state.

## SpillLease (US2/US3)

Fields: opaque authorization-scoped ID, owner, bounded path/permissions, byte/count
reservations, ranges/checksums, createdAt/activity/completion, maxAge/TTL, expiry/failure,
cleanup journal and release state.
Constraints: `expiry is independent of final drain`;
`expiry is bounded by createdAt plus approved maxAge`;
`authorize every recovery`;
`release reservations exactly once`.
States reserved/writing/readable/failed/expired/deleted. Effective expiry is min of maxAge,
completion TTL when present and abandonment TTL; failed write exposes unavailable ranges.
History and refs expire consistently; restart sweeps only owned files under valid root.

## ResourceOperation and EditEntry (US3)

Fields: canonical parent/path/stable filesystem identity, authorization, queued payload
reservations, snapshot/hash, mutation type, entry search/replacement/expected count,
original or sequential mode, target/temp/metadata outcome, cancellation.
Constraints: `empty exact search is rejected; empty replacement is allowed`;
`participating mutations serialize per canonical resource`;
`detected snapshot mismatch rejects before commit`;
`external conflict detection is best-effort, not atomic compare-and-swap`;
`original-snapshot mode rejects overlapping ranges before mutation`.
Existing sequential batch stays sequential unless approved additive mode selected.
States validated/queued/revalidated/preflighted/applied/failed/rejected/cancelled; mid-commit
failure reports observed state, not guaranteed no mutation. Aliases/nonexistent targets,
permissions/ACL/crash/hard-link handling follow runtime contract and platform evidence.

## SearchRun, Match and Continuation (US3)

Fields: mode/stateful-or-one-shot, root, supported regex/glob/case/media scope, ordered
key, file identity, typed match/context records, found/fullyReturned/contextOmitted,
count/byte quotas, incomplete/oversize reason and optional continuation.
Constraints: `context cannot consume reserved match budget`;
`maxResults counts actual match records globally`;
`search does not promise an atomic directory snapshot`;
`MATCH_TOO_LARGE is found but not fully returned`.
New proposed order canonical relative path then line/submatch; candidate/legacy order
change requires drift review. One-shot non-resumable limit is explicit; a new continuation
must validate stable keys/identities or return SEARCH_CHANGED. No unbounded full-result sort.
States running/complete/incomplete/failed/cancelled/expired.

## EvidenceRun, CalibrationProfile and Decision (US1/US4/US5/US6)

Fields per [evidence contract](contracts/evidence-contract.md). Calibration profile records
proposed/approved sample/warmup/block/bootstrap/checkpoint/GC/settle/threshold/stress budgets,
required routes/metrics, frozen workload primary/protected metrics and owner approval.
Constraints: `failed samples remain in raw evidence`;
`unavailable metrics are null with scope and reason`;
`statistics are frozen before candidate comparison`.
DecisionClass enum correctness_security / architecture_simplification / performance.
acceptanceStatus enum ACCEPT/REJECT/BLOCKED; performanceDecision enum KEEP/REVERT/INCONCLUSIVE.
Constraints: `correctness acceptance does not require a performance win`;
`architecture acceptance requires zero self-server children and transport equivalence`.

## IntegrationGate (US5)

Fields: increment/hash, author/reviewer, prerequisites, approved policy/drift, decision
classes, reports, findings, both-platform required evidence, blockers/rollback/status.
Constraints: `reviewer identity differs from author`;
`shared-component acceptance precedes dependent adoption`;
`missing required evidence blocks acceptance`;
`material changes invalidate dependent gates`.
Final combined gate references accepted increments and independent compatibility,
adversarial/stress evidence; no release permission is included.

## Relationships

Adapters reference one canonical registry and isolated contexts. All owned work reserves
from shared policies; sessions/operations own leases. Candidate gates bind exact source/
evidence and prerequisite gates. Calibration precedes activation; lane acceptance and
final combination acceptance are distinct. No per-reader state is needed to own retention.
