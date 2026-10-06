# Runtime and Shared-Transport Contract

## 1.0.10 shipped scope amendment

This amendment takes precedence over the historical proposal below. The remaining
proposal is future work, not an assertion that all guarantees shipped.

- Remote startup uses `GatewayDeviceChannel -> GatewayToolAdapter ->
  dispatchToolCall` in `src/tool-dispatcher.ts`, invoking existing handlers in the
  daemon process. It does not initialize `LocalExecutionEngine` or spawn
  `dist/index.js`; there is no hidden per-call self-MCP fallback. User-requested
  process tools may still spawn processes after startup.
- Once the channel/direct dispatcher is established, the advertised runtime state
  is `runtime_ready: true`, `runtime_reason: null`, and
  `execution_runtime_generation: direct-in-process:<bootNonce>`. Readiness does
  not depend on an execution-engine child or that child's death. A tool error
  does not itself invalidate direct runtime readiness; connectivity remains a
  separate channel concern.
- `MCPDevice.start()` generates `bootNonce = randomUUID()` at the beginning of
  every start, including repeated starts on the same instance. The nonce is a
  runtime-generation UUID, not a process-session identity or authorization token.
  Shutdown tolerates an uninitialized engine, and update child PID is nullable.
- PID-collision stopgap: after spawn and before registering the new session, an
  existing active PID entry rejects admission with an explicit collision error
  and attempts to kill the newly spawned conflicting child; it never overwrites
  the existing active record. A completed entry for a reused PID is evicted
  before the new session is registered. Kill failure is logged; verified tree
  termination is not claimed by this stopgap.
- Gateway `session_id` is a string at its public adapter boundary and callers
  should treat it as opaque. In 1.0.10 the device implementation still serializes
  a PID and validates canonical positive safe-integer strings (or legacy numeric
  IDs) for internal lookup. This is NOT sessionNonce-based identity, nor stale
  handle isolation after PID reuse/restart. Legacy output remains line-based;
  raw global byte ranges and per-stream text ranges are not shipped.
- Aggregate resource accounting and T034-T038 (Process sessionNonce, raw global
  ranges, per-stream text ranges and their gates) are **Deferred -> 1.0.11**.
  `resource-accounting.ts` is removed from source and clean package output. Existing
  per-call output budgets are shipped; they do not imply aggregate memory, RSS,
  disk, reservation, or all-route accounting guarantees.

Evidence: `test/test-remote-startup-no-child.js`,
`test/test-gateway-device-channel.js`, `test/test-pid-collision-guard.js`, and
`evidence/1.0.10/claims-matrix.md`. Windows suite verification is not an independent
native Linux stress gate or completion of the proposal's historical BP protocol.

## Historical proposal (not shipped guarantees)

Status: PROPOSED / NOT READY FOR IMPLEMENTATION. OD-1/OD-2/OD-3A/OD-3B/OD-3C/OD-4 in [spec](../spec.md)
are split dependency blockers in [owner decisions](../owner-decisions.md), all PENDING.
All implementation mentioned here is future reconciled work in materialized trial roots.

## Canonical dispatch and adapters (US6)

Invariant: **One canonical tool implementation/dispatcher, multiple transport adapters.**

```text
External MCP Client -> MCP stdio adapter ---\
                                           > Canonical dispatcher/registry -> existing handlers/tools
Gateway -> GatewayDeviceChannel -> adapter-/
```

External stdio is currently an internal/inspector baseline surface, not proven public
support. OD-4 selects A public preserve/gate, B internal/dev migration preservation or
C eligible retirement after evidence. Keep it available in trials until that decision;
no durable permanent support assertion is made.

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
StdioClientTransport only from internal remote path; external adapter disposition
requires OD-4 and its migration evidence.
Rollback on any unexplained schema/result/error/security/context/lifecycle drift or self
child reappearance. Trial fallback is an explicit rollback revision, not hidden per-call
self-MCP fallback. No performance win is presumed.

## Coverage and legacy/global boundedness (OD-1)

| Route/surface | Shared accounting | Legacy behavior | Activation requirement |
| --- | --- | --- | --- |
| OD-4-retained stdio and direct Gateway | All tool calls and owned work count within their runtime instance | Schemas/mapped defaults/results/security preserved | Dispatch differential and approved policy |
| Legacy process/virtual node | Output/records/waiters/input/sessions/spill count | Active implicit reads, positive/tail and completed replay retained | Any new saturation/lifetime behavior requires approved drift |
| File/media/search/edit legacy | Acquisition, worker/queue/input/output/media allocations count | Stateful/document/fuzzy/media retained | No silently bypassed aggregate guarantee |
| Opt-in bounded paths | Same shared accounting, no separate unlimited pool | Additive semantics | Calibrated policy and prerequisite gate |
| Evidence collectors | Own separate finite retention/accounting | Not product cleanup proof | Frozen run profile |

Accounting can be instrumented without enforcing new rejection. Full bounded acceptance
requires owner-approved enforcement across covered routes; preservation is not permission
to leave a hidden unlimited legacy pool. OD-1 selects approved saturation drift or an
explicit time-limited exception with excluded guarantee/risk/expiry. Until then activation
and full bounded claims are blocked. No exception is approved by this revision.

Accounting scope is per active runtime instance. After self-hop removal, authenticated
Gateway parent is one ownership domain; separate stdio runtime, if supported under OD-4,
is another domain. No device-wide IPC/shared-memory broker is proposed. Freeze topology
before accounting adoption. Core synthetic tests prove reservations only; per-domain
adoption gates precede final all-covered-route enforcement proof. Instrumentation before
migration is discovery, not acceptance of the final ownership topology.

## Policy classification and missing dimensions

Every value has scope, class, evidence, owner, approval state, byte/count unit, saturation,
expiry and boundary tests. New arbitrary values are not invented to close a table.

| Value/dimension | Classification now | Required calibration/decision |
| --- | --- | --- |
| Gateway shell timeout <=28000 ms; maxBuffer 1 MiB | Baseline-compatible observed limit, not discovered universal transport ceiling | Preserve mapped behavior; assess overflow flags/tree cleanup |
| Gateway image source 32 MiB / preview 32 KiB | Baseline-compatible observed route limits | Preserve media envelope/base64 semantics |
| Legacy process 50 Mi characters, forced 1 Mi-character line split | Baseline observed limit, not byte/aggregate guarantee | Capture existing eviction behavior; approve changed semantics |
| Gateway JSON input/output 48 KiB | Known current access-policy hard cap, NOT network ceiling | device-access-policy.mjs:3-6,196-201; full result JSON, safe per-tool budget may be smaller |
| 256 KiB non-Gateway response; 1 MiB/session / 32 MiB retention | Proposed values requiring calibration; 256 KiB is NOT Gateway-compatible | Actual route ceilings/variance/legacy drift OD-1 |
| 64 MiB/session / 512 MiB aggregate spill; 64 KiB observer window | Proposed starting values requiring calibration | Recovery cost, disk budget and retention OD-2 |
| 16 processes; 4 workers; 64 queue entries; 128 history entries | Proposed starting values requiring calibration | Load/admission compatibility OD-1 |
| 15-minute TTL; stdin 256 KiB/64 requests; exact input 16 MiB; batch 64 entries | Proposed starting values requiring calibration | Lifetime/expiry/input/mutation policy OD-1/OD-2/OD-3C |
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

## Minimum child-bootstrap migration contract (US6)

`src/index.ts:5` imports bootstrap first; `src/bootstrap.ts` sets UV_THREADPOOL_SIZE=16
only when user value absent, before first libuv work. `src/mcp-device.ts` currently starts
remote without that first import. Direct Gateway must preserve early bootstrap in its
actual bin entry before dynamic device/config/FS imports, not copy index.ts wholesale.
Tests inspect import order and fresh subprocess environment before first FS operation,
including user override; starvation repro compares parallel slow-FS workloads on both
platforms. No benchmark is run in this cycle.

Canonical init separates immutable runtime mode from trusted per-call context: load
config with equivalent remote defaults/persistence policy, exclude remote feature flags,
initialize logging without a synthetic MCP transport, choose runtime working directory
without process-wide cwd changes per call, explicitly carry environment/shell assumptions.
Inventory `src/index.ts`, `src/bootstrap.ts`, `src/mcp-device.ts`, `src/npm-scripts/remote.ts`,
`src/config-manager.ts`, `src/utils/{feature-flags,logger,capture,usageTracker,trackTools}.ts`,
`src/tools/config.ts`, `src/tools/pdf/markdown.ts`, `src/error-handlers.ts`.
Assess Chrome/PDF initialized callback relevance and preserve required behavior via lazy
or explicit init evidence; do not gratuitously start downloads or duplicate uncaught/
unhandled listeners. Preserve shutdown ownership, readiness/generation, reconnect and
nullable update child PID. Fresh-process tests exercise config failure, logging/error
policy and listener counts. Bootstrap test is before architecture acceptance, not later
accounting. Exact runtime/context seam matrix is a task-refinement gate before source edits.

## Process public adapter mapping

Canonical operations are separate `readRaw(session,globalOffset,maxBytes,waitMs)` and
`readText(session,stream,streamOffset,maxBytes,waitMs)` per [output contract](process-output-contract.md).
The Round-3 merged text/global-offset proposal is replaced; never reinterpret legacy fields.
Legacy stdio `read_process_output(pid,offset,length,timeout_ms)` uses LINE offsets/count:
zero shared new-output index, positive absolute line, negative tail, completed replay.
Preserve this compatibility adapter for OD-4-required lifetime; expose bytes only through
an approved additive contract, not same field-name silent drift.
Gateway wrapper has public session_id, nonnegative offset, length 1..65536 default 8192,
outer owner/device->remoteSessionId mapping and 12-second outer read timeout
(authenticated-mcp-wrapper.mjs:218-225,540-571). Baseline device adapter maps offset/length
to legacy line tool. Schema description says absolute but does not prove byte units.
Freeze observed mapping; any new byte-based Gateway interpretation requires approved
cross-component drift/version mapping, not guessing from nonnegative schema. OD-3B captures
authorized end-to-end evidence; gateway repo stays read-only. Preserve outer session owner
isolation and current mapped errors/timeouts. Native baseline/unit differential cases
must assert line vs byte units on multibyte and multiline fixtures.

## Process output model (US2)

Normative decoding, offsets, examples, session mapping and PID-reuse behavior are in
[process-output-contract.md](process-output-contract.md). The following lifecycle rules
use explicitly named globalRaw/stdout/stderr coordinate spaces; text nextOffset is
stream-local, never a global contiguous coverage claim.

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
lastActivityAt+abandonmentTTL); reads do not extend maxAge. Process durations require OD-2;
file/search operation lease durations require OD-1, with identical shared cleanup mechanics.
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
