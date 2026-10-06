# Phase 9 Windows/Linux platform matrix

Target: 1.0.11 unreleased. No publication, tagging or production deployment.

## Environments and provenance

- Windows: DESKTOP-B5E4IUE, win32/x64, Node v22.22.2, npm 11.17.0, Intel Core Ultra 7 155H. Native Windows filesystem/temporary state.
- Linux: Ubuntu-22.04 under WSL2 on the same machine, linux/x64, Node v22.21.0. Snapshot copied to `/home/ayumi/mcp-context-phase9`, independent Linux node_modules installed with `npm ci --ignore-scripts`, Linux filesystem/temporary state. This is not a separate physical Linux fleet device or power-loss test.
- Raw benchmark rows include OS release, hostname, CPU/memory, npm, version, HEAD/dirty state and timestamp. Linux HEAD identifies its snapshot repository, not the Windows worktree commit. Compare `phase9-source-identity.json` and `phase9-linux-source-identity.json` for exact tested source hashes; line-ending differences are explicit, not hidden.

## Measured matrix

| Category | Windows | Linux | Raw evidence |
| --- | --- | --- | --- |
| Build | PASS, exit 0, zero TypeScript errors | PASS, exit 0, zero TypeScript errors | phase9-windows-build.log; phase9-linux-build.log; regression logs also include final rebuild |
| Full context suite: process crash, lock/concurrency/fencing, redaction/privacy, retrieval, adapter parity | 186/186, 0 failed/skipped | 186/186, 0 failed/skipped | phase9-windows-context-verified.tap; phase9-linux-context-verified.tap |
| Full regression runner | 66/66 modules, 0 failed | 66/66 modules, 0 failed | phase9-windows-regression-verified.log; phase9-linux-regression-final.log |
| Benchmark contract test | 1/1 | 1/1 | phase9-windows-benchmark-final.tap; phase9-linux-benchmark-final.tap |
| Capture/sync/search/activity/contention performance | 15/15 valid measured rows | 15/15 valid measured rows | phase9-{windows,linux}-benchmark-final.jsonl and .summary.json |
| Physical-host power loss, production live-account rollout | NOT_MEASURED | NOT_MEASURED | Outside these local fixture executions; not inferred from passing tests |

All commands use project scripts: `npm run build`, `node --test test/context/*.test.js`, `node test/run-all-tests.js`, `node --test bench/test/context.test.mjs`, `node bench/scenarios/context.mjs <new-file.jsonl>`.

## Performance (elapsed milliseconds: median / p95 / max)

Three measured repetitions per workload; no warmups. p95 equals max for n=3 and is descriptive, not a statistical SLA.

| Workload | Windows | Linux | Actual work |
| --- | --- | --- | --- |
| capture | 3142.51 / 4365.31 / 4365.31 | 3271.39 / 3304.28 / 3304.28 | 40 real observer executions, 40 durable outcomes |
| sync | 86.83 / 90.76 / 90.76 | 41.62 / 45.77 / 45.77 | 40 indexed events; second explicit sync indexes zero |
| search | 222.09 / 229.54 / 229.54 | 150.40 / 157.07 / 157.07 | 2 queries, 40 expected hits, cross-scope canary excluded; fixture scope setup included |
| activity | 2614.86 / 2701.33 / 2701.33 | 1239.80 / 1430.08 / 1430.08 | 43 examined edges, 42 visited nodes, 41 returned edges; fixture append/sync included |
| contention | 109.86 / 129.78 / 129.78 | 30.60 / 37.63 / 37.63 | 1 held SQLite writer lock, 1 execution, 1 visible gap, no replay |

CPU user/system deltas and before/after RSS are measured in-process. Peak RSS is explicitly a process-lifetime high-water mark, not a per-scenario isolated peak. No internal SQL row-scan count is fabricated. Activity uses imported-style refs, not unsupported observer UUID graph input. See docs/context.md.

## Preserved failures and limitations

- `phase9-benchmark-red.log`: expected missing implementation (red-first test).
- `phase9-benchmark-green.log`: initial failure exposed captured UUID/graph 48-hex incompatibility. Final benchmark separates the workloads explicitly; the underlying integration gap is not claimed fixed.
- `phase9-windows-context.tap`: 185/186; newly added skill storage wording violated its portable-contract guard. Corrected by keeping runtime internals in docs/context.md. Final 186/186 retained separately.
- `phase9-windows-regression.log`: timeout-interrupted first run, not treated as pass.
- `phase9-windows-regression-final.log`: 64/66; stale 1.0.10 fallback assertion and prohibited README wording. Updated fallback/test for the authorized 1.0.11 target and reworded documentation. Final clean 66/66 retained separately.
- `phase9-linux-regression.log`: an earlier copy captured incomplete Chrome-download progress; it is not used as final passing evidence. `phase9-linux-regression-final.log` retains the complete 66/66 summary and explicit exit code 0.
- Earlier benchmark JSONL artifacts remain intact, without resource instrumentation; final runs add actual CPU/RSS counters. No raw file was overwritten to conceal a failed sample.

Linux dependency installation and tar copy generated no product dependency changes. Tests may report existing SQLite experimental/punycode warnings. Live external account refresh/hosted gateway deployment remains NOT_MEASURED per catalog-rollout.md/us5.md. Passing fixture suites do not remove that rollout gate.
