# Prospective discovery envelope v2 — independent design reviewed

Supersedes numeric/topology interpretations of [v1](execution-authorization.md) for NEW runs
only. Original v1 remains preserved. Authority: operator end-to-end delegation and local
checkpoint commit selection1. Independent design review agent554f8f15-0fc5-446 ACCEPT-DESIGN
with targeted repairs; runtime gate T018 still REJECT. No product caps/statistics ratified.

## Concrete containment topology

Finite maximum: eight admitted/runnable members of one authoritative Windows Job Object
PLUS one fixed external native broker = nine owned runnable processes, excluding pre-existing
main orchestrator. Coordinators/wrappers/npm probes count inside eight, not eight workload
slots plus uncounted helpers. No concurrent discovery sessions. Broker bootstrap/compiler
helpers must be either contained or explicitly measured within a separately finite bootstrap
protocol BEFORE scope can be accepted; unknown overhead is BLOCKED, not implicitly exempt.
Broker sole persistent outer-job handle owner; no descendant may retain an outer-job handle.
Suspended create -> membership verification/assignment -> resume; no breakaway. Job close,
parent/broker death, failure/timeout cause owned-tree cleanup. Unrelated processes untouched.
Serial restore/build admission<=1, not caller-label-based proof. Native active/total accounting
and entry-marker adversarial tests distinguish admitted runnable processes from rejected
creation counters; sampled peak alone not certification.

All identity/config/npm queries inside authoritative containment. Reviewed entry/import/known
launch surface plus pinned dependency identity, not generic JavaScript/import sandbox claim.
Timer deadline enforcement is monotonic observed bounded operation, not hard-real-time scheduling.
Each workload command<=900s including admission; cleanup<=120s with measured overshoot and zero
remaining-owned requirement. Split stages preferred. A named stage coordinator may live up to
1800s only when needed for sequential restore/build+hashing, clipped to remaining cumulative
reservation; every command still<=900s, coordinator counts inside eight. No blanket exemption
for arbitrary descendants. Broker/session also has native bounded deadline and parent monitoring.

Other v1 bounds unchanged: cumulative discovery4h, root8GiB/200kfiles, evidence256MiB/10kfiles;
owned roots only; no sibling/integration product mutation or real calls without AUTH-N.
Before new run reserve worst-case bounded duration in persistent ledger; unfinished requests
charge full reserved duration. Reconcile prior records/interrupts conservatively, no inferred
historical peaks. Exhausted/unreconciled budget blocks launch. Actual start/end and resource
measurements bind supervisor/session/build/runner/evidence IDs. Historical compliance remains
UNPROVEN. Significant later expansion needs independent review, not silent cap increase.

No push/merge/publish/tag/release/deploy; local phase checkpoints only isolated repo.
No change to required final native Windows/Linux/Gateway/retained-route acceptance.
