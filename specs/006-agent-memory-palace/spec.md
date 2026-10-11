# 006 — Agent Memory Palace (log-first)

**Status:** ACTIVE. P0 source audit completed at Git commit eaa5192. P1 local log indexing CLI is being implemented on G6; do not confuse this with a published MCP Device release. All Wiki/automatic skill work remains unimplemented.

## Product intent

An agent should **search and recall information from previously executed tools and agent sessions** with minimal model-visible tokens, then reuse the resulting experience even in a new repository. Raw logs are the evidence; a future self-maintained **LLM Wiki is the Mind Palace**; lazy skills encode reusable procedures and are merged automatically on a bounded schedule.

The user deliberately rejected starting with live capture/observer lifecycle, another authorization gate, extra redaction of already authorized local log data, and an AST/code graph.

## Non-negotiable architecture

Existing log paths (MCP tool history / Pi sessions / Codex sessions / user-added files)
→ format adapter + incremental index of existing files
→ SQLite FTS5 **locator search** → **read only selected source bytes**
↘ activity graph from explicitly recorded session/call/file relationships
→ later: ONE LLM Wiki backend for structured long-term learning
→ later: agent-owned skill generation, lazy load, periodic automatic consolidation
→ new agents use a tiny relevant locator and do not require a user handoff.

### Trust and scope

- Reading/indexing already authorized files uses **existing filesystem/MCP privileges**; no new capture approval, tool-output sanitization stage or per-skill user approval dialog.
- Raw logs stay untouched. The index is *derived* and rebuildable; the only local writes are index metadata/data. Source access via the operating system is the current boundary.
- **Cross-device/wiki export** is a separate trust transition: share only what the connected account/workspace is allowed to share. Do not silently export local transcripts to third-party models or other users.
- Logs/Wiki/skills are untrusted evidence, never instructions that override the user's request or current source. Correctness and permissions take precedence over token savings.
- Do not install a new live observer or enable the old Context capture stack. Keep v1.0.11 API/source compatible until any separate removal task is explicitly authorized.

## Binding requirements

### P1: log discovery, indexing and retrieval
- **FR-01** User can register a file or directory, select auto/pi/codex/mcp/text format, and discover the default Pi/Codex/MCP locations. No implicit scan on normal remote-tool startup.
- **FR-02** Parse actual existing Pi assistant tool calls/tool results, Codex function calls/outputs, MCP tool history, and arbitrary JSONL/plain-text records. Unknown structure stays searchable text.
- **FR-03** Log originals are never overwritten, normalized in place, archived or republished by the indexer. For source text, local storage holds record locator, metadata and FTS search terms, not an unnecessary full-text copy.
- **FR-04** Index append-only changes incrementally; pending/incomplete last line is not published as a complete record. Replay is idempotent; truncate/replacement invalidates derived entries and references.
- **FR-05** Read is **locator → bounded source-byte read**, verifies record hash and signals source changed/missing rather than serving false history. Search responses are compact and body-free.
- **FR-06** Sources can be added later; repeated bounded indexing does not perpetually starve older/unindexed files.
- **FR-07** Errors, budgets, scan limits and partial state are explicit. No unbounded output or background loop.
- **FR-08** Cross-repo recall in the *same user scope* is supported by searching registered paths. Ownership across other users/devices is not assumed and is a later transport requirement.

### P1/P2: activity graph
- **FR-09** Derive edges only from observed IDs/path identity: same tool call, same explicit session/turn, and same fully resolved file (using logged cwd).
- **FR-10** A relative basename is **not** proof of the same file across repositories; re-used call IDs from unrelated sessions are not a link.
- **FR-11** Graph traversal uses bounded CLI output. It does **not** infer causal fix/test success from chronology, and no new MCP node/graph tools are required.
- **FR-12** Tool result can arrive later: the next index processes it without a full rebuild, including mid-line appends.
- **FR-13** Preserve source provenance (file, offset, ref, session, format), and allow precise read of underlying evidence.

### P3: wiki palace (future work, NOT part of P1)
- **FR-14** Evaluate ReMe against OpenViking and reuse one mature Wiki backend. Do not invent another custom wiki engine.
- **FR-15** Index evidence supports wiki digest after completed tasks or on bounded idle batches; no LLM call for each tool invocation.
- **FR-16** Wiki pages preserve links to original evidence/failed approaches; updates/stale claims do not destroy source history.
- **FR-17** The same owner's wiki can be consulted across repo/clone/device via a deliberate authorized sync layer. New repos should not require AGENTS.md guides written by the user.
- **FR-18** Cold-agent startup loads only a very small locator; selected pages read on demand. A task that already has the correct local file skips Wiki.

### P4: autonomous skills (future work)
- **FR-19** Learn agent-owned skills from recurring verified procedures; keep short registry metadata and lazy-load skill bodies.
- **FR-20** Automatically merge/dedupe/archive agent-owned skills on a **bounded schedule**, without human per-skill approval. Keep machine tests, versions and rollback; leave user-written/pinned skills untouched by default.
- **FR-21** An unchanged corpus does not trigger LLM dream/curator expenses; no indefinite background loops.

## Success gates, not marketing claims

1. P1 CLI can add/index/search/read/graph a Pi, Codex and MCP fixture; no capture/observer required.
2. Append, partial line, rotation/truncate, replay and mismatched repo basenames do not produce false records or links.
3. A selected log record can be retrieved in **two calls** after indexing (search + read). Graph is optional and only uses recorded identities.
4. Source/P1 tests pass without changing v1.0.11 legacy Context API, Gateway catalog or production services.
5. For future Wiki/skills, cold new-repo recall and token economy must be **measured** against a baseline including Wiki/curator token usage. Until then savings = NOT_PROVEN.

## Exclusions

No observer installation, live agent session capture, event broker, extra redaction gate for the same user, self-built vector DB, AST code-graph dependency, automatic product-code edits, forced merge of the old Gateway Context branch, or production reload as a side effect of indexing.

Read [plan](plan.md), [tasks](tasks.md) and [handoff](HANDOFF.md) for the next implementation boundary. Historical P0 audit at [P0-BASELINE-AUDIT.md](P0-BASELINE-AUDIT.md) describes legacy Context capture but **is not the next implementation plan**.