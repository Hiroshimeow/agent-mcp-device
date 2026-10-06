# Revised Research: Reconcile Existing Candidates Before Architecture Changes

2026-10-04, read-only. Inputs: full final Astra review from the supplied transcript,
revision-cycle architecture review, baseline source, prior raw research and a fresh
read-only candidate verification agent. No build/product test/implementation executed.
All paths below are relative to E:/git-project/ unless marked integrate-relative.

## Current architecture evidence and migration decision

**Decision**: One canonical tool implementation/dispatcher, multiple transport adapters.
Extract/reuse existing server registry/dispatch; direct Gateway invokes canonical tools,
stdio remains available as a migration/comparison surface pending OD-4; permanent
public support is not inferred from its existence. No automatic speed claim or engine-file deletion.

**Evidence** (integrate baseline source):
- src/device/execution-engine.ts:4-5 imports SDK Client/StdioClientTransport; :39-60
  initializes internal client, :73-86 resolves node dist/index.js; :109-118 calls MCP tools.
- src/device/device.ts:7,29,99 creates/initializes LocalExecutionEngine; :139-149 injects
  GatewayToolAdapter/runtime state; :157,174 update handoff uses engine child PID;
  :250-257 shuts channel and engine down. Actual name is LocalExecutionEngine, not
  DesktopCommanderIntegration as described conceptually by architecture review.
- src/device/gateway-tool-adapter.ts:131 engine injection; :195-250 maps Gateway calls
  through callClientTool; :263-285 edit dry-run/read/edit. runShell :75-123, imagePreview
  :149-192 and project_inspect :250-254 are existing direct business functions.
- src/server.ts:264 tool registry/list request; :1173-1190 request/UI wrapper;
  :1198-1226 remote metadata writes module globals; :1249-1447 tool switch;
  :1458-1474 history/usage/onboarding context; :175-176 process.env remote-mode logic.

Current path: Gateway -> GatewayDeviceChannel -> GatewayToolAdapter -> LocalExecutionEngine
-> SDK Client/StdioClientTransport -> spawned self node dist/index.js -> MCP server -> tools.
Target eliminates ONLY internal self hop. Extraction must preserve remote child environment/
working-root/config/readiness/security/lifecycle semantics in per-call context. Importing
server directly with registration side effects or changing process.env during calls is
not a safe shortcut. Request metadata is not trusted authorization.

**Alternatives**: Keep self proxy for isolation (only if concrete requirement justifies it;
owner target requires gated removal); duplicate Gateway implementations (rejected);
pure extraction into tool-dispatcher.ts (proposed narrow boundary if existing server
cannot safely expose list/invoke). Deleting execution-engine.ts before migrating tests,
status/update PID and all callers is rejected.

## Candidate identities and durable acceptance

| Lane | Verified HEAD/state | Reconciliation meaning |
| --- | --- | --- |
| file | 6a5f43fdfdee1774c3c18458b5cebe58f11b2751, clean | Durable lane DONE, accepted input; final integration gates still open |
| process | ee87d0f3057e01e8087db99615d14bd1b4c626d4, six tracked changes + untracked test | Capture patch/files before revising; latest DEV routes TEST, not accepted |
| bench | d388843ba5c374e6d06a61d7ebbdb06fff0ff68a, five historical artifact changes | Existing harness to extend; canonical latest evidence incomplete |
| compat | baseline, untracked test/compat JSON | Existing categories/fixtures to adapt; runner/comparator absent |
| review | baseline clean, ignored repro | No completed adversarial REVIEW acceptance found |
| stress | baseline clean, no .plan results found | No final stress acceptance |

File commit 29682809b8ac7c8a8ac76bfb58375651389bb815 is bounded file/search/edit candidate;
6a5f43fdfdee1774c3c18458b5cebe58f11b2751 preserves independent quota correction.
Durable reports under wt-mcp-device-110-file/.plan/mcp-device-110-file-search-edit-20261002/
share filename prefix mcp-device-110-file-search-edit-20261002- and suffix
_cdpa-idem-3a022a33f8046bf86528ab3f.md:
plan_turn5:5,19-35 routes DONE and records clean committed correction;
review_turn2:5-21,44-76,95-113 CLEAN REVIEW;
test_turn1:7-19,59-77,88-145 Windows/Linux lane PASS, 62/64 Windows modules,
baseline service failure reproduced and independent self-update equivalence incomplete.
Earlier plan_turn3/4 missing-durable-evidence rejection was superseded; do not describe
file lane as no review. Retained test-turn1-r1-native.patch matches committed 6a5f43f
patch after LF normalization. DONE is durable lane evidence, not universal performance,
full Linux-suite or final combined transport/RSS acceptance. Tracker routing alone never
substitutes for these reports and code hashes.

Process `git diff --binary HEAD` exact output SHA256 at inspection:
a94dd9297b65ad10507496514bf005e04a8654cd9a750bf8a420cbe59e888989.
Untracked test/test-process-runtime-110.js SHA256:
9c35e9abee4fac770630057f5dcf4bf79867530494245b4ece0ee5aef965b834 (8663 bytes).
Tracked candidates: gateway-tool-adapter.ts, terminal-manager.ts, improved-process-tools.ts,
schemas.ts, types.ts, test-read-completed-process.js. Patch hash excludes untracked test;
future capture must record both raw command bytes and all file hashes to be reproducible.
Untracked tests include drain-once assertions that do not prove legacy replay compatibility.

**Decision**: Reconcile -> verify -> keep/revise/revert -> integrate. Start file work from
accepted commits; process from hash-identified dirty patch. No mandatory new src/runtime
abstractions. Existing budget, lock and harness utilities are extension points.
**Alternatives**: Cleaner from-scratch rewrite (rejected absent demonstrated insufficiency);
blind merge of lane DONE (rejected without final independent gates).

## Earlier offset evaluation (historical rationale; Round 4 below supersedes text coordinates)

**Decision**: Prefer new append-only logical byte ranges with idempotent explicit-offset
reads; retain legacy implicit line adapter and completed replay. No mandatory reader-ID/
destructive consumer registry. Session immutable identity prevents PID reuse; expiry
returns OFFSET_EXPIRED rather than unconditional delivery recovery.

| Requirement | Explicit absolute offset | Server destructive consumer state |
| --- | --- | --- |
| Multiple readers/observer | Independent client offsets; no registry | Registry/count limits and ownership conflicts |
| Lost response/reconnect | Retry same retained range | Need commit/replay tokens and retained delivery window |
| Memory reclamation | Bounded age/quota, explicit expiry; no reader-dependent GC | Acknowledgements can reclaim but abandonment/max-age still needed |
| Completed replay | Natural repeated range; legacy adapter preserved | Drain-once changes observed baseline unless separate adapter |
| Complexity | Stable positions, metadata/expiry; fewer mutable states | Consumer generations, atomic advance, retry conflict semantics |

A GC watermark could be optional only if measurements justify it; it never claims delivery.
Astra identified unsupported retry promise and unbounded consumer/waiter metadata. Simpler
model removes reader registry, not the need to bound pending waits/chunk count/spill age.
Process sibling terminal-manager.ts:608-658 cursor arithmetic, :575-580 eviction offsets,
:327-330,383-389 initial-tail acknowledgement are static risks requiring reproduction,
not new proven failures. Exit->close :477-505 and detached inherited-pipe repro require
bounded escalation rather than waiting forever. Baseline :556-643 completed replay is
observable and remains protected.

## Resources, process lifecycle and owner decisions

**Decision**: All covered owned work within each runtime instance shares accounting;
separate processes have separate domains, not an implicit machine-wide broker. Activate
finite enforcement only after calibration/owner-approved drift; no silent unbounded pool.
Bound counts/metadata/queue payloads as well as bytes; max age/abandonment cleanup does
not wait for final drain. State separates root exit, pipe close and capture incomplete;
stdin EOF is ordered, kill escalation and deadlines finite after OD-2.

**Rationale**: Astra HIGH 1-3 found opt-in bounds versus global guarantee conflict, missing
reader/waiter/record/lease/queue input dimensions and retention after final drain only.
The revised policy table preserves observed Gateway shell 28000 ms/1 MiB and image
32 MiB/32 KiB route values; all 256 KiB/1/32/64/512 MiB and 16/4/64 etc proposals are
classified, not falsely ratified. Total managed/native/library memory must be evaluated,
not claimed bounded merely by output cap. Scope/drift OD-1 and expiry/escalation OD-2 remain
owner-review blockers. Producer-kill policy not selected silently.
**Alternatives**: Unlimited compatibility bypass (rejected); arbitrary invented caps
(rejected); approved bounded saturation drift or explicit limited exception (owner choice).

## File/search/edit reconciliation and actual guarantees

**Decision**: Adapt candidate filesystem/handlers, output-budget.ts, searchOnce and edit
locks/batches; revise only independently reproduced gaps. Keep stateful/document/media
and fuzzy diagnostics. Exact external conflicts are best-effort, not atomic CAS.

**Evidence**: file tools/filesystem.ts:679 Promise.all and handlers/filesystem-handlers.ts:
247-318 budget after acquisition/inexact nextOffset; search-manager.ts:222-355 one-shot
and handlers/search-handlers.ts:105-120 final prefix truncation; edit.ts:118-135 resolved/
lowercase lock, :377-409 sequential batch. These are targeted seams, not reason for
second implementation. Match/context types survive final render in revised proposal;
lexical path/line order is an additive design with bounded spool if needed and explicit
weak tree consistency/SEARCH_CHANGED, not an assumed immutable directory snapshot.
Oversize matches have MATCH_TOO_LARGE outcome before context fills leftover bytes.

Astra HIGH 4: check-then-replace cannot guarantee detection of external write between
check/commit. Revised contract discloses race and requires platform proof for stronger
locking/atomic guarantees and metadata/crash safety. Existing sequential batch is not
silently redefined original-snapshot; any additive mode needs prototype/equivalence.
Astra HIGH 5: prototype precedes exploratory measurement/scope approval; shared acceptance
must precede consumer adoption. MEDIUM 6 search ordering/oversize and 7 three decision
classes/statistical calibration are now explicit proposals; not owner approvals.

## Reuse benchmark/compat and preserve historical facts

**Decision**: Extend bench/run.mjs:78-150 and lib/core.mjs:44-45,117-139,247-258; reuse
lib/mcp-stdio.mjs:7 target seam, fixtures.mjs:44-59, scenarios/all.mjs:252-278 and
bench/test/core.test.mjs. Add missing test/compat runner/comparator over existing
compat-contract-v1.0.9.json:8-58, not duplicate scripts/review-110 stack.
Statistics/tiers proposed; calibrate and freeze before candidate result. Correctness,
architecture and performance decisions separate. No >=10% requirement for a necessary fix.

Historical raw retained: Windows standard 509 raw/443 measured/60 invalid; stress
129 raw/108 measured/15 invalid; 75/551=13.61% measured harness-invalid, not product
failure probability. Linux 440/383 standard and 117/98 stress, zero raw-invalid but six
summary resource rows missing PID attribution. Windows harness 533bec7290a8190e5a1b2ff80747edd81b5312ac,
Linux 5c4710aa06871ee8f4e79a0b21d12349d9bd0eb9, not latest d388843; Node versions differ.
Sources wt-mcp-device-110-bench/bench/results/v1.0.9/{g6-win32,g8-linux}/raw.jsonl and
BASELINE.md:135-142. Windows raw:119 shows survivor; :553 buffer wait ~49939 ms/PID present.
Revised 65536 wide-line cap scenario is not same as 760000 tiny lines; 4.94 s report
smoke without canonical located raw is not full acceptance. Emergency cleanup in latest
scenario keeps measurements usable, not proves product descendants cleaned up.

File raw .plan/.../dev-benchmark-results.json: two warmups/seven samples, candidate
multi-read only 50 lines, 709013->61893 bytes, 19.910->18.186 ms median but unequal work;
22.427->23.364 p95. Batch 17.052->8.393 and search 167.102->157.787 remain descriptive.
Linux remote aggregate 8 calls/0 failure delta/2440 request/14467 response bytes has no
latency/CPU/RSS; unsupported search/multiread and missing Windows remote remain explicit.
Review detached-pipe source exists, no completed adversarial lane report; stress has no
final results. Historical outliers/failures need dispositions, not inferred root causes.

## Round 3 source reconciliation (historical; Round 4 lineage below supersedes trial sequencing)

Both reviews are materially supported, not accepted blindly: candidate-only output-budget,
bench and compat files are absent in integrate; identity capture alone cannot make them
editable. [Round-3 contract](contracts/round3-execution-contract.md) defines exact future
archive/patch/fixture materialization with tree/hash verification, never execution now.

The current ownership topology splits shell/image/project in Gateway parent and tool calls
in self child. An all-route accounting gate before removing that child would certify a
replaced topology. Revised order: evidence-only MVP -> relevant owner decisions -> canonical
runtime/bootstrap migration -> no-child gate/topology freeze -> reservation-core gate ->
domain adoption gates -> final all-route proof. Later changes invalidate route hashes;
no primitive synthetic pass is claimed as runtime boundedness.

Bootstrap verified: src/index.ts:5 imports bootstrap first; bootstrap.ts:17-21 defaults
UV_THREADPOOL_SIZE to 16 before first work and preserves user override. mcp-device.ts:3-6
forces remote and dynamically imports remote without first bootstrap. Child removal must
move the minimum early init guarantee to actual bin, preserving config load/index.ts:46-62,
remote feature exclusion:54, logger/transport separation:39-44, error listeners:67-98,
Chrome/PDF init:127-128 as relevant, cwd/environment/execution-engine.ts:73-86 and lifecycle.
Do not copy server transport callbacks into device startup. Tests use fresh subprocesses,
import-order assertions, user override and native parallel filesystem stress; no tests run.

Public support assumption corrected: package.json bins are dist/mcp-device.js; README lists
only device commands; mcp-device.ts says publishes authenticated runtime only. Internal
index.js plus npm inspector is evidence of internal/dev surface, not proof permanent
public contract. OD-4 A/B/C is PENDING; preserve migration dependencies until selected.
One canonical business dispatcher remains unconditional; external adapter status does not.

Gateway repo read-only evidence: agent-mcp-gateway/scripts/device-access-policy.mjs:3-6
HARD_MAX_INPUT_BYTES/HARD_MAX_OUTPUT_BYTES=48*1024, default output 48 KiB; :106-107
clamps per-rule limits; :196-201 measures Buffer.byteLength(JSON.stringify(result),'utf8')
and rejects DEVICE_OUTPUT_TOO_LARGE. This is access-policy cap, NOT WebSocket/network
ceiling. Safe device result budget must account for measured object/envelope/base64 and
may be lower; 256 KiB proposal is not valid for Gateway. Network discovery remains.

Gateway authenticated-mcp-wrapper.mjs:218-225 process schema offset>=0,length 1..65536
(default 8192); :249 describes absolute pagination; :540-571 maps owner public session to
device remote session, 12-second outer read wait and termination map removal. Baseline
GatewayToolAdapter still passes those fields to line-based MCP tool. Do not infer byte
units from schema wording; current actual mapping is frozen until approved version drift.
Canonical byte API and legacy line adapter remain distinct; cross-repo evidence required.

Security/context verified remote reads outside server: filesystem.ts:296-303, filesystem-
handlers.ts:86, config-manager.ts:117, usageTracker.ts:102, trackTools.ts:21,
tools/config.ts:4,110 and device.ts:111. Inventory classifies immutable runtime mode versus
per-call trusted origin/authorization, local-client and telemetry/history state. Exact seam
matrix/refinement before source work prevents another hidden global singleton; explicit
arguments preferred, ALS only if justified by discovered asynchronous consumers.

Deterministic strict UTF-8/raw errors and split owner dependencies close remaining proposal
gaps; numeric activation choices are still PENDING. Astra F1/F3/F4/F5/F6 addressed in
ordering/exact seams/oracle-first/raw-byte contract/trial wording; F2 remains honest owner
blocker. This is document closure, not runtime acceptance.

## Round 4 independently verified remediation

**Decision**: Per-stream byte offsets for strict text projections, separate global raw
receipt ledger. **Rationale**: E2(stdout),58(stderr),82AC(stdout) forms euro over disjoint
global ranges; one contiguous text range was ambiguous. **Alternatives**: global text
pagination with cross-stream closure groups adds complexity/head-of-line blocking; reader
registry unnecessary. New output contract supplies five exact examples, maxBytes meanings,
sourceRanges/fences/errors and invalid independent stream behavior. Prior global-text
proposal is superseded, not retained as a competing normative rule.

**Decision**: AUTH-D discovery envelope before materialization/restore/run, separate OD-3A/B
acceptance approval later. **Rationale**: prior evidence storage approval depended on the
calibration it enabled. Human bounds (time/disk/files/processes/cleanup/routes) are safety
permission, not product capacity or statistics. MVP gate checks harness only. No maxima
are invented. Canonical matrix in owner-decisions.md replaces conflicting ranges.

**Decision**: Original source + oracle overlay evaluated before dependency composition;
accepted architecture/core parents immutable, domains derive exact three-way reviewed
compositions and fresh builds. **Rationale**: prior original tests edited before unchanged
claim, and accepted ARCH root reused. Separate source/repo/test/dependency/build/evidence
identities remove ambiguity; conflicts especially Gateway adapter stop rather than overwrite.
Use only COMBINED_TRIAL for cross-domain accounting, no vague accounting root.

**Build evidence confirmed**: .gitignore:7-8 ignores dist; package.json build recreates dist,
prepare builds and test/integration rebuild. test/test-gateway-device-channel.js:13-23,
test/test-execution-engine-hardening.js:17 and test/test-enhanced-repl.js:3 import dist.
Bench README:17-22,64-83 requires install/build. Source archive alone is not runnable.
BP records restore/lock/toolchain/source/build-log/dist hashes and invalidates on source
changes; test scripts that rebuild cannot silently alter executable identity.

**Session evidence confirmed**: gateway-tool-adapter.ts:226 returns String(PID), :230,238,245
Number(session_id); terminal-manager.ts:298,466-482,556-574 keys active/completed by PID.
Static reuse risk, not reproduced exploit. Proposed immutable generation+nonce device key
is assigned explicitly to read/interact/terminate migration; outer Gateway ownership kept,
legacy PID compatibility separate. Forced PID-reuse oracle prevents A key resolving B.

**Disposition of review inputs**: Astra F1 per-stream model/examples; F2 AUTH-D vs calibrated
profile; F3 immutable originals/oracle/domain/hardened identity; F4 canonical matrix.
Architecture B-F1 BP; B-F2 explicit ARCH_CORE domain composition; B-F3 one combined root;
B-F4 stale surface/import closure gates before acceptance; B-F5 device key/PID-reuse path;
B-F6 final docs/traceability/regression before unique eligibility stop; B-F7 OD-4 conditional
final transport with historical comparator distinct; B-F8 product SC-006 no cycle clause;
B-F9 constitution wording patch only. No implementation or approval claimed.

## Review closure versus readiness

Astra eight material findings incorporated: aggregate coverage, count/age ownership,
idempotent retry/root-pipe lifecycle, actual external-race guarantee, prototype/prerequisite
ordering, search budget/consistency, three-class calibrated policy, and honest checklist.
Architecture review adds canonical dispatch/no-self child, candidate-first reuse, unratified
constitution and simpler output model. Detailed contracts are proposed, not ratified.
OD-1/OD-2/OD-3A/OD-3B/OD-3C/OD-4 and governance ratification remain PENDING with
separate dependency scopes; optional batch/patch does not block architecture.
Actual transport/runtime/variance discovery follows separate authorization; final platform/
compatibility/adversarial/stress evidence is later acceptance, not required to pretend now.
