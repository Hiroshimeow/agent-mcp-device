# MCP Device v1.0.9 benchmark baseline

Generated: 2026-10-02T01:38:00.717Z

This report is generated from raw JSONL. Timings are descriptive baseline evidence, not absolute pass/fail thresholds.
Cross-host Windows/Linux timing differences are not interpreted as implementation improvements because hardware and Node versions differ.

## Result sets

- **g6-win32**: baseline `ee87d0f3057e01e8087db99615d14bd1b4c626d4`, harness `df35db2c5c97017eaded61ef6739d919bd937dd9`, package `1.0.9`, win32/x64, Node v22.22.2, npm 11.17.0, samples 557, invalid measured 50.
- **g8-linux**: baseline `ee87d0f3057e01e8087db99615d14bd1b4c626d4`, harness `5c4710aa06871ee8f4e79a0b21d12349d9bd0eb9`, package `1.0.9`, linux/x64, Node v24.18.0, npm 11.16.0, samples 557, invalid measured 0.

## g6-win32

| Scenario | Samples valid/total | Elapsed ms | Response bytes | CPU user us | RSS peak bytes |
|---|---:|---|---|---|---|
| edit.expected_count_mismatch | 25/25 | median 14.46, p95 31.24, max 31.59 | median 594, p95 595, max 595 | NOT_MEASURED | NOT_MEASURED |
| edit.multiple_exact | 25/25 | median 14.35, p95 25.89, max 31.47 | median 989, p95 989, max 989 | NOT_MEASURED | NOT_MEASURED |
| edit.multiple_exact.resource | 2/2 | median 105.30, p95 132.04, max 132.04 | median 989, p95 989, max 989 | median 0, p95 0, max 0 | median 173074432, p95 183828480, max 183828480 |
| edit.small_exact | 25/25 | median 14.51, p95 22.88, max 23.90 | median 991, p95 991, max 991 | NOT_MEASURED | NOT_MEASURED |
| files.read_large_response | 25/25 | median 36.82, p95 64.16, max 65.19 | median 1060335, p95 1060335, max 1060335 | NOT_MEASURED | NOT_MEASURED |
| files.read_large_window_tail | 25/25 | median 9.61, p95 38.58, max 46.00 | median 18052, p95 18052, max 18052 | NOT_MEASURED | NOT_MEASURED |
| files.read_large_window_tail.resource | 2/2 | median 51.27, p95 77.31, max 77.31 | median 18052, p95 18052, max 18052 | median 0, p95 0, max 0 | median 172926976, p95 183750656, max 183750656 |
| files.read_medium_window | 25/25 | median 10.23, p95 38.76, max 79.05 | median 9212, p95 9212, max 9212 | NOT_MEASURED | NOT_MEASURED |
| files.read_multiple | 25/25 | median 7.17, p95 56.62, max 56.90 | median 17937, p95 143215, max 143215 | NOT_MEASURED | NOT_MEASURED |
| files.read_small | 25/25 | median 7.28, p95 32.49, max 66.10 | median 4245, p95 4245, max 4245 | NOT_MEASURED | NOT_MEASURED |
| process.absolute_and_tail | 25/25 | median 292.64, p95 529.15, max 733.52 | median 744, p95 744, max 744 | NOT_MEASURED | NOT_MEASURED |
| process.background_and_no_output | 0/25 | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| process.completed_repeat_offset0 | 25/25 | median 324.77, p95 738.46, max 877.82 | median 454, p95 454, max 454 | NOT_MEASURED | NOT_MEASURED |
| process.concurrent_sessions | 0/25 | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| process.incremental_offset0 | 25/25 | median 1368.33, p95 1730.43, max 1803.43 | median 726, p95 726, max 726 | NOT_MEASURED | NOT_MEASURED |
| process.large_stdout_stderr | 25/25 | median 393.21, p95 827.01, max 1395.65 | median 770389, p95 5574811, max 5574811 | NOT_MEASURED | NOT_MEASURED |
| process.large_stdout_stderr.resource | 2/2 | median 505.05, p95 708.59, max 708.59 | median 3172600, p95 5574811, max 5574811 | median 187500, p95 359000, max 359000 | median 179527680, p95 183750656, max 183750656 |
| process.short_completed | 25/25 | median 317.84, p95 707.35, max 777.49 | median 133, p95 133, max 133 | NOT_MEASURED | NOT_MEASURED |
| search.content_dense | 25/25 | median 69.41, p95 88.62, max 129.83 | median 72911, p95 80767, max 114701 | NOT_MEASURED | NOT_MEASURED |
| search.content_sparse | 25/25 | median 82.10, p95 100.93, max 134.74 | median 13549, p95 15453, max 18317 | NOT_MEASURED | NOT_MEASURED |
| search.filename_hit | 25/25 | median 73.22, p95 91.48, max 94.65 | median 2927, p95 4533, max 4679 | NOT_MEASURED | NOT_MEASURED |
| search.filename_miss | 25/25 | median 56.39, p95 187.76, max 228.07 | median 5538, p95 8251, max 8396 | NOT_MEASURED | NOT_MEASURED |

### Correctness / invalid evidence

- `process.background_and_no_output`: background OS child leak count: expected 0, actual 1
- `process.concurrent_sessions`: concurrent OS child leak count: expected 0, actual 8
- `process.concurrent_sessions`: concurrent OS child leak count: expected 0, actual 32

### Observed baseline behavior

- Completed-session repeated `offset=0` retained-output observation: median 1, p95 1, max 1.
- Windows process termination left benchmark-owned child processes after the MCP session disappeared in at least one measured sample. The harness recorded the sample invalid, then killed only children whose command line contained the isolated benchmark fixture root.

## g8-linux

| Scenario | Samples valid/total | Elapsed ms | Response bytes | CPU user us | RSS peak bytes |
|---|---:|---|---|---|---|
| edit.expected_count_mismatch | 25/25 | median 6.89, p95 8.26, max 95.71 | median 558, p95 559, max 559 | NOT_MEASURED | NOT_MEASURED |
| edit.multiple_exact | 25/25 | median 4.04, p95 7.56, max 9.65 | median 989, p95 989, max 989 | NOT_MEASURED | NOT_MEASURED |
| edit.multiple_exact.resource | 2/2 | median 12.44, p95 13.00, max 13.00 | median 989, p95 989, max 989 | median 7732, p95 15463, max 15463 | median 377217024, p95 389267456, max 389267456 |
| edit.small_exact | 25/25 | median 4.17, p95 7.26, max 7.38 | median 991, p95 991, max 991 | NOT_MEASURED | NOT_MEASURED |
| files.read_large_response | 25/25 | median 13.56, p95 19.99, max 21.13 | median 1060335, p95 1060335, max 1060335 | NOT_MEASURED | NOT_MEASURED |
| files.read_large_window_tail | 25/25 | median 1.57, p95 2.31, max 2.80 | median 18052, p95 18052, max 18052 | NOT_MEASURED | NOT_MEASURED |
| files.read_large_window_tail.resource | 2/2 | median 2.71, p95 2.90, max 2.90 | median 18052, p95 18052, max 18052 | median 1239, p95 2478, max 2478 | median 377217024, p95 389267456, max 389267456 |
| files.read_medium_window | 25/25 | median 2.49, p95 4.77, max 6.48 | median 9212, p95 9212, max 9212 | NOT_MEASURED | NOT_MEASURED |
| files.read_multiple | 25/25 | median 1.46, p95 8.84, max 10.32 | median 17641, p95 140847, max 140847 | NOT_MEASURED | NOT_MEASURED |
| files.read_small | 25/25 | median 0.99, p95 1.44, max 2.40 | median 4245, p95 4245, max 4245 | NOT_MEASURED | NOT_MEASURED |
| process.absolute_and_tail | 25/25 | median 28.16, p95 30.67, max 35.52 | median 741, p95 741, max 741 | NOT_MEASURED | NOT_MEASURED |
| process.background_and_no_output | 25/25 | median 354.26, p95 363.17, max 368.16 | median 507, p95 507, max 507 | NOT_MEASURED | NOT_MEASURED |
| process.completed_repeat_offset0 | 25/25 | median 27.85, p95 30.56, max 31.89 | median 451, p95 451, max 451 | NOT_MEASURED | NOT_MEASURED |
| process.concurrent_sessions | 25/25 | median 338.97, p95 483.82, max 504.50 | median 3053, p95 12605, max 15830 | NOT_MEASURED | NOT_MEASURED |
| process.incremental_offset0 | 25/25 | median 1146.07, p95 1149.13, max 1149.24 | median 725, p95 725, max 725 | NOT_MEASURED | NOT_MEASURED |
| process.large_stdout_stderr | 25/25 | median 52.26, p95 205.51, max 207.49 | median 770388, p95 5520038, max 5524889 | NOT_MEASURED | NOT_MEASURED |
| process.large_stdout_stderr.resource | 2/2 | median 126.23, p95 199.31, max 199.31 | median 3145213, p95 5520038, max 5520038 | median 29622, p95 59243, max 59243 | median 374398976, p95 389267456, max 389267456 |
| process.short_completed | 25/25 | median 26.07, p95 29.72, max 29.84 | median 130, p95 130, max 130 | NOT_MEASURED | NOT_MEASURED |
| search.content_dense | 25/25 | median 41.81, p95 47.37, max 47.42 | median 85458, p95 87096, max 87239 | NOT_MEASURED | NOT_MEASURED |
| search.content_sparse | 25/25 | median 40.88, p95 42.36, max 42.93 | median 13708, p95 15307, max 15895 | NOT_MEASURED | NOT_MEASURED |
| search.filename_hit | 25/25 | median 6.88, p95 8.47, max 9.84 | median 2447, p95 4053, max 4199 | NOT_MEASURED | NOT_MEASURED |
| search.filename_miss | 25/25 | median 48.47, p95 50.00, max 50.58 | median 5358, p95 6942, max 7086 | NOT_MEASURED | NOT_MEASURED |

### Correctness / invalid evidence

- No measured sample was invalid.

### Observed baseline behavior

- Completed-session repeated `offset=0` retained-output observation: median 1, p95 1, max 1.

## Baseline semantics and falsification notes

- Completed-session repeated `offset=0` reads are benchmarked as the observed v1.0.9 behavior; repeated retained output is not treated as a harness failure.
- Active `offset=0` reads are measured separately from absolute/tail reads because no-new-output reads can wait for their timeout.
- Large-output scenarios check correctness and bounded retention; faster-but-missing output is invalid evidence.
- File, search, and edit scenarios assert content/marker identity every sample. Invalid samples remain in raw data and are excluded only from latency distributions.
- The harness makes no assumption that a future 1.0.10 implementation is faster. A same-host candidate may legitimately tie or lose to this baseline.

## Not measured / limitations

- Actual @md end-to-end client latency is NOT_MEASURED unless a trusted connector duration field is added to remote evidence.
- Remote CPU/RSS is NOT_MEASURED unless a non-invasive service snapshot is available.
- Search and read_multiple_files are not exposed by the current remote @md surface; Linux source runs must exercise them through the real stdio MCP server.
- Cross-host g6 versus g8 absolute timing is descriptive only.

## Reproduction

See `bench/README.md`. Each result directory contains `raw.jsonl` and `summary.json`; profile-specific raw files are retained alongside the consolidated raw file.

## Actual @md remote evidence — g8 v1.0.9

TEST ran one isolated supported-surface matrix against device `hp450-79844b90` after fixture setup and bracketed it with device usage snapshots. Expected and observed tool-call delta were both 8; success delta was 8, failure delta 0, request bytes +2440, response bytes +14467. Small/large bounded reads, exact edit, dry-run occurrence count, incremental process reads, no-new-output, termination, and post-termination process absence all satisfied their assertions.

Actual @md end-to-end latency remains **NOT_MEASURED** because the connector exposes no trustworthy per-call elapsed field. Remote CPU/RSS remains **NOT_MEASURED**. Remote `search` and `read_multiple_files` are **NOT_MEASURED** because they are not exposed by the current remote surface. Raw evidence: `bench/results/v1.0.9/g8-md-remote/raw.jsonl`.

## TEST verification commands and outcomes

Linux source checkout: `/tmp/mcp-device-110-bench-test-714a38a4` at harness revision `5c4710aa06871ee8f4e79a0b21d12349d9bd0eb9`; baseline under test `ee87d0f3057e01e8087db99615d14bd1b4c626d4`; Node v24.18.0; npm 11.16.0; installed remote package `@hcu-lab.me/mcp-device@1.0.9`.

Canonical Linux commands executed:

```text
npm ci
npm run build
node bench/run.mjs --profile standard --out bench/results/v1.0.9/g8-linux --host g8-linux
node bench/run.mjs --profile stress --out bench/results/v1.0.9/g8-linux --host g8-linux
node bench/run.mjs --out bench/results/v1.0.9/g8-linux --summarize-only
```

Linux result counts: standard 440 raw records with 383 measured and 0 invalid measured; stress 117 raw records with 98 measured and 0 invalid measured; consolidated 557 raw records / 481 measured / 0 invalid measured.

Fresh Linux guard commands also executed and passed: `node bench/test/core.test.mjs`, `node test/test-process-pagination.js`, `node test/test-read-completed-process.js`, `node test/test-file-handlers.js`, `node test/test-search-code.js`, `node test/integration/terminal-output-buffer-leak.js`, `node test/integration/edit-block-performance.js`, and `npm test`. Linux `npm test` result: 63/63 passed. The terminal buffer guard emitted 576 MB and retained 49.0 MB under the 50 MB cap; maximum observed event-loop stall was 3 ms.

Windows evidence remains the committed g6 baseline: standard/stress combined 557 raw / 481 measured / 50 invalid measured, all invalid measured records attributed to the reproduced process-lifetime leak cases documented above. The prior Windows `npm test` result remained 60/63 with three pre-existing/out-of-scope failures; this TEST turn did not reinterpret those failures as PASS.
