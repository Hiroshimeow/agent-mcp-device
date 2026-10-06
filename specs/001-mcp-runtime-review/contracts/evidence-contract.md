# Proposed Evidence, Calibration and Acceptance Contract

Status: review proposal; OD-3A statistics/stress and OD-3B required routes unresolved.
OD-3C applies only to optional batch/patch; OD-4 governs external stdio status. Existing `bench/` and `test/compat/` candidate
artifacts are starting points, not a mandate for a duplicate scripts/review-110 stack.
All commands/tests described are future authorized work only.

## Provenance and reusable harness

Adapt `wt-mcp-device-110-bench` harness through d388843 in a separately authorized trial
root; extend `bench/run.mjs`, `bench/lib/core.mjs`, `bench/scenarios/all.mjs`, existing
resource/remote helpers and fixtures. Reuse compat-contract-v1.0.9.json; runner/comparator
is genuinely missing and justified as `test/compat/run.mjs` / `test/compat/compare.mjs`.
New files require reason current helpers cannot host the behavior safely.

Manifest: schemaVersion, immutable runId/time/platform/architecture/OS/CPU/RAM/Node/npm,
baseline target SHA/build hash, candidate target SHA+tracked diff hash+untracked path/content
hashes, harness SHA/diff, lock/fixture/workload hashes, route, mapped inputs, policy revision,
approvals, warmup/measured counts, seed/order, collector attribution, decision class.
Ignored .plan raw/report evidence has separate hashes and exact revision association;
lane/CDPA status is not code or final acceptance identity. Sources are read-only siblings,
not runner/output directories. No credentials/user content in evidence.

JSONL sample: identity/role/workload/iteration/warmup/order, latency/startupMs,
requestBytes/serializedResponseBytes/internalSerializationBytes, root/owned child process
counts, stdout/stderr byte counts, CPU user/system, attributable root/child RSS,
metricAvailability, correctnessDigest, error/exit/state and timestamp.
Constraints: failed samples remain; unavailable metrics are null with scope/reason;
collector RSS is not child RSS; invalid rows excluded from latency distributions but
failure rate is retained and can block correctness. Normalization defaults to exact comparison;
only explicitly declared observation JSON pointers may vary. Never erase schema properties or
business fields by generic names such as pid/time; preserve output/newline/cursor/error/
restriction/completeness drift.

Discovery runs require AUTH-D safety authorization before any materialization/restore/run:
explicit maximum wall time/evidence bytes/files/processes/cleanup duration, host/device/root/
route scope and archive retention. Authority is supplied by the operator; numeric operational
bounds may be chosen by the explicitly delegated orchestrator with rationale and independent
review of significant expansion. Product capacity/statistical approval is a separate decision.
Prospective budget revisions never certify historical unmeasured compliance.
AUTH-D is an operational runaway-prevention envelope, NOT product capacity/statistical
acceptance or OD-3A approval. Calibration occurs within AUTH-D; exhaustion records
DISCOVERY_BUDGET_EXHAUSTED and cannot silently discard failures or extend scope.
Harness MVP gate proves bounded operation/provenance/self-compare/planted drift/raw-failure/
metric-attribution behavior only. Later OD-3A/OD-3B approve calibrated acceptance profile
and routes. Acceptance runs obey the authorization assigned by the canonical owner matrix:
architecture uses AUTH-A; core/domain/combined uses AUTH-R; actual real-device calls also
require AUTH-N. Each uses its approved bounded storage reservations;
EVIDENCE_EXHAUSTED blocks evidence completeness. Discovery budget approval is not cyclic
with the profile it measures. Historical archive retention is part of AUTH-D.

## Verified materialization before candidate edits

Future authorized tasks create disposable absolute roots, never edit siblings or apply
patches to integrate during this document cycle. Export baseline commit to base trial.
File trial exports exact 6a5f43f tree and verifies ancestry/scope includes 2968280; it is not
reconstructed manually. Process trial starts baseline, applies captured tracked binary
patch in that trial only, restores captured untracked files with exact paths/bytes/modes,
then verifies hash manifest before edits. Bench trial exports d388843 harness; dirty
historical results are archived evidence, not source overlays. Compat trial overlays
hashed existing contract/fixtures onto baseline. Archive/captured bundle identity, tree
and every edited file hash recorded; conflict/path/hash mismatch stops materialization.
No cherry-pick into working repo and no copy of unknown current sibling changes.

Oracle can load separate ORIGINAL source/build plus identified oracle overlay without
product composition. Exact immutable originals, derived dependencies, build lifecycle,
composition order and stale-gate rules are normative in
[execution lineage](round3-execution-contract.md). All runtime evidence requires current
sourceTreeHash+distTreeHash+dependencyRestoreID+oracleOverlayHash+harnessHash; no stale dist.
Accepted ARCH/CORE parents are immutable; changed architecture surface requires rerun.
COMBINED_TRIAL is the only all-domain verification root, no implicit accounting trial.

## Numeric policy classification

| Value | Class | Status |
| --- | --- | --- |
| Existing bench standard 3 warmups/20 iterations, stress 1/5 | Baseline harness observed configuration | Descriptive; not ratified acceptance procedure |
| Earlier file 2 warmups/7 samples | Historical descriptive workload | Not independent accepted speed evidence |
| Prior proposed 5 warmups/30, >=20 p95 samples | Proposed starting values requiring calibration | No hard statistical sufficiency claim |
| Prior proposed >=10% median gain / <=5% p95 regression | Owner decision required after baseline variance | Not a fix/architecture acceptance prerequisite |
| 10000 operations/60 minutes/10 cleanup cycles | Acceptance tier workload proposal | OD-3A chooses final tiers; not product capacity promise |
| max(16 MiB,10% idle RSS) envelope | Proposed noise starting value | Replaced or approved only after attributable matched-baseline calibration |
| Gateway access policy input/output 48 KiB | Known hard policy cap | JSON byte size from device-access-policy.mjs; per-rule values clamped; DEVICE_OUTPUT_TOO_LARGE |
| Underlying network payload ceilings | Externally constrained limits after discovery | Separate from policy cap; record versions/full envelope |
| Per-tool Gateway response budget | Proposed calibrated value <= policy cap with overhead | May be lower than 48 KiB; 256 KiB is not a valid Gateway cap |

## Frozen statistical procedure proposal

Before candidate outcome, run independent baseline calibration with matched native host,
Node/lock/fixtures/route. Separate cold-start from warm-call and instrumented resource
samples. Counterbalance AB/BA within paired blocks, independent process/config roots,
retain schedule/seed/order. Increase warmup until predeclared stability criterion is met;
choose measured block count/required p95 resolution from baseline variation and desired
confidence, with maximum calibration effort stated before running. Failure to stabilize
is INCONCLUSIVE, not a post-hoc favorable subset.

Proposed estimator for owner review: median and nearest-rank p95 from successful measured
samples; report counts/failures/spread. Compute paired-block median deltas and 95% confidence
interval by deterministic seeded block bootstrap (10000 resamples as a calibration proposal).
For temporal RSS use fixed one-minute checkpoints as proposed schedule, 10 cleanup cycles
as proposed tier, per-cycle warmed/post-settle root+child RSS and logical-resource counts.
Bootstrap whole workload/cleanup cycles, not autocorrelated individual points; evaluate
per-cycle net-growth slope against matched baseline interval and report raw series.
Freeze block size, sample count, percentile CI method, confidence level, warmup criterion,
GC/settle policy, max effort and tolerance in approved run profile before comparison.
No claim the proposals above are calibrated/approved. OD-3A and calibration tasks block
machine-gate activation. Logical leaked resources remain correctness failures even inside
an RSS noise envelope. Missing attributable metrics stay NOT_MEASURED.

## Three independent decision classes

| Class | Decision/status | Required evidence | Does it require a speed win? |
| --- | --- | --- | --- |
| correctness/security | ACCEPT / REJECT / BLOCKED | Reproducer red/green, no unexplained drift, approved intentional fix, security/resource/platform checks and independent review | No |
| architecture simplification | ACCEPT / REJECT / BLOCKED | Equivalent mapped contracts, lifecycle/context isolation, zero self-server child on both platforms, attributable cost measurements and rollback | No; any cost claim independently measured |
| performance optimization | KEEP / REVERT / INCONCLUSIVE | Equivalent work, frozen calibrated primary/protected metrics, raw paired measurements plus compatibility/security/resource review | Only approved performance criteria, not arbitrary inherited 10% rule |

Separate acceptanceStatus from performanceDecision: a proven correctness fix may be
accepted with performance INCONCLUSIVE provided approved protected-cost guardrails pass.
A mixed increment carries each relevant decision; performance KEEP cannot override a
security rejection. Missing required protected-cost evidence blocks even a fix, but
lack of improvement alone does not. Architecture removal needs evidence of no behavioral/
isolation/lifecycle regression, not assumed savings. Owner approves scopes/exceptions.

## Gateway versus stdio differential and architecture evidence

Capture current self path and startup descendants. Against same canonical fixture compare
Gateway public input -> approved mapping -> dispatcher with equivalent stdio tool input.
Compare each route separately against baseline including deliberate mapping differences:
read_text_file head/tail, edit dry_run, errors thrown vs isError, PID/session_id, remote
roots/environment/config, media/shell/project inspection, unsupported search/multi-read,
telemetry/UI/history/onboarding and concurrent local/remote contexts. Map errors, do not
normalize them away. Schemas come from one canonical registry plus transport mapping.

No-child proof records command line, parent/descendant tree, start/settle/reconnect/shutdown/
update-handoff snapshots on Windows/Linux. Expected self-server child count is zero after
migration; legitimate user processes remain allowed. Measure owned process count, aggregate
RSS/CPU, startup time, call latency and internal serialization bytes/hops before/after.
Direct calls must not secretly fall back to internal MCP. Verify OD-4-required stdio initialize/list/call/resource/UI lifecycle and migration
compatibility; any retirement requires explicit OD-4 choice and evidence. Root self-update childPid removal requires
null-safe compatibility evidence, not deleting a file to make static grep green.

## Compatibility, stress and historical investigation

Categories: process/file/search/paths/security/media/transport/truncation/spill/concurrency/
Unicode/newline/errors plus dispatcher/readiness/config/telemetry/lifecycle. New features
use new contract expectations; fixing baseline bugs requires approved drift records.
Reuse existing neutral fixtures and remote helpers, adapting route coverage explicitly.

Stress tiers must include native platforms, seeded mix, retries/lost responses, tiny chunks,
long dual streams, inherited pipes, stdin EOF/kill, abandoned max-age leases, disk-full,
queue saturation, escaped large match/context, canonical/external edit races and reconnect.
Minimum acceptance operation count/duration/checkpoints/cleanup cycles come from approved
profile; earlier 10000/60-minute tier is an input proposal, not acceptance already achieved.
Record owned resource counts before emergency cleanup and after settling; harness cleanup
is separately measured. Missing native/authorized route or metric evidence is blocked.

Historical manifest retains Windows 60/443 standard and 15/108 stress invalid measured,
total 75/551=13.61% harness-invalid, not general product failure probability. Linux zero
raw-invalid has attribution gaps; file 2/7 measurements are descriptive and unequal work.
Each family gets revision/harness/seed/raw/reproducer/expected/observed/disposition
(product/harness/environment/approved drift) and independent sign-off. No root cause is
inferred from percentage. Missing original data requires reviewer-approved substitute
reproduction, not short green rerun.

## Increment and prerequisite gate record

Fields: incrementId, author, independentReviewer, candidate/hash identity, decisionClass,
prerequisiteGateIDs, requirements, approvedPolicy/drift, raw reports, three decisions,
Windows/Linux required coverage, adversarial findings, blockers, rollbackTrigger,
acceptanceStatus, signoff. States: proposed -> captured -> reconciled -> evidence_pending
-> review_pending -> accepted/rejected/blocked; changed source invalidates dependents.

Freeze accepted no-self-child runtime topology before introducing shared accounting.
Gate primitive reservations with synthetic consumers, then each production route/domain
adoption. Final all-covered-route enforcement gate follows all adopted consumers and
source hashes; synthetic core green does not prove absence of bypass. Dispatcher/context
has its own earlier equivalence prerequisite, not an early aggregate-enforcement claim.
Prototype may use unaccepted components only in clearly isolated exploratory trial;
prototype results never imply production adoption. Then gate stdio extraction, Gateway
migration, process and file/search/edit increments separately. Rollback to pinned accepted
revision on unexplained drift/security/resource/lifecycle failures; no hidden fallback.
Final combined compatibility/adversarial/native stress and historical disposition precede
eligibility. HUMAN REVIEW STOP precedes any release action.
