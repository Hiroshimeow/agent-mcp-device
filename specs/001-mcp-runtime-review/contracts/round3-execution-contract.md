# Execution Lineage Contract — revised Round 4

Filename retained to preserve existing links; content is current Round-4 normative proposal.
No materialization/build/test occurs in this document round. Immutable snapshots and accepted
parents are never edited. Every writable trial is a new derived copy with distinct identity.

## Identity tuple

Every run binds: sourceTreeHash (product/build inputs), repositoryTreeHash (all captured
files), packageLockHash, dependencyRestoreID, buildID/distTreeHash, oracleOverlayHash,
parentIncrementIDs/compositionHash, harnessHash, policy/authorization IDs, evidenceID.
Timestamps are metadata, never build identity. Canonical hash manifest uses sorted relative
paths, raw contents, file types/modes/symlink targets; omit generated dist/node_modules/logs
from source hash, record them separately. Hash allowlist/exclusions are versioned.

States: BaselineSource -> CandidateOriginal -> OracleOverlay -> DependencyComposedCandidate
-> HardenedCandidate -> DomainAcceptedIncrement -> CombinedTrial -> ReleaseEligibilityCandidate.
ArchitectureAccepted and AccountingCoreAccepted are immutable parent increments.
A source edit yields new source ID; a test-only edit changes overlay identity, not product
source ID. Neither inherits acceptance automatically. Build failure never creates executable gate evidence.

## Original roots and safe materialization

BASE_ORIGINAL: Git archive baseline ee87d0f3057e01e8087db99615d14bd1b4c626d4.
FILE_ORIGINAL: exact 6a5f43fdfdee1774c3c18458b5cebe58f11b2751 archive with
29682809b8ac7c8a8ac76bfb58375651389bb815 ancestry verified.
PROCESS_ORIGINAL: baseline archive + captured tracked binary patch + exact captured
untracked bytes/path/mode bundle, hashes verified. BENCH_ORIGINAL: harness source d388843ba5c374e6d06a61d7ebbdb06fff0ff68a;
dirty historical results excluded from source and archived as evidence. COMPAT_ORIGINAL:
baseline plus captured hashed compat fixture. All originals frozen/read-only after capture.
No root is integrate, a sibling or Gateway repository. Safe empty absolute roots recorded
before extraction; reject traversal/symlink escapes and unknown patch paths.

Oracle work uses BASE_ORACLE, FILE_ORACLE, PROCESS_ORACLE, COMPAT_WORK and BENCH_WORK clones;
product source hashes must equal respective original hashes. Tests written in captured
paths still count as separate oracle overlay; originals do not change. Original candidate
comparison targets ORIGINAL source/build + explicit oracle overlay, with no architecture/
core dependencies. If oracle changes build inputs, classify as source change instead,
not falsely test-only. Snapshot source must be built in writable BUILD_ROOT copy, not original.

## Explicit parent composition

ARCH_WORK derives BASE_ORIGINAL plus reviewed oracle and source edits; successful native
architecture gate freezes ARCH_ACCEPTED source/build/oracle/evidence identities.
CORE_WORK derives ARCH_ACCEPTED, adds reservation core; rebuild and rerun intersecting
architecture gates, then freeze ARCH_CORE_ACCEPTED. No later task edits either accepted root.

PROCESS_DOMAIN = ARCH_CORE_ACCEPTED + baseline-relative PROCESS_ORIGINAL production delta.
FILE_DOMAIN = ARCH_CORE_ACCEPTED + baseline-relative FILE_ORIGINAL production delta.
Composition order is accepted parent first, lane delta second using common baseline for
three-way comparison, never blind overwrite. For every overlapping path/symbol (especially
Gateway adapter) record conflict alternatives, resolution rationale/reviewer and expected
contract. Ambiguous conflict stops. Keep lane original oracle separate from merged domain
oracle; preserve parent bootstrap/context/direct dispatch. Compute composed source hash,
restore/build, rerun impacted inherited gates BEFORE domain hardening/adoption.

MEDIA_DOMAIN derives ARCH_CORE_ACCEPTED and owns parent shell/image/project/envelope work;
specialized file/media changes belong FILE_DOMAIN. Changes to shared paths coordinated by
manifest, not by mutating ARCH_ACCEPTED. Each hardened domain freezes its own accepted
source delta/base/build/overlay/approval identity after native gates.

COMBINED_TRIAL is the only cross-domain verification root: start ARCH_CORE_ACCEPTED,
compose accepted process, file, media deltas in that declared order by three-way/conflict
review. Build and rerun all affected inherited gates, then all-route enforcement proof.
No vague ACCOUNTING_TRIAL exists. Optional accepted delta creates new COMBINED revision,
not mutation of a frozen accepted combination; rehash/rebuild/invalidate affected evidence.
Final full independent verification uses exact final COMBINED source/build/oracle tuple.

## Build lifecycle — mandatory before every runtime test/benchmark/gate

In writable build copy of exact source: pinned Node/npm -> `npm ci` -> `npm run build`
-> distTreeHash -> execute. `npm ci` may invoke prepare/build; record lifecycle outputs,
then explicit final build and verify source hash unchanged or classify generated source
mutation and rebuild. Record packageLockHash, installed dependency identity, restore exit,
commands/env allowlist, build exit, buildLogHash, distTreeHash and build input hash.
No source/build reuse by timestamp. Before execution compare current source/lock/build
inputs against build record and dist hash; mismatch blocks. Any source/lock/toolchain/
configuration build-input mutation INVALIDATES old build. Pure JS oracle changes retain
product build only if inputs unchanged; new overlay/harness hash binds resulting evidence.
Do NOT launch `npm test` or `npm run test:integration` as opaque compound acceptance
commands: they rebuild then execute before a hash checkpoint. Instead split the existing
commands: locked restore (including prepare, no runtime tests) -> explicit build -> verify
source/lock/dependencies -> record buildID/dist hash -> guard -> direct Node runner
(`node test/run-all-tests.js` or `node test/integration/run-all-integration-tests.js`).
Guard rejects stale input before spawning runner. Any nested runner that rebuilds or mutates
build inputs requires the same checkpoint before its next runtime launch; inventory runner
children before execution, fail closed on an unguarded rebuild path. If needed, a harness
wrapper implements this sequence without changing product npm scripts. After execution
recheck source/lock/dist/dependency hashes; mutation invalidates evidence and requires fresh
BP and affected reruns. Installed deps/build artifacts bounded by authorization budget and
isolated roots.

## Gate invalidation and rollback

Gate binds source AND executable build AND oracle/harness AND dependency/policy IDs.
Architecture surface includes entry/bootstrap/init/context/server/dispatcher/device adapter/
channel/security/config/logging/runtime lifecycle; generate exact path/import closure in
seam inventory. Any intersecting changed source sets architecture evidence STALE, requiring
rerun before dependent acceptance. Conservative full architecture rerun when uncertain.
Same rule applies core/route/media/transport gates; changed oracle coverage needs fresh
verification, not inherited pass. Accepted parent retains original evidence but cannot
be cited as evidence for derived child without required reruns. Rollback references exact
parent source/build tuple; no hidden self-MCP fallback or discarded failure history.

## Exact seam inventory/refinement

Machine-readable `test/compat/runtime-seams.json` fields: path/symbol/read/write/import
order/classification/trusted context source/security/config/telemetry effect/test/gate.
Classes: immutable runtime init; trusted per-call; local-client state; telemetry/history;
authorization/security; compatibility-only. Minimum paths: src/bootstrap.ts,index.ts,
mcp-device.ts,npm-scripts/remote.ts,server.ts,tools/config.ts,config-manager.ts,
tools/filesystem.ts,handlers/filesystem-handlers.ts,utils/usageTracker.ts,utils/trackTools.ts,
utils/capture.ts,utils/toolHistory.ts,utils/feature-flags.ts,utils/logger.ts,
device/device.ts,device/execution-engine.ts,device/gateway-tool-adapter.ts,
tools/pdf/markdown.ts,error-handlers.ts. Product edits stop until discovered exact seams
are assigned tasks/tests/rollback. Explicit context preferred; ALS only by evidence of
async consumer need, never hidden singleton. New file requires insufficiency rationale.

## Final stop

Combined full gate -> verified documentation -> acceptance traceability -> final native
regression/build/source/evidence cleanliness -> single final eligibility/provenance report
-> HUMAN REVIEW STOP. No tasks after the final stop; earlier failures stop their task,
not pretend to issue final eligibility.
