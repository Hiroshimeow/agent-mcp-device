# Round 4 Data Model — Proposed, Not Executed

## SourceIdentity / TrialLineage (US1/US5)

Fields: kind, immutable ID, sourceTreeHash, repositoryTreeHash, baseline/common ancestor,
parent IDs, ordered dependency deltas, conflict resolutions/reviewer, file manifest,
new-file rationale, mutable/frozen status. Kinds: BaselineSource, CandidateOriginal,
OracleOverlay, ArchitectureAccepted, AccountingCoreAccepted, DependencyComposedCandidate,
HardenedCandidate, DomainAcceptedIncrement, CombinedTrial, ReleaseEligibilityCandidate.
Constraints: originals/accepted parents immutable; candidate-only edits require verified
materialization; source/test overlay/dependency/build/evidence identities distinct.
OracleOverlay has parent original and overlay hash; productSourceHash must remain equal.
Composition/hardening yields new source ID, never called unchanged original.

## BuildIdentity (all executable stories)

Fields: sourceTreeHash, packageLockHash, Node/npm, dependencyRestoreID/exit/hash,
build command/environment/exit/log hash, distTreeHash, inputManifestHash, oracleOverlayHash.
States missing/current/invalid/failed. Source/lock/toolchain/build-input change invalidates;
execution forbidden until current matching source/dist recorded. Timestamps not identity.
JS oracle-only change affects evidence overlay, not product build when inputs unchanged.

## Authorization / Activation / AcceptanceProfile

Canonical records in [owner-decisions.md](owner-decisions.md); no duplicate task-range lists.
Authorization fields: ID, human approval, root/host/device/routes, wall/disk/file/process/
cleanup safety maxima and validity. AUTH-D discovery differs from AUTH-A architecture,
AUTH-R domain/integration and AUTH-N real device permission. All PENDING.
Activation OD-1/OD-2, optional OD-3C-E/D and support OD-4 separate from statistical OD-3A/
route OD-3B acceptance. GOV-1 unratified is governance, never execution permission.
DiscoveryBudget does not equal product policy or calibrated AcceptanceProfile.

## CanonicalTool / RequestContext / RuntimeInstance (US6)

Tool definition contains schema/handler/result/error/resource class and adapter mappings.
One business implementation, retained adapters conditional OD-4; migration comparator is
not final supported surface. Immutable init context: early threadpool/user override,
config/remote feature/log/error/PDF/cwd policy. Request context: trusted origin/roots,
client/UI/telemetry/history/cancellation, isolated per invocation; metadata cannot elevate.
Runtime instance owns its bounded domain, not device-wide broker; no-self-child accepted
runtime readiness/generation/shutdown/update PID null proof binds architecture source/build.

## ProcessSession / OutputLedger / StreamProjection (US2)

Session immutable runtimeGeneration+nonce key; PID/handle attributes only, authorization
scope, lifecycle, retained output/leases. Gateway public owner token -> device key -> PID;
old key never resolves newly reused PID. Legacy PID/line adapter separate.
Global raw ledger: receipt sequence, global range, stream tag, stream-local range, exact bytes.
Text request selects one stream; offsets/maxBytes in selected source-byte space. Response:
text, streamRange, global sourceRanges (possibly disjoint), nextOffset stream-local,
snapshotEnd, optional readFence, coordinateSpace, oldestAvailableOffset, retentionUntil,
gap/status. Explicit fence never expands; trailing prefix gives FENCE_INCOMPLETE independent
of bytes beyond fence/EOF; zero-length fenced range is RANGE_END, not stream EOF.
Unfenced pending (including valid-prefix/blockedBy responses) omits readFence and may refresh;
lifecycle observations are not replay payload. Replay identity includes session/space/start/
fence/maxBytes/representationVersion/budgetProfileId. Profile partitions full cap into fixed
wrapper W, observation O and replay P allowances; unused W/O never increases P. Profile/grant
change is explicit REPLAY_PROFILE_UNAVAILABLE, not silent shorter replay; bound violation
is ENVELOPE_PROFILE_VIOLATION and stales profile/evidence.
No global text cursor, no destructive consumer state. UTF-8 decoders independent. Raw
arbitrary ranges exact; strict text misalignment/invalid/tiny/pending errors do not advance.
Examples and full prefix/EOF semantics in [output contract](contracts/process-output-contract.md).
Root states requested/spawned/running/exited/spawn_failed; capture open/closed/forced_incomplete/
expired; termination none/requested/graceful/forced/verified/failed; nullable code not zero.

## ResourcePolicy / Reservation / SpillLease (US2/US3)

Policy fields: per-runtime scope, covered routes, classification, byte/count/age/deadline,
calibration/owner approval, saturation/error behavior. No unset limit means unlimited;
activation blocked. Core synthetic acceptance distinct from production route adoption and
COMBINED all-route guarantee. Counts cover sessions/chunks/waiters/metadata/queues/leases,
bytes cover input/retention/expansion/media/native/envelope; totals measured honestly.
Lease opaque auth-scoped ref, owner/ranges/checksum/reserved bytes+files, max age/TTL,
created/completion/activity, release journal/status; expiry independent of final drain;
created+maxAge ceiling; release once; restart sweep owned roots only. Process retention
OD-2; file-operation lease values OD-1 (do not accidentally make optional process policy
a universal media blocker). Shared mechanics do not imply identical duration defaults.

## ResourceOperation / SearchRun (US3)

Canonical path/stable identity/authorized parent, snapshot, participating FIFO, reserved
queue/input/output, mode sequential or additive original-snapshot, result/failure state.
External conflict detection best-effort; check/commit race not atomic CAS. Empty search
rejects/empty replacement allowed; overlap preflight for original-snapshot only. Preserve
metadata/newlines, specialized handlers/fuzzy diagnostics; partial-commit outcome explicit.
Search weak directory consistency; typed match/context/found/returned/omission, ordered
path/line keys, budget/oversize/continuation states. Context cannot consume selected match
budget; MATCH_TOO_LARGE found but not fully returned; no atomic tree snapshot promise.

## EvidenceRun / Gate (US1/US4/US5)

Run binds exact lineage/build/oracle/harness/authorization/profile and raw samples/failures.
Unavailable metrics null with attribution/reason; immutable corrected runs get new IDs.
DecisionClass correctness_security/architecture_simplification/performance;
acceptance ACCEPT/REJECT/BLOCKED distinct from performance KEEP/REVERT/INCONCLUSIVE.
Gate fields: author/independent reviewer, exact accepted parents, affected path/import
surface, source/build/evidence tuple, stale flags, requirements, policy/drift, rollback.
Material source intersection with architecture surface makes architecture gate stale;
conservative rerun if unknown. Missing native/required evidence blocks. Single final
eligibility follows final documentation/traceability/regression/cleanliness; no release permission.
