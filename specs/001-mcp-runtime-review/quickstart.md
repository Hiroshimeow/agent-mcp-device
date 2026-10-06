# Future Validation Guide — Round 4, Not Executed

No trial/build/test/benchmark is run in document revision. AUTH/OD/GOV are PENDING in
[canonical owner matrix](owner-decisions.md); execution permission differs from activation
and acceptance. Read [lineage/BP](contracts/round3-execution-contract.md),
[output examples](contracts/process-output-contract.md), [tasks](tasks.md).

## Future prerequisites and executable identity

After AUTH-D safety envelope approval, materialize exact immutable ORIGINAL trees in safe
isolated roots, derive oracle/build copies, pin native Windows/Linux Node/npm/dependencies.
Never use source sibling or integrate as writable trial. Existing future commands:

```text
npm ci
npm run build
```

BP records sourceTreeHash/packageLockHash/Node/npm/restore dependency identity and exit,
build command/exit/log hash/distTreeHash. npm prepare may build; record and verify final
source/input unchanged. Direct tests importing dist run only after matching BP guard.
Any source/lock/build-input change invalidates build. No timestamp identity.

Future regression commands (run only authorized isolated copies):
```text
node test/run-all-tests.js
node test/integration/run-all-integration-tests.js
```
Run these only AFTER BP build/identity checkpoint and guard. Do not substitute compound
`npm test`/`npm run test:integration`: those rebuild and immediately launch before a guard.
Inventory nested runner commands; any nested rebuild must checkpoint/hash/guard before
launch or fail closed. Recheck artifacts after execution; mutations invalidate evidence.
Harness extensions `BENCH_WORK/bench/run.mjs` and `COMPAT_WORK/test/compat/run.mjs` must
accept explicit target source/build/oracle/profile manifests and fail stale target identity;
CLI options remain proposed, do not claim today's harness already supports them.

## Validation order and expected evidence

1. ORIGINAL source + identified oracle overlay, no architecture/core dependencies:
   baseline self-compare passes, planted drift fails, failed samples retained. AUTH-D
   bounds materialization/build/time/evidence/cleanup; MVP is not OD-3A approval.
2. ARCH_WORK bootstrap-first/user override/config/context/lifecycle/Gateway no-self-child
   native gates -> freeze ARCH_ACCEPTED. OD-4 determines final transport; old stdio may
   remain only migration comparator. AUTH-A and relevant decisions required.
3. CORE_WORK derived parent -> core test/BP/architecture reruns -> ARCH_CORE_ACCEPTED.
4. PROCESS_DOMAIN/FILE_DOMAIN/MEDIA_DOMAIN exact reviewed compositions -> fresh BP ->
   inherited reruns -> oracle-first hardening -> native independent domain acceptance.
   Process examples test independent text projections, raw ledger, boundaries/fences,
   PID reuse, legacy lines, ordered EOF/root-pipe/max-age behavior.
5. COMBINED_TRIAL exact accepted deltas -> BP/rerun architecture/core/routes -> all-route
   enforcement. Optional oracle/prototype/equivalence/measurement/delivery needs separate
   OD-3C-E/D; deferred work does not claim done. Accepted optional delta makes new combined
   revision and reopens affected gates, never mutates accepted parent.
6. Independent final native compatibility/adversarial/seeded stress/history disposition,
   then verified docs and FR/SC traceability, final regression/source/build/evidence checks,
   then single eligibility/provenance report and human review stop.

All output/envelope validation accounts actual Gateway per-rule grant capped at 48 KiB
JSON, not a 256 KiB assumption or a discovered network ceiling. Missing required real-device
permission AUTH-N or native evidence is BLOCKED, not waived. Product cleanup measured before
emergency harness cleanup. No command here publishes/tags/releases/deploys/merges/pushes.
