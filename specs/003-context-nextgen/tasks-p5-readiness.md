# P5 Tasks — Final Reconciliation / Readiness

These tasks do not implement P2-P4 product features. They close prerequisites and produce a durable implementation-ready package.

- [x] T105 Reconcile actual 002 implementation state against T001-T062/equivalent accepted scope using commit/source/test/evidence truth; record exact completed, incomplete and superseded work instead of trusting unchecked task boxes or prior assumption. Verified through independent P5 REVIEW: durable implementation checkpoints reach T023 plus hardening; T024-T062/public live baseline are not proven complete.
- [ ] T106 Refresh G-110 handoff from the actual accepted runtime revision: canonical observer, pre-intent/post-outcome, exclusion, process correlation, shared resource policy, lifecycle/flush and owner semantic acceptance.
- [ ] T107 Verify/close N3 device-wide quota + owner-admin cleanup + cursor-safe GC prerequisite with required security/recovery evidence, or keep live enablement blocked.
- [ ] T108 Freeze final 002 baseline SHA/worktree, six-tool/capability/schema snapshot, Node/runtime compatibility and Windows/Linux acceptance evidence.
- [ ] T109 Freeze combined 003 capability/version compatibility matrix for progressive-retrieval-v1, code-graph-v1 and wiki-v1; preserve omitted-field 002 semantics and typed old-device behavior.
- [ ] T110 Reconcile all P2-P4 task dependencies into implementation order I1/I2/I3 plus final integrated acceptance; keep NOT_MEASURED metrics as gates, not assumed passes.
- [x] T111 Verify trusted explicit-user-request provenance availability for wiki provider egress. Current runtime has no verified generic trusted user-request provenance signal; record generate/update as disabled/unsupported and do not invent an agent-mintable approval mechanism.
- [ ] T112 Reconcile final schema/token budgets: G-SCHEMA per tool + total catalog, P2 runtime retrieval token gates, P3 code-graph resource gates and P4 provider budgets remain separate metrics.
- [ ] T113 Verify final privacy/security matrix across context/history/code/wiki: scope, redaction, external analyzer reads, source fingerprints, provider egress, diagnostics, gateway non-persistence and ref/cursor authorization.
- [ ] T114 Durably record the accepted 003 Spec-Kit package in the intended implementation branch/worktree and record baseline/package SHAs; do not leave accepted contracts only as untracked local files.
- [ ] T115 Run independent P5 final readiness review over durable artifacts and prerequisite evidence. Verdict must be READY_FOR_IMPLEMENTATION or NOT_READY_FOR_IMPLEMENTATION with concrete blockers; missing evidence cannot pass.

## Dependencies

T105 -> T106/T107/T108.
T108 -> T109/T110/T112/T113.
T111 -> T113.
T105-T113 -> T114.
T114 -> T115.

## Stop condition

- If T115 finds any Critical/High contract issue -> PLAN revises the smallest affected phase.
- If prerequisite evidence is missing/blocking -> remain NOT_READY and route the owner role for that prerequisite; do not route feature DEV.
- Only after clean T115 with all required prerequisite gates verified may the package be marked READY_FOR_IMPLEMENTATION and implementation execution begin.
