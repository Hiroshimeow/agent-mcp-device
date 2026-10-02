# MCP Device v1.0.9 benchmark baseline

Generated: 2026-10-02T01:24:50.462Z

This report is generated from raw JSONL. Timings are descriptive baseline evidence, not absolute pass/fail thresholds.
Cross-host Windows/Linux timing differences are not interpreted as implementation improvements because hardware and Node versions differ.

## Result sets

- **g6-win32**: baseline `ee87d0f3057e01e8087db99615d14bd1b4c626d4`, harness `df35db2c5c97017eaded61ef6739d919bd937dd9`, package `1.0.9`, win32/x64, Node v22.22.2, npm 11.17.0, samples 557, invalid measured 50.

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

## DEV execution evidence

Canonical Windows commands actually run:

```text
node bench/run.mjs --profile standard --out bench/results/v1.0.9/g6-win32 --host g6-win32
node bench/run.mjs --profile stress --out bench/results/v1.0.9/g6-win32 --host g6-win32
```

- Standard profile: 3 warmups + 20 measured iterations per scenario; 440 raw records including 3 separate resource-instrumented samples; 383 measured records; 40 measured invalid, all from process child-leak assertions.
- Stress profile: 1 warmup + 5 measured iterations per scenario; 117 raw records including 3 separate resource-instrumented samples; 98 measured records; 10 measured invalid, all from process child-leak assertions.
- Mixed stdout/stderr completeness passed on all final measured samples using marker set/count assertions; ordering across stdout/stderr is intentionally not assumed.
- Benchmark-owned cleanup left 0 fixture child processes after the final standard and stress runs.
- Existing terminal flood guard passed: 576 MB emitted, 49.0 MB retained under the 50 MB cap, maximum event-loop stall 21 ms.
- Existing edit performance guard passed: parallel workflow total 7049 ms; 150 markdown same-file edits 6152 ms; 150 Python same-file edits 6242 ms; fuzzy event-loop scan 10937 ms with 6 ms max ping latency.
- `npm test` was run and was **not green**: 60/63 passed. Failures were `test-green-hardening.js` (Windows temp cleanup EBUSY), `test-linux-device-service.js` (Windows-path escaping assertion in the Linux service fixture), and `test-self-update.js` (assertion at test-self-update.js:313, actual 1 vs expected 0). These failures are retained as unresolved baseline guard evidence; the benchmark lane did not modify production sources to hide or repair them.

## Reproduction

See `bench/README.md`. Each result directory contains `raw.jsonl` and `summary.json`; profile-specific raw files are retained alongside the consolidated raw file.
