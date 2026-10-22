# Current status — MCP Device 1.0.12

Updated 2026-10-22. This is the v12 source candidate on `feat/v12-platform-20261022` in the isolated G6 checkout `E:\git-project\agent-mcp-device-v12`. The original Device and Gateway checkouts remain separate. No npm publication, production deployment, global Device replacement or G8 runtime change is claimed.

## Current increment

- Existing `start` remains Device-only; `device` is an alias. `server` composes the retained account/OAuth control plane with the same Device Core in process.
- Normal account, OAuth and Device pairing apply to localhost. Operator pages share the server listener and administrator policy.
- The generic versioned plugin host supports lifecycle, dependency services, composition and failure isolation. Palace is bundled/enabled by distribution policy; Core does not depend on it.
- Platform knowledge search/list return compact references without import. Selected read can lazily import into a compatible requester provider; a Device without Palace uses bounded session cache. Ownership, scope, origin, version, evidence and correction rules remain enforced.
- Palace discovers bounded known local sources offline, constructs knowledge and inactive procedure candidates, and requires trusted execution plus postconditions for learned Skill activation. It does not rewrite AGENTS.md.
- Stopped-state backup, verification, migration and restore preserve sensitive state and plugin evidence. Apply writes only a new target after verified backups.

## Evidence and limits

[Spec 008 acceptance](../specs/008-v12-platform/ACCEPTANCE.md) owns the final test/package receipts and remaining gaps. [Device inventory](../specs/008-v12-platform/device-parity.json) and [Gateway inventory](../specs/008-v12-platform/gateway-parity.json) separate baseline evidence, candidate results and NOT_RUN/PARTIAL items. The [v12 guide](v12-platform.md) documents commands and operating constraints.

The old Windows direct-entry test guards could exit without executing assertions. V12 parity executes the actual exported suites and records assertion-bearing baseline/candidate receipts. Historic aggregate counts must not be reused as new acceptance. Known baseline fixture gaps are recorded explicitly rather than hidden by candidate-only changes.

Retrieval remains lexical. The independent paraphrase holdout, task-replay measurements, response-byte costs and unmeasured workload limits are reported separately from the tuned regression corpus. No general token-saving or production workload claim follows from the synthetic fixtures.

Only G6 isolated port 8104 is used for server acceptance; the existing 8103 audit listener is preserved. G8 8102 is production and 8101 is backup, outside this work.

## Earlier status

The [2026-10-13 P1 snapshot](status-p1-20261013.md) is retained as historical context, including claims superseded by the executable v12 parity audit. Existing P1 `logs` and gated Context behavior remain compatibility surfaces; their historical capture approvals are not changed by enabling the separate Palace plugin.
