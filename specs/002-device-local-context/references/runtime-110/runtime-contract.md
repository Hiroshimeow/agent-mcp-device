# Proposed Runtime and Shared-Transport Contract

Status: PROPOSED / NOT READY FOR IMPLEMENTATION. OD-1/OD-2/OD-3 in [spec](../spec.md)
are activation blockers. All implementation mentioned here is future, reconciled work.

## Canonical dispatch and adapters (US6)

Invariant: **One canonical tool implementation/dispatcher, multiple transport adapters.**

```text
External MCP Client -> MCP stdio adapter ---\
                                           > Canonical dispatcher/registry -> existing handlers/tools
Gateway -> GatewayDeviceChannel -> adapter-/
```

Extract/reuse `src/server.ts` registration and dispatch; do not import a side-effectful
server bootstrap into device startup. A narrowly separated proposed `src/tool-dispatcher.ts`
is justified only because current registration, MCP request wrappers and business dispatch
are coupled in server.ts. Prefer extraction over a second registry/framework. Existing
handlers/tools remain canonical business implementations; Gateway mapping, guardPath,
assertSuccess and capabilities remain transport-specific contracts.

Dispatcher receives immutable per-call context (origin, remote flag/client attribution,
authorized roots, config scope, cancellation/deadline, usage/history policy). Do not use
shared mutable currentCallIsRemote/currentRemoteClient or toggle process.env during calls.
Inventory imports of existing globals/config remote mode before replacing them. Remote
semantics previously inherited by the self-server child must be reproduced explicitly,
including working directory and telemetry/onboarding/history exclusions. Trusted adapter
sets authorization context; arbitrary external metadata cannot grant remote privileges.

Gateway public capabilities/schema mappings are NOT identical to stdio tools. Differential
cases compare mapped canonical inputs and documented adapter transformations, separately
against each baseline route: head/tail, dry_run, PID/session_id, assertSuccess exceptions,
unsupported capability errors, image preview, shell_execute and project_inspect.
Gateway-only business implementations must be reused as canonical functions rather than
copied into stdio; public exposure is unchanged unless approved. Existing shell_execute
semantics are not replaced with start_process by assumption.

Migration stages: extract equivalent dispatcher -> stdio adapter equivalence gate ->
direct Gateway adapter/lifecycle trial -> both-route/security/no-child architecture gate ->
remove obsolete engine if full source/test caller inventory is empty or migrated.
Actual baseline symbol is LocalExecutionEngine (`src/device/execution-engine.ts`), not
DesktopCommanderIntegration. Preserve readiness/reason/generation, shutdown ordering,
update-helper childPid=null support, reconnect and runtime ownership. Remove SDK Client /
StdioClientTransport only from internal remote path, not external MCP support.
Rollback on any unexplained schema/result/error/security/context/lifecycle drift or self
child reappearance. Trial fallback is an explicit rollback revision, not hidden per-call
self-MCP fallback. No performance win is presumed.

## Coverage and legacy/global boundedness (OD-1)

| Route/surface | Shared accounting | Legacy behavior | Activation requirement |
| --- | --- | --- | --- |
| External stdio and direct Gateway | All tool calls and owned work count in same runtime scopes | Schemas/mapped defaults/results/security preserved | Dispatch differential and approved policy |
| Legacy process/virtual node | Output/records/waiters/input/sessions/spill count | Active implicit reads, positive/tail and completed replay retained | Any new saturation/lifetime behavior requires approved drift |
| File/media/search/edit legacy | Acquisition, worker/queue/input/output/media allocations count | Stateful/document/fuzzy/media retained | No silently bypassed aggregate guarantee |
| Opt-in bounded paths | Same shared accounting, no separate unlimited pool | Additive semantics | Calibrated policy and prerequisite gate |
| Evidence collectors | Own separate finite retention/accounting | Not product cleanup proof | Frozen run profile |

Accounting can be instrumented without enforcing new rejection. Full bounded acceptance
requires owner-approved enforcement across covered routes; preservation is not permission
to leave a hidden unlimited legacy pool. OD-1 selects approved saturation drift or an
explicit time-limited exception with excluded guarantee/risk/expiry. Until then activation
and full bounded claims are blocked. No exception is approved by this revision.

## Policy classification and missing dimensions

Every value has scope, class, evidence, owner, approval state, byte/count unit, saturation,
expiry and boundary tests. New arbitrary values are not invented to close a table.

| Value/dimension | Classification now | Required calibration/decision |
| --- | --- | --- |
| Gateway shell timeout <=28000 ms; maxBuffer 1 MiB | Baseline-compatible observed limit, not discovered universal transport ceiling | Preserve mapped behavior; assess overflow flags/tree cleanup |
| Gateway image source 32 MiB / preview 32 KiB | Baseline-compatible observed route limits | Preserve media envelope/base64 semantics |
| Legacy process 50 Mi characters, forced 1 Mi-character line split | Baseline observed limit, not byte/aggregate guarantee | Capture existing eviction behavior; approve changed semantics |
| 256 KiB response; 1 MiB/session / 32 MiB aggregate retention | Proposed starting values requiring calibration | Actual encoded ceilings/variance/legacy drift OD-1 |
| 64 MiB/session / 512 MiB aggregate spill; 64 KiB observer window | Proposed starting values requiring calibration | Recovery cost, disk budget and retention OD-2 |
| 16 processes; 4 workers; 64 queue entries; 128 history entries | Proposed starting values requiring calibration | Load/admission compatibility OD-1 |
| 15-minute TTL; stdin 256 KiB/64 requests; exact input 16 MiB; batch 64 entries | Proposed starting values requiring calibration | Lifetime/expiry/input/mutation policy OD-1/OD-2/OD-3 |
| Search 1000 matches / 2000 context records | Proposed starting values requiring calibration | Result cap semantics vs byte envelope OD-1 |
| External transport hard ceilings | Externally constrained hard limit only after discovery | Record route/version/measurement; do not label proposals hard limits |
| Wait/lifetime/kill-grace/pipe-close deadlines and maximum ages | Owner decision required | Finite deadlines before activation OD-2 |
| Reader waiters/observers/request count, chunk records/metadata bytes | Owner decision required after calibration | Per-session/runtime count+byte caps; coalesce chunks |
| Queue input/replacement/result bytes, canonical key registry | Owner decision required after calibration | Reserve before acquisition/enqueue; bound output expansion |
| Spill file/lease counts and per-file/search-operation quota | Owner decision required after calibration | Per-operation + global bytes/count; lazy creation |
| Parser partial line, native stdout/stderr/diagnostic bytes, media allocations | Owner decision required after calibration | Bounded capture or explicit error, preserve special routes |
| Total managed memory / RSS guardrail and evidence files/bytes/max age | Owner decision required after calibration | Include metadata/native/library buffers; RSS is measured, not a falsely exact allocator cap |

Capture every activated value in run manifests. Reject before enqueue/acquisition when
reservations fail; explicit code/used/limit/retryability. Saturation after irreversible
output generation must expose unavailable ranges. Producer pause/termination/data-gap
policy needs OD-2; this document does not silently select killing legacy processes.

## Simple process output model (US2)

Preferred new interface: `read(session, absoluteOffset, maxBytes, waitMs)` is non-consuming.
Session identity is immutable and not bare reusable PID. No server consumer-ID registry,
destructive cursor or delivery acknowledgement is required. Optional acknowledgement is
only a future GC hint and cannot mean delivered/executed; no new GC hint is required now.

Append-only logical stream consists of observed stdout/stderr arrival records with stream
label, absolute byte start/end; order is observed receipt, not causal OS ordering. Bounded
coalescing limits record overhead while preserving stream tags. Raw bytes remain exact;
UTF-8-safe text pages maintain decoder fragments and nextOffset at emitted byte boundary.
If requested bytes cannot contain a complete codepoint, return explicit insufficient-budget
error/minimum, never advance an empty page. Raw binary/base64 is opt-in and envelope-budgeted.

Response: requested/returned range, nextOffset, oldestAvailableOffset, capturedEndOffset,
rootExit/pipeClosed/termination status, nullable code/signal, outputFinal, rangeComplete,
retentionUntil and gaps. `outputFinal=true` only after both pipe closure or explicitly
reported forced capture closure; forced loss is separately marked, never clean complete.
`rangeComplete` means requested available range delivered without silent gaps, not reader
consumption. No global “all consumers drained” state exists. Legacy implicit line index
and completed replay stay in adapter until approved drift.

Retry returns identical bytes for an already captured range while retained; active stream
may append beyond that range. Returned retentionUntil is bounded by published max age;
reads do not extend indefinitely. Retry after expiry/quota eviction returns OFFSET_EXPIRED
with first unavailable range and oldestAvailableOffset, not an unconditional recovery
promise. Spill preserves absolute positions; tail/observer reads are views and do not
advance others. Reconnect keeps session if runtime alive; restart invalidates old identity.

## Process state, waiting, EOF and cleanup (OD-2)

| Event | State/result | Bounded action |
| --- | --- | --- |
| launch requested | pending until spawn or spawn_failed | finite approved spawn confirmation deadline |
| spawned/root running | ready/session retained | lifetime separate from call wait |
| call wait expires/cancelled | current available range/state | remove waiter; do not kill child |
| root exit | rootExited with code/signal; pipes may remain open | start approved pipe-close deadline; retain late output |
| pipes close | outputFinal; root state distinct | seal range and start completion TTL |
| lifetime/explicit kill | termination_requested -> graceful -> force -> verified/failed | approved finite grace/force/verification deadlines on each platform |
| pipe-close deadline expires | inherited-pipe timeout, capture incomplete/gap | bounded descendant escalation/capture closure per OD-2; no forever wait |
| TTL/max age/abandonment | expired session/lease/range | release owned reservations once; explicit stale/expired result |

All durations validate finite nonnegative integers with calibrated upper bounds; legacy
negative/zero/default behavior captured first. New wait zero is nonblocking; new lifetime
absence follows explicitly approved finite ownership policy, not immortal resources.
Root lifetime termination does not by itself prove descendant/pipe closure. Kill failure
is visible. A bounded overall runtime shutdown deadline records survivor PIDs before
emergency cleanup. Never conflate process exit code with invented success code.

Stdin is FIFO across accepted writes; writable backpressure preserves accepted order.
EOF is ordered after previously accepted writes, closes only once, later writes fail.
Acknowledgement reports bytes accepted to stream, not executed by child. A partial write
on failure reports acceptedByteCount and failure; no successful partial acknowledgement.
Cancellation only removes unstarted writes. Kill races have deterministic queue admission
and closed-input outcomes; no global lock blocks unrelated sessions.

## Spill/retention ownership

Lazy spill preserves requested output only where value is justified; opaque authorization-
scoped references are not arbitrary filesystem paths. Reserve per-operation/global
bytes AND file/lease counts before write. States: reserved/writing/readable/failed/expired/
deleted. Effective expiry is min(createdAt+maxAge, completionAt+completionTTL if complete,
lastActivityAt+abandonmentTTL); reads do not extend maxAge. All durations require OD-2.
Session/history and lease records remain consistent until expiry; dangling refs return
explicit expired/unavailable metadata. Active never-closing sessions still hit maxAge.
Shutdown/restart sweeps only owned names with validated root/permissions and crash journal;
release exactly once. Disk-full/tamper/permission failure exposes gaps and cleanup result.
No cleanup depends on a reader reaching end.

## Files, search ordering and final match budget (US3)

Adapt existing candidate budget utilities/handlers first. Multi-read bounds acquisition
as well as final response, preserves input order/errors/media and returns byte/intra-line
continuation plus file identity. Snapshot change on continuation rejects mixing versions;
no directory-wide snapshot is promised. Spill selected overflow lazily, not entire files
by default. Metadata alone too large is preflight error, not omitted paths.

Proposed one-shot search order: canonical root-relative paths in lexicographic normalized
separator order, then increasing line/submatch position. Bounded traversal emits one file
at a time; use bounded external sort/spool only if native traversal cannot supply that
order. Ordering changes to existing candidate/legacy require baseline/drift review.
One match record per matched line preserves existing counting; multiple submatches are
additive data, not silently additional maxResults. Stateful/document search retained.
Search is weakly consistent: no atomic tree snapshot; each scanned file has identity and
before/after metadata/hash checks as supported. Detected changes mark incomplete/conflict;
undetected concurrent changes are disclosed limitations. New continuation reruns with
last stable key and identity checks or returns SEARCH_CHANGED; it never promises a
resume into an immutable tree. Initial one-shot may simply be non-resumable and report
limitReached; legacy stateful session pagination remains available.

Budget algorithm: reserve encoded envelope/status/continuation metadata first; accumulate
actual match records into match region under global maxResults and total byte budget;
only after match selection fill context with remaining bytes and separately calibrated
context count/byte caps. Final renderer may not prefix-truncate a mixed context/match
list. Bound matcher/parser partial records and native stderr separately. Oversized match
returns a small MATCH_TOO_LARGE record with path/line if fitting and authorized bounded
snippet/range or spill reference; if even identification cannot fit, explicit envelope
error. It is counted as found, not fully returned; no context substitutes for it.
Output records retain match/context types and found/returned/contextOmitted counts.
Native `-m` alone is not a global maxResults. Native failure/permission incompleteness,
no match, timeout and parser failure are distinct; fallback only if verified equivalent.

## Edit guarantees and candidate batches

Retain exact count guards and fuzzy diagnostic behavior. Empty exact search is rejected;
empty replacement is allowed. Baseline single-edit newline/normalization remains captured.
Existing file candidate batch is sequential against evolving content: preserve and test
that meaning unless an approved additive original-snapshot mode is justified. Such mode
resolves all entries against original snapshot, rejects overlaps/absent/ambiguous targets
before mutation and writes once. Do not silently reinterpret existing sequential batches.

Participating mutations share FIFO canonical-resource identity, with source/destination
locks sorted for moves. Existing realpath/stat identities identify aliases where stable;
nonexistent target uses canonical parent + basename; hard-link handling must either lock
stable filesystem identity when available or explicitly reject unsupported aliases in
new exact path. Windows case handling follows actual filesystem semantics, not blanket
lowercase alone. Path authorization rechecked inside ownership boundary.

External conflict guarantee is **best-effort snapshot detection**, NOT atomic cross-process
compare-and-swap. Detected mismatch before commit rejects; external write between final
check and replacement may be overwritten. In-process FIFO does not close that race.
If stronger guarantee is required, prove cooperative locking/atomic primitive on both
platforms before advertising it. Inject the check/commit race and assert documented
limitation, not an impossible guaranteed conflict.

Write-to-temp/replace is proposed per-file no-partial-content publication where supported;
crash durability, permissions/ownership/ACL preservation and hard-link effects require
platform proof. Fail preflight if required metadata cannot be preserved; mid-commit error
reports observed original/temp/target state, not universal no-mutation promise. No multi-
file atomic transaction is claimed. Patch is optional restricted syntax with full path
preflight and explicit per-file outcomes. Prototype/equivalence precedes any value claim.
