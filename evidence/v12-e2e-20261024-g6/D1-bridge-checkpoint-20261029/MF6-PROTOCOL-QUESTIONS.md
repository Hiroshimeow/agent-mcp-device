# MF6 — actual reviewer request versus unresolved preregistration

Status: OPEN / NOT REGISTERED / NO EXPERIMENT AUTHORIZED. This bridge does not measure performance or change the gate. Authoritative original difference-of-arm-p95 result remains **30.1605 ms, FAIL at 20 ms**.

## Attributable primary source

Historical completed Opus 5.5 turn: 183b8083-m365-worker-20261028-012828-16970c16, conversation a39299d6-2bc1-486f-9d62-2f972057cae3. Exact recovered response 13,883 bytes SHA256 e901a780bb44e8f345c81a78edaee3fe37af712bb38178d9b971defceb2eafd8. It reviewed OLD attachment f05d541839ecc8570b697b6ee42117e432af216fb694d54c7cceb5f0a689e656, NOT this source. Full exact text is preserved in recovered/response.md.

The actual response §1 says the reviewer's own difference-of-arm-p95 acceptance estimator is defective due to host-wide disturbances, but explicitly says that this does not make either run pass, that the failing result remains authoritative, and that the threshold stays 20ms. A3 explicitly requests:

- At least 400 alternating pairs, primary statistic p95 of per-pair deltas, <=20ms.
- A validity gate decided BEFORE running. It gives skip-arm p95/p50 >1.5 as an **example**, not a finalized unconditional rule.
- Invalid runs retained; at most two reruns; three consecutive invalid runs count as FAIL.
- Both no-runtime and active-runtime arms.
- Rebuilt candidate, Defender check in place.
- Confirmation of protocol BEFORE execution.

These are genuine reviewer requests, not invented from a summary. They are not yet an agreed preregistration or authority for this bridge to execute anything.

## Questions requiring explicit consolidated reviewer response

1. Estimand change: explicitly acknowledge prospective replacement of p95(normal)-p95(skip) with p95(normal_i-skip_i); retain old failed gate/history and do not retroactively relabel it. Does each runtime scenario independently need a valid <=20ms result? Never pool scenarios to hide a failure.
2. Fixed sampling: choose exact pair count (proposed 400 PER runtime scenario), normal/skip alternating AB/BA order, pairing boundaries, warmup count/exclusion fixed in advance, quantile definition (proposed nearest rank ceil(.95*n), index379 for n400), timer boundary and precision. Clarify negative deltas, missing/error samples, timeouts, warm-vs-cold semantics, no trimming, raw ordered sample retention. These implementation details are not specified by the prior response.
3. Validity: choose exact predeclared disturbance rule (1.5 ratio only an example), whether it is per scenario or whole run, p50 convention/zero denominator, which failures invalidate vs FAIL, and any CPU/disk/Defender guard conditions. No post-hoc slow-pair removal. Define unit of rerun budget and reset policy; never retry valid FAIL to chase green. Clarify terminal outcome if two invalid plus one valid FAIL/PASS and whether all three attempts must remain bound to identical candidate/protocol.
4. Active-runtime: exact installed-layout topology and verified active same-namespace lease, commands without --data-root archive bypass and without environment forcing a different root; baseline identical except MCP_DEVICE_SKIP_SKILL_INSTALL=1. Confirm coverage of discovery and status observation. No live production runtime.
5. Candidate sequencing conflict: prior handoff requires D1 PASS BEFORE candidate rebuild, while A3/A6 require rebuilt candidate BEFORE full D1 PASS. Current user prohibits any rebuild and any measurement. Return a two-stage correctness disposition (NOT D1 PASS), and precise later authorization/gates needed; do not solve by quietly rebuilding or granting full PASS with failed MF6. Reviewer advice cannot override user authorization.
6. Freeze exact source manifest, isolated compiler/candidate artifacts and hashes, Node/OS/filesystem, host/precondition Defender exclusions UNKNOWN-vs-absent treatment, protocol bytes/hash, raw samples, all invalid/failing receipts and fixed rerun budget BEFORE any later separately authorized run. Current Defender receipt is historical, not a fresh performance precondition.

## Explicit non-acceptance

18.56ms remains superseded; 9.6ms in-process probe is diagnostic-only; accidental unregistered 6.0450ms old-protocol run remains ineligible. No sample collection occurred in this checkpoint, and no protocol is declared accepted simply because a prompt asks the reviewer to resolve it. Source-only correctness disposition cannot close MF6, A6, S5 or release acceptance.
