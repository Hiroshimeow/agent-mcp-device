# MCP Device neutral benchmark harness

This directory benchmarks the existing MCP Device behavior through the real stdio MCP server. It is deliberately independent of proposed 1.0.10 feature designs: a future candidate is allowed to tie or lose to this baseline.

## Safety and validity rules

- The server runs with an isolated `MCP_DEVICE_CONFIG_DIR`.
- Fixtures are deterministic and created under a temporary directory.
- No benchmark changes production code or global MCP Device installation.
- Every sample records correctness assertions. Invalid samples remain in raw JSONL and are excluded from timing distributions.
- Warmups are recorded with `warmup:true` and excluded from measured distributions.
- Primary latency samples do not use process resource sampling. A separate `.resource` scenario records CPU/RSS evidence.
- Local response bytes are UTF-8 bytes of the full MCP tool-result JSON serialization.
- Windows/Linux absolute times are descriptive only. Candidate-vs-baseline comparisons must use the same host, Node version, profile, fixture seed, and sample counts.
- No npm publish/release/tag/version-bump command belongs in this workflow.

## Prerequisites

```text
npm ci
npm run build
```

On Windows PowerShell hosts where script execution blocks `npm.ps1`, use `npm.cmd` instead.

## Profiles

Standard:
- 3 warmups per scenario
- 20 measured samples per scenario
- median and p95 in the generated summary

Stress:
- 1 warmup per scenario
- 5 measured samples per scenario
- heavier process concurrency/output and file fan-out
- p95 is emitted but should be treated as informational at n=5

For harness development only, `--warmups N`, `--iterations N`, and `--scenario <substring>` can reduce scope. Those overrides are not canonical baseline evidence.

## Canonical Windows source run

```text
node bench/run.mjs --profile standard --out bench/results/v1.0.9/g6-win32 --host g6-win32
node bench/run.mjs --profile stress --out bench/results/v1.0.9/g6-win32 --host g6-win32
node bench/run.mjs --out bench/results/v1.0.9/g6-win32 --summarize-only
```

## Canonical Linux source run

Run from an isolated checkout of the committed benchmark branch; do not replace or restart the globally running package.

```text
npm ci
npm run build
node bench/run.mjs --profile standard --out bench/results/v1.0.9/g8-linux --host g8-linux
node bench/run.mjs --profile stress --out bench/results/v1.0.9/g8-linux --host g8-linux
node bench/run.mjs --out bench/results/v1.0.9/g8-linux --summarize-only
```

## Existing correctness / regression guards

```text
npm run build
node bench/test/core.test.mjs
node test/test-process-pagination.js
node test/test-read-completed-process.js
node test/test-file-handlers.js
node test/test-search-code.js
node test/integration/terminal-output-buffer-leak.js
node test/integration/edit-block-performance.js
npm test
```

The 600 MB terminal buffer regression is intentionally a one-shot guard rather than repeated inside every benchmark sample.

## Actual @md remote evidence protocol

The current remote surface does not expose `search` or `read_multiple_files`. Those must be benchmarked by the stdio source run above.

For supported remote tools, record the target-device usage snapshot before and after a known call matrix:
- bounded small and large `read_text_file`
- exact and dry-run `edit_file`
- `start_process` + repeated `read_process_output` + `terminate_process`
- one no-new-output read

For each matrix, store:
- expected and observed tool-call delta
- failure-count delta
- request-byte delta
- response-byte delta
- validity/contamination reason

A remote byte sample is valid only when observed tool-call delta equals the expected matrix call count. The connector currently provides no trustworthy client-side elapsed-time field, so actual @md end-to-end latency remains `NOT_MEASURED` rather than inferred.

## Result files

Each host directory contains:
- `raw.standard.jsonl` and/or `raw.stress.jsonl`
- consolidated `raw.jsonl`
- generated `summary.json`

The version directory contains generated `BASELINE.md`.

Minimum raw fields include schema/suite version, baseline/harness commits, dirty state, host/OS/Node/npm/CPU/memory metadata, profile/fixture/scenario/parameters, warmup/sample index, timestamp, elapsed time, response bytes, resource measurements where available, assertions, validity, and errors.

## Regenerating summaries without rerunning

```text
node bench/run.mjs --out bench/results/v1.0.9/g6-win32 --summarize-only
```

The command consolidates existing profile JSONL files, rewrites `summary.json`, and regenerates the version-level `BASELINE.md`.

## Interpreting baseline quirks

- Active `offset=0` process reads and completed-session repeated reads are separate scenarios. The harness records v1.0.9 behavior instead of imposing proposed 1.0.10 semantics.
- No-new-output reads are separate because timeout waiting is part of their cost.
- Search reports start-call, first-result, and completion timing separately where available.
- Correctness/leak failures invalidate samples regardless of latency.
- A future same-host candidate that is slower, equal, or no better is valid evidence; the harness must not be tuned to prefer a proposed implementation.
