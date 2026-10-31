# Terminal handoff — N4/N10 lifecycle milestone

## Authority and status

User-authorized sole source/test writer continuation, session `del_mvsr4jq6_b3cg`. Bounded source milestone complete; **D1 remains AMEND / RELEASE_BLOCKED_WITH_EVIDENCE**. Authoritative MF6 is **30.1605 ms >20 ms FAIL**, original difference-of-arm-p95 gate unchanged. No benchmark/performance execution, candidate rebuild/package, root dist mutation, M365 submission, live 8101–8104/G8 contact, production reload, identity mutation, reset/clean/stash/commit/push/tag/publish occurred in this milestone. Prior invalid/unplanned measurements remain in prior evidence; none is promoted to acceptance.

Verified checkout: `E:/git-project/agent-mcp-device-v12`, HEAD `18407ec562c4f2cc11ca3e8c1f69f362ee3f86c0`, branch `feat/v12-platform-20261022`, Windows Node22.22.2. Read AGENTS.md, docs/STATUS.md, original external handoff, previous D1-review-fixes HANDOFF/dispositions and complete extracted reviewer response. Those historical handoff instructions do not override current no-submission/no-package restrictions.

Read-only actual process CWD inspection: runtime2088 `C:/Users/admin/.mcp-device/runtime/`; parent46016, this writer38972 and read-only planner51328 in this checkout. Session JSONL confirmed this writer's exclusive N4/N10 assignment and planner's read-only assignment. Another interactive parent/operator45012 also had repo CWD; no second assigned source writer identified. No processes were stopped or restarted. `.tmp/d1-lifecycle-20261028/` preserves git-before/after, ignored inventories, pre-write binary WIP diff, pre-write copies of both touched source files and process CWD observations. Do not submit private process data without inspection.

## Changes and rationale

- `src/platform/plugin-host.ts`: retains per-plugin unpersisted fault snapshots across direct load and unrelated newer registry revisions; refresh retries the reconciled fault instead of resurrecting a child. Explicit enable/disable carry a fresh optional persisted lifecycleToken, allowing identical-state enable to supersede a startup fault without mistaking unrelated revisions for recovery. Uninstall flows through disable. Changed records/generations supersede the pending snapshot; same activation intent normalizes only installed/enabled transient state. Fault-save failures set retry state. Save success clears pending snapshots.
- Registry save now fsyncs the parent directory on POSIX after atomic rename. In-memory revision advances immediately after rename, even if directory sync fails, so retries do not conflict with their own published revision. Handle closes in finally; failures remain observable. Windows directory handles are not opened. No claim of actual Linux filesystem durability acceptance: the new fault-injection regression exercises the POSIX branch by overriding platform and intercepting only directory open on Windows.
- `src/platform/plugin-driver.ts`: cancelled requests retain their stderr sequence; a late PLUGIN_* response enters the existing 40ms-quiet /1000ms-maximum stderr fault path. Ordinary CANCELLED remains nonfatal and a subsequent real ping succeeds. Original request deadline/grace calculation unchanged. Existing stderr tail remains4096 characters (not a new UTF8-byte cap).
- New `test/v12/d1-lifecycle-persistence.test.mjs` covers failed fault save/direct load/unrelated revision/restart with child PID gone, combined activation+fault persistence failures, explicit newer enable/disable/uninstall, and post-rename directory-sync failure revision/handle behavior.
- New `test/v12/d1-cancelled-fault.test.mjs` uses a real executable JSON-lines child to return delayed fault/CANCELLED after cancellation; asserts late bounded diagnostic tail and continued usability for ordinary cancellation.

Exact changed file bytes/hashes: `changed-files.json`. Only these four files were changed by this writer. Source files already contained inherited dirty WIP; HEAD diff is not this writer's delta. Pre-write copies are private in the isolated working directory. `inherited-source-comparison.json` checks262 non-owned prior manifest files: **zero drift**.

## Test-first evidence

All outputs isolated under `$d='.tmp/d1-lifecycle-20261028'`; TS output `$d/dist`, mirrored package/skills/explicit test files. Root dist not modified. Complete exact shell invocations (including setup) in `verification-commands.json`; logs retained in `logs/`.

Compile command for every compile: `node node_modules/typescript/bin/tsc -p tsconfig.json --outDir "$d/dist" --listEmittedFiles false`.

1. Initial compile exit0 (`tsc-red.log`). `node --test "$d/test/v12/d1-lifecycle-persistence.test.mjs" "$d/test/v12/d1-cancelled-fault.test.mjs"`: exit1, **4 pass/3 fail** (`red.log`). Real failures: direct load discarded fault (`enabled` vs `faulted`), cancelled PLUGIN_* discarded (0 vs1 fault), missing directory-sync rejection. Explicit-intent and ordinary-CANCELLED controls already passed.
2. First implementation compile exit0; same tests exit1,6 pass/1 fail (`green-first.log`): direct reload fixed, but fault not yet persisted after external revision. Added reconciled-fault retry in refresh, then compile exit0/test exit0,7 pass (`green.log`). Preserve intermediate failure, not hidden.
3. Read-only review `review-initial.md` found activation-save failure + fault-save failure lost fault because disk installed differed from transient enabled. Added regression before correction. `node --test "$d/test/v12/d1-lifecycle-persistence.test.mjs"`: exit1,5 pass/1 fail (`red-review.log`), actual installed vs faulted. Corrected same-activation-intent reconciliation, retaining lifecycle token comparison.
4. Final compile exit0 (`tsc-final.log`). Final explicit allowlist:

```powershell
node --test "$d/test/v12/d1-lifecycle-persistence.test.mjs" "$d/test/v12/d1-cancelled-fault.test.mjs" "$d/test/v12/d1-closure-regressions.test.mjs" "$d/test/v12/plugin-cancellation-isolation.test.mjs" "$d/test/v12/plugin-host.test.js" "$d/test/v12/plugin-services.test.js" "$d/test/v12/plugin-bundles.test.js"
```

Exit0, **42 pass/0 fail/0 skip**, `functional-final.log`. Includes8 new tests, lifecycle/host/dependency/upgrade/bundled regressions and queued-cancel isolation. No aggregate full-suite claim.

5. Positive exact-name allowlist only:

```powershell
node --test --test-name-pattern='^(cooperative cancellation does not fault the isolated plugin process|unresponsive synchronous child is killed only at its original request deadline after cancellation)$' "$d/test/v12/d0-architecture-regressions.test.mjs"
```

Exit0, **2 pass/0 fail/0 skip**, `deadline-final.log`. Proves original cancellation deadline and ordinary cancellation behavior. No assembly/package test selected. Expected existing SQLite ExperimentalWarning retained, not suppressed. `git diff --check`: exit0, `diff-check.log` (inherited line-ending warnings).

Follow-up static review `review-final.md` found no concrete remaining issue in this delta and confirmed prior finding addressed. This is not independent M365 D1 or acceptance.

## Exact snapshot

`stable-source-manifest.json` binds266 files: previous264 path set plus both new tests, rehashed from actual working tree. SHA256 **5b9ed04d0e5efc9ac5865c7a1f9fcbe097ea663eadd4fef2cef35b3308e556b5**. This is a source file-set binding, not all untracked evidence, not HEAD-only source or a release candidate. `evidence-manifest.json` separately binds this evidence packet (excluding itself). Verify hashes before reuse.

## Remaining blockers and continuation

N4/N10 have local source fixes and Windows behavioral evidence, not cross-platform or independent acceptance. POSIX directory fsync is branch/failure-injection tested only; Linux/WSL ext4 and /mnt/c execution remains required. Pending in-memory fault state cannot guarantee persistence across host process death while storage remains unavailable; no such durability promise is invented. Lifecycle token intent is honored for updated CLI writers; older external writers not emitting a token can only be distinguished by actual record changes, not identical rewrites. Coordinate supported writer versions before deployment.

Previous `D1-review-fixes-20261028/REVIEW-DISPOSITION.md` remains authoritative for other findings: N1/N2/N3 fixed locally, N5 probe cleanup ownership, N6 remediation/provenance, N7 wording/Skill hash, N8 canonicalization, N9 service-profile startup remain open, as do plugins-list recovery semantics, legacy-lock remediation, unsafe-parent/warnings. A1 active-runtime acceptance arm, A3 protocol/estimand/candidate sequencing, A4 packet contents, A5 real isolated Device shell/no-flags disable, A6 full/current cross-platform/packed/cold/consumer/root-container gates remain unresolved. Do not select paired-delta p95 as a replacement for original arm-p95 difference or rebuild candidate without authorization. No new performance protocol or run registered here.

D2/D3 pending; S5 historical FAIL+27.75% / savings NOT_PROVEN. S7 historical81395-check PASS is not this source. No gate bypass. Next source milestone should address a bounded remaining P2 group test-first after identity/ownership/hash verification; any performance, review submission, packaging or production action requires its own applicable authority.
