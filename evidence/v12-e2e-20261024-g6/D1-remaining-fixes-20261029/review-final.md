**No concrete correctness or safety blockers found in the bounded N5–N9 delta.**

Reviewed only the specified source ranges, Skill guidance, remaining-regression tests, crashed-snapshot addition, and isolated Device A5 shell flow. Confirmed HEAD is `18407ec562c4f2cc11ca3e8c1f69f362ee3f86c0`; the checkout contains substantial inherited WIP, which was not treated as this delta.

**Nonblocking limitations**
- `src/plugins/palace/store.ts:13–31`: Cleanup deliberately preserves snapshots with uncertain ownership, different namespaces, live/reused PIDs, or unexpected contents. Some abandoned copies may therefore require manual cleanup; active peers are conservatively preserved.
- `src/plugins/palace/skill-manager.ts:545–590`: The quick probe remains ledger-only and observational. Canonical path agreement does not imply fresh verification of installed Skill bytes; the returned verification label accurately reflects this.
- `test/v12/d1-remaining-regressions.test.mjs:41–51`: Service-account coverage simulates Windows platform/account values; it does not establish behavior under native Windows service-token/profile conditions.
- `test/v12/palace-wal-recovery.test.mjs:48–62`: The crashed-snapshot regression forces the recovery fallback through a loader shim. It exercises real snapshot creation, cleanup, and active-peer preservation, but is not native ACL/mount-failure acceptance.
- `test/v12/device-cold-local.test.mjs:1–2`, `test/v12/device-cold-local.test.mjs:59`: A5 exercises the isolated real Device shell adapter with an inert Gateway transport—not live Gateway or rollout acceptance.

No files modified and no tests/builds executed. The reported **58/58**, **3/3**, and enabled repeat **1/1** remain parent-provided execution evidence, not independently rerun results.