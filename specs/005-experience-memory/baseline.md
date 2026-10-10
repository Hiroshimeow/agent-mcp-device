# Experience Memory — baseline and authority boundary

Date: 2026-10-06. Status: **research/specification only**. No implementation, release, enablement or deployment is authorized.

## Repository/version boundary

The writing checkout is `E:/git-project/wt-mcp-device-110-integrate`, branch `release/v1.0.10-clean`, HEAD `1492747a53902ebdce7ad5b8eccd522fa8afdcc9`, package 1.0.10. These are firsthand observations during the auditability repair. The five packet files are untracked: HEAD identifies checkout context, not their content provenance. Unrelated tracked modifications predate this repair.

The separately observed delivery checkout is `E:/git-project/wt-mcp-device-111-clean-delivery`, branch `delivery/mcp-device-1.0.11-clean`, HEAD `9d96df95d0bd4d7c5b7e7cda994e232a6871b4c1`, package 1.0.11, with empty `git status --porcelain`. This repair read **Git object bytes at that full commit**, rather than relying on branch links. Reproduction commands, paths, exact-byte hashes and claim-specific excerpts are in `research.md`. Availability of these local objects is not proof the commit is published remotely.

At that commit, graph source and test definitions describe evidence-backed observations, explicit success, failed/dry-run attempts and rebuild invariants. Context docs describe 1.0.11 as unreleased, no source-code parsing or causal inference, and production enablement pending SOC confirmation. The acceptance document reports historical feature acceptance separately from that production gate. These are firsthand **source/document reads**, not new test results, a security audit or validation of the acceptance document's historical sign-offs. The read benchmark artifact has 100 fixture events, median 17.47160000000008 ms and p95 18.900699999999915 ms; no benchmark was rerun and no production/comparative latency is established.

The surviving original review summary also reports these checks. Its reported execution/acceptance checks remain historical reviewer-reported evidence, not upgraded to firsthand test runs by this repair. The full original tool transcript and authenticated responder-model telemetry remain unavailable. The proposal goes beyond both baselines and changes neither release status.

## Distinct systems and authorities

- **MCP Device activity/evidence graph:** retained tool-event observations and provenance. It does not infer causation, parse current source structure or prove an edit fixed a test.
- **Source-code graph:** symbols, calls, imports, inheritance and files. `Lordymine/codegraph` is the 004 reference according to the surviving review summary; this repair did not inspect or edit 004 content. Its pinned README documents Go/SQLite structural retrieval. This does not establish the absence of every possible memory feature.
- **Other CodeGraph variants:** `codegraph-ai/CodeGraph` documents a separate persistent, project-scoped memory layer overlapping debugging/decision/issue cards. `colbymchenry/codegraph` documents a source graph and local SQLite storage; the pinned README does not substantiate the historical Pi integration claim. These are distinct projects; do not conflate them or exclude all CodeGraph experience memory.
- **Graphiti:** its pinned README documents temporal context graphs. Detailed Zep paper retrieval/benchmark statements remain historical research reports without a captured paper receipt.
- **Hermes Agent:** its pinned README documents agent-curated memory, cross-session search and skill creation. Detailed memory caps/snapshot behavior from mutable docs remain historical reports, not firsthand checks here. Product “self-improving” positioning is not proof of model-weight training or guaranteed improvement.
- **Proposed experience memory:** curated owner/repository-scoped, device-local cards. Cards are hypotheses/checklists/navigation aids; current source, tests, permissions and fresh evidence remain authoritative. Global NMem is a separate authority, not an automatic integration target.

## Evidence confidence

`firsthand-read` means bytes inspected and hashed during this repair; it never means tests were executed. `historical-review-reported` means a surviving result summary or supplied historical account reports a check; missing tool traces limit reconstruction. `proposal` means normative requirements, not existing behavior. Primary-source receipts document intended features, not deployment guarantees, effectiveness, security or a head-to-head comparison.

The flow is **actions → retained evidence → explicit extraction → versioned cards → need-driven retrieval → current verification → feedback**. Do not automatically generalize captured actions, inject memory into prompts, share across owners/repositories/clones, merge authority stores or promote skills. Known-file tasks bypass memory. Storage and evaluation remain design gates in `spec.md`.
