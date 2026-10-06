# Context benchmark extension

Build first, then run:

```text
npm run build
node --test bench/test/context.test.mjs
node bench/scenarios/context.mjs evidence/context/new-context-raw.jsonl
```

The extension reuses the accepted 1.0.10 harness core at `.archive-worktrees-docs/wt-mcp-device-110-bench/bench/lib/core.mjs` unchanged: environment identity, assertions, measured samples, raw JSONL and summaries. Source attribution: this repository's MIT-licensed benchmark implementation; no external dependency is added.

Three measured repetitions, no hidden warmup. Each fresh fixture runs real canonical observer capture, incremental sync/no-op sync, correctness/cross-scope checked search, nonzero-degree bounded activity, and an actual SQLite write lock with exactly-once execution/gap checks. Assertions and actual work counts are in raw rows; failed rows remain visible and are excluded only from valid timing summaries. Output overwrite is refused.

Authorization uses isolated throwaway test keys and temporary state; installed approvals/real user state are not changed. Activity is populated with imported-style 48-hex refs because current observer UUID payload refs are not accepted by the graph contract; this separation is explicit, not a claim of end-to-end live graph acceptance. Search work reports query/result/corpus counts, not uninstrumented internal SQL rows examined. Contention uses an independent SQLite connection, not a production fleet stress simulation. Setup for activity includes population and sync in the recorded elapsed time; compare only like-for-like scenarios.

Measurements identify host, OS, CPU, memory, Node, npm, package version, HEAD and dirty state. Phase 9 also records SHA-256 source identities, since acceptance runs precede the final evidence commit. No release benchmark thresholds or remote latency are inferred from these small fixtures.
