# Experience Memory — research synthesis and source receipts

Date: 2026-10-06. Status: **research/specification only**. Documentation of features is not evidence of effectiveness. No implementation, deployment or performance claim follows from this packet.

## Question and recommendation

Can an agent switching into a repository reuse another agent's verified experience without blind replay or needless retrieval overhead? Specify small, device-local, owner/repository-scoped, evidence-linked cards, with explicit extraction, lifecycle and need-driven bounded retrieval. A retrieved procedure is a lead to verify, not an instruction or authorization. Known-file tasks proceed through native tools. Current source/tests/permissions outrank cards; no automatic global NMem integration, prompt injection or skill promotion.

## Verification vocabulary

- **firsthand-read:** this repair retrieved/read the identified bytes on 2026-10-06 UTC and computed SHA-256. Source code and test definitions were read, not executed. README statements establish documented intent only.
- **historical-review-reported:** the original result summary or supplied historical research reports checking a claim. The original full tool transcript is unavailable; do not treat those execution claims as reproducible firsthand results now.
- **historical-research-reported:** claims without a claim-specific receipt here. They are retained as leads, not newly validated design premises.
- **proposal:** normative design/evaluation, not implemented behavior.

No controlled comparison of MCP Device, CodeGraph, Graphiti, Hermes, Letta or SWE-agent is established. Absence of a feature from the quoted documentation is not proof of product-wide absence.

## Primary README receipts — firsthand-read

All seven were retrieved again by HTTP GET on **2026-10-06 UTC** during this repair; HTTP 200 and every digest reproduced the historical receipt. SHA-256 is over the exact response body bytes (before text decoding, newline conversion or rendering). Historical acquisition reported using GitHub commits Atom feeds after REST API rate limiting; this repair **did not resolve latest branches or reconstruct that feed selection**. It used the full revisions already recorded. These receipts need no lost local source file: URL, revision, method, date, digest, byte length and substantive claim excerpt are below. The full upstream file is not embedded; future HTTP availability is not guaranteed. A mismatch/unavailable URL means not reproduced, never substitute `main`.

Reproduce each receipt with Node.js 22+ (standard `fetch`, no dependencies); assign `u` exactly as listed:

```javascript
const { createHash } = require('node:crypto');
const u = 'EXACT_RAW_URL_FROM_TABLE';
const r = await fetch(u); // run in an async function or Node REPL
if (!r.ok) throw new Error(`HTTP ${r.status}`);
const b = Buffer.from(await r.arrayBuffer());
console.log(b.length, createHash('sha256').update(b).digest('hex'));
```

| Source/full immutable URL | Bytes | SHA-256 |
|---|---:|---|
| [codegraph-ai/CodeGraph README](https://raw.githubusercontent.com/codegraph-ai/CodeGraph/590c2ca7dd7b37bd1d41caf45fac535b6522f969/README.md) | 25463 | `75d802202621db082a0b35cf6a0c50e503cdcf7bd2b32281d26e39dfcab3782d` |
| [getzep/graphiti README](https://raw.githubusercontent.com/getzep/graphiti/689de295c209631405c00e19e0af4f9735142f13/README.md) | 31417 | `72c09aa0f12b7835f8c2919000788bca43306cf847269d4c3a7f35c957218689` |
| [NousResearch/hermes-agent README](https://raw.githubusercontent.com/NousResearch/hermes-agent/e032fdbca14fc528df207cd806c24da9f2d768fc/README.md) | 16924 | `c8c3009b1cf6e8d6e48e96a9b4c549d9ab0c86fdaffd91b19f3e9d9b37d93d9d` |
| [letta-ai/letta README](https://raw.githubusercontent.com/letta-ai/letta/5bcdd177d70fa2b31a754cfcd801e77b2e1ab16a/README.md) | 1574 | `1d624e8fd383c1198c8d42da87b055d591a5760e19607692eb46bbbfe2a58f03` |
| [SWE-agent/SWE-agent README](https://raw.githubusercontent.com/SWE-agent/SWE-agent/3ea751c087f32b16e039a2233dd6eefecef325d5/README.md) | 8158 | `dcd880557720efbab0f5c0e68f2bc742309efecfce83244c9e670ec1f1adf76f` |
| [Lordymine/codegraph README](https://raw.githubusercontent.com/Lordymine/codegraph/a82876289a1a5040a4f6c399b4635ac9d3efb390/README.md) | 10546 | `2653bb681084b04f215c789aafafcb5306b478084ca130b6ca2868b54bd29a0c` |
| [colbymchenry/codegraph README](https://raw.githubusercontent.com/colbymchenry/codegraph/d2fb323e5101046fe198d16ec3900854b2e9b1ce/README.md) | 70865 | `eb84996efef40925f8a1acea1978537d18a3d1560e960e76ef7b081e5c03a071` |

### Claim-specific excerpts and limits

- **codegraph-ai/CodeGraph**, Memory section: “Persistent AI context across sessions — debugging insights, architectural decisions, known issues.” Its table includes `memory_store`/`memory_get`/`memory_search`, `memory_context`, and `memory_list`/`memory_invalidate`/`memory_stats`. It says “CodeGraph's memory tools store project-scoped notes”; the debugging example contains `problem`, `solution` and `agentSource`. This overlaps proposed experience-card categories. The source-code graph itself is not experience history, but a blanket exclusion of this separate memory layer is incorrect. The receipt does not establish equivalent evidence-linked extraction, approval, isolation or outcome verification.
- **Graphiti**, introduction: “Graphiti is a framework for building and querying temporal context graphs for AI agents.” It describes evolving temporal knowledge graphs, including what is true now and before. This supports temporal context/memory positioning, not a demonstrated tool-use learning policy or comparative benefit.
- **Hermes**, feature table: “Agent-curated memory with periodic nudges. Autonomous skill creation after complex tasks. Skills self-improve during use. FTS5 session search with LLM summarization for cross-session recall.” It also names “MEMORY.md and USER.md entries.” These are upstream descriptions, not safety guarantees or evidence that weights train. Exact caps, prompt-snapshot semantics and detailed tool/skill behavior are not established by this receipt.
- **Letta**, opening: “Build stateful agents with memory that can learn and improve over time.” This is stateful-agent positioning, not independently measured improvement.
- **SWE-agent**, README notice: “Our general recommendation is to use mini-SWE-agent instead of SWE-agent going forward.” It positions a software-engineering agent; no controlled comparison to project-local experience cards is supplied.
- **Lordymine/codegraph**, opening: “A token-efficient code knowledge graph for AI agents.” Technology line names Go and SQLite; indexing description names two tables (`nodes`, `edges`) and FTS5. This supports source-structure retrieval. The surviving original review identifies this as the 004 §2.3 reference; this repair has not inspected 004 content and does not prove subsystem-wide memory absence.
- **colbymchenry/codegraph**, opening: “a pre-built knowledge graph of every symbol, call edge, and dependency in your codebase”. README describes local SQLite storage. A historical Pi integration lead is not substantiated by this README and is not represented as firsthand verified. Claimed speedups are upstream claims, not validated here; this is a different CodeGraph project.

## MCP Device pinned local-source receipts — firsthand-read

Repository: `Hiroshimeow/agent-mcp-device`; local object source: `E:/git-project/wt-mcp-device-111-clean-delivery`; full commit: **`9d96df95d0bd4d7c5b7e7cda994e232a6871b4c1`**. Retrieved on **2026-10-06 UTC** using `git show <commit>:<path>` through `execFileSync` (Buffer output). These are Git blob contents, not working-tree/CRLF-converted file hashes. Commit-pinned web locators follow `https://github.com/Hiroshimeow/agent-mcp-device/blob/9d96df95d0bd4d7c5b7e7cda994e232a6871b4c1/<path>`; **remote availability was not tested**. Reproduce locally in any clone containing that object:

```javascript
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const repo = 'E:/git-project/wt-mcp-device-111-clean-delivery';
const rev = '9d96df95d0bd4d7c5b7e7cda994e232a6871b4c1';
const path = 'PATH_FROM_TABLE';
const b = execFileSync('git', ['-C', repo, 'show', `${rev}:${path}`]);
console.log(b.length, createHash('sha256').update(b).digest('hex'));
```

| Path at full commit | Bytes | SHA-256 |
|---|---:|---|
| `package.json` | 4674 | `cc335f0e1ff17e9c59324afe1e7fe61e4cfa4b86ca218f731a450c47129ea682` |
| `src/context/graph.ts` | 11412 | `1e168b60fd9ecc805a61a24782976df7e22a696be60b3b0977a4008d44f69d7b` |
| `test/context/activity-graph.test.js` | 3342 | `2ab02bc8525165facbfaa904b4aa0c800a0ddb98f5c155e2fd0f9821a3e4e759` |
| `docs/context.md` | 7935 | `d027e1ecae653a55a4caec5da14572e6f9c9a7e1570cf93a6994d2709e08a647` |
| `evidence/context/acceptance.md` | 8652 | `517b79ea2ea9294815952215670eca1e75092e812847f00bfd6b3d91eb252245` |
| `evidence/context/phase6-graph-benchmark.json` | 3908 | `59563d9a04c82b05cba35661eabfb4bc62ceefafb6f7d06f2cc0341e505229d7` |

Claim-specific evidence (line numbers in Git blob, not a test log):

- `package.json` parses to version `1.0.11`.
- `graph.ts:19`: “Only retained redacted evidence is parsed. No temporal or exit-code causal inference.” Lines 38–39 require `data.status === 'succeeded'` and exclude both data/argument `dry_run === true` before marking edit success. Bound declarations at 77–78 support bounded traversal, not a latency guarantee.
- `activity-graph.test.js:18–38` defines a fixture with failed/dry-run edits; checks `attempted` rather than `edit_succeeded`, rejects `caused_by`/`fixes`, and compares edge count after sync/rebuild. Reading these assertions is not executing or passing the tests.
- `docs/context.md:1`: “Device-local context — 1.0.11 (unreleased)”. Line 47 says no source-code parser and that activity edges are observations/attempts, not causation/proof of fixes. Line 53 says production enablement pending SOC confirmation.
- `acceptance.md:7`: “Unconditional feature acceptance PASS at X_final / Y_final3; production release gated on external SOC confirmation.” Lines 11 and 39–40 distinguish earlier Linux dependency failures from subsequently reported fresh-install acceptance. These are assertions in an acceptance document, not a newly audited sign-off or rerun. No release authorization is inferred.
- Benchmark JSON fields: `fixture_events=100`, `median_ms=17.47160000000008`, `p95_ms=18.900699999999915`. Artifact read only; no production or cross-product comparison.

Full blob snapshots are not embedded, and local object availability may change. The hashes and excerpts preserve the exact scope of firsthand evidence without claiming a missing archive exists.

## Historical leads without firsthand claim-specific receipts

These are **not independently revalidated here** and are not prerequisites for the proposal:

- Zep paper version locator: [arXiv:2501.13956v1](https://arxiv.org/abs/2501.13956v1). Historical research/review reports describe episodes, extracted facts/provenance, hybrid semantic/BM25/graph retrieval and reranking. No captured paper bytes/hash/page excerpts are available; retrieval date/method of the historical paper check are unknown. Version pin alone is not a byte receipt or comparative-effectiveness evidence.
- Hermes mutable [memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory), [skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills), [tools](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools) and [architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture) pages: historical reports of caps/snapshot/on-demand details only. No page revisions/hashes or known acquisition methods/dates. Do not imply these were covered by the README hash.
- Mutable [Letta docs](https://docs.letta.com/) and [SWE-agent docs](https://swe-agent.com/latest/): historical comparison leads, no page-specific receipts.
- Original reviewer-reported MCP Device test execution and broader acceptance/primary-source audits: summarized in `review.md`; no full historical tool transcript, raw command results or authenticated responder-model telemetry was recovered. Source assertions and test definitions now have separate firsthand receipts above.

## Architectural implications

1. Keep retained evidence distinct from derived generalization. Explicit curation links candidates to authorized evidence, outcomes, scope and limits; observations do not establish causation/general usefulness.
2. Partition by trusted owner/repository identity. Do not merge activity, source graphs, project experience and global NMem merely because they all help retrieval.
3. Require current verification: applicable revision, preconditions, permissions, tool availability and fresh outcomes. A successful historical command is not authorization to replay it.
4. Retrieve only for a named uncertainty, with explicit bounded request/citations. No automatic prompt mutation, fan-out or query-time rebuild/provider work.
5. Skills remain versioned drafts with human approval, no automatic publication/loading/promotion. Approval alone does not prove future benefit.
6. Prefer investigating portable local lexical retrieval before requiring services, embeddings or providers. Backend suitability is unverified here.

## Storage decision to investigate

| Option | Advantages | Costs/risks and gate |
|---|---|---|
| Reuse device-local SQLite/FTS5 | Low operations footprint, transactions, lexical queries, backup/migration fit | Inspect schema, trusted scope, locking, retention/deletion and lifecycle compatibility before selecting. FTS matches are not semantic correctness. |
| Separate SQLite database | Local, dependency-light; clearer lifecycle/rollback boundary | Additional permissions, files, backup, quotas, locking/migration and duplicated-store cost. Same isolation policy. |
| Existing NMem | Potential durable memory/recall capability | Audit ownership, repo partitioning, sync/egress, encryption, authorization, injection, provenance and deletion. No automatic bridge/write-through. |
| External graph/vector/service | Potential richer semantic/temporal retrieval | Additional dependencies, credentials, egress, cost and attack surface. Not initial default; requires measured unmet need and separate approval. |

This repair did not inspect the current context-store schema or NMem guarantees. No backend is selected. Fewer duplicate calls/tokens, faster correct resolution and validated cross-agent reuse remain hypotheses to test with the frozen acquisition-inclusive A/B protocol in `spec.md`. Correctness, privacy and security are non-regression gates, never tradeoffs for cheaper retrieval.
