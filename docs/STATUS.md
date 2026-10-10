# ACTIVE — MCP Device / Gateway

**Snapshot:** 2026-10-11 (JST). Read this document first; verify actual `git rev-parse HEAD`, branch, dirty files and runtime before acting. This is not a perpetual live-status promise.

## Source of truth

| Location | Role |
| --- | --- |
| G6 `E:\git-project\agent-mcp-device`, `main` | **Authoritative local Device source/spec editing workspace.** Product baseline v1.0.11 from GitHub; later local commits may be docs-only. |
| G8 `/home/ayumi/Workspace/git_project/agent-mcp-device` | Separate Device checkout/runtime. **Not modified** in the 2026-10-11 spec cleanup. Do not assume G8 automatically follows G6. |
| G8 `/home/ayumi/Workspace/git_project/agent-mcp-gateway-develop`, `develop` | **Canonical Gateway base** with newer dashboard UI. Not modified/reloaded in this documentation task. |
| G6 `E:\git-project\agent-mcp-gateway`, `develop` | Old Gateway checkout (`89f7123` before local cleanup), **not** the canonical Gateway integration source. |

Source Git revision, installed Device package, public tool catalog and PM2 production runtime are **different facts**.

## ONLY active feature Spec Kit

**[006 — Agent Memory Palace](../specs/006-agent-memory-palace/README.md)** — **OPEN / NOT IMPLEMENTED**.

Focus:
1. Search + graph over actual **tool/session logs**, not AST/source-code graph.
2. **LLM Wiki is the Mind Palace**: evidence-linked, shared within the authorized owner, automatically consolidated from sessions.
3. Auto recall across different repos/clones G6/G8 without user-written guides; compact locate → selective read.
4. Autonomous agent-owned skills, lazy-load, **scheduled skill merge without per-skill human approval**, with automated tests/versioning/rollback.
5. Minimize **total** token usage including background Wiki/skill generation, subject to correctness/security.

Start with `006/tasks.md` **P0** and `006/plan.md`. **51 tasks currently unchecked**; creating spec documents completes no implementation task. No tool, service, Wiki backend, schedule or public MCP route has been changed.

## Implemented baseline to PRESERVE, not redo

- Device **v1.0.11:** local Context `src/context`, capture intent/outcome, FTS5 search, bounded activity graph, CLI, six `local_*` schemas. `local_wiki` is still `WIKI_DISABLED`. Full session/turn joining and Wiki auto-learning are **not currently implemented**.
- **`specs/002-device-local-context` is DONE**, retained **only as regression fixture** because `scripts/check-context-acceptance.mjs` and context tests read it. It is not an active task plan; moving/removing it would require changing test code, which is OUT of scope.
- Keep the **61 essential Context evidence reports/fixtures** in `evidence/context` (including `decisions.md` used by tests). The **166 raw logs/TAP/old v1.0.10 evidence files** were archived with individual SHA-256 outside Git and retired from active HEAD; see [ARCHIVE.md](ARCHIVE.md). Never load old logs into an agent's initial context.
- Gateway latest `develop` UI/auth/pairing/remote sessions and existing skill catalog must remain intact. Old Gateway `feat/personal-context` is **reference only**, NOT a merge target.

## Not-active / retired

Former `specs/003-context-nextgen` (code graph priority), `004-context-v112` (stale old worktree baseline), `005-experience-memory` (prohibited cross-repo/auto skill), and old DONE plans **are retired from HEAD**. Exact originals remain recoverable from Git revision `8f3794a552627850a7e74876d376f8f6ec379ee9`. See [ARCHIVE.md](ARCHIVE.md).

## Rules for the next agent

- **Do not code** in this spec/cleanup task. Later DEV requires an explicit implementation task with exact Git base and tests.
- Do not merge Context into Gateway, deploy/reload, rewrite v1.0.11 API, change secrets, or auto-start a scheduler just by reading spec 006.
- Never optimize model tokens by leaking secrets, skipping task verification or hiding background LLM costs.
- User intentionally does **not** require approval dialogs for agent-owned skill creation/merge; automated safety checks and normal access controls still apply.
- Preserve every unknown file until classified; no `reset --hard`, `clean -fdx` or force deletion. G6 Gateway external configs and auth state are not disposable logs.

Go directly to [006 spec](../specs/006-agent-memory-palace/spec.md) and [active tasks](../specs/006-agent-memory-palace/tasks.md). Historical lookup only via [ARCHIVE](ARCHIVE.md).

## Verification snapshot (2026-10-11)

- `scripts/check-context-acceptance.mjs` **PASS** (32 requirements, 8 success criteria, 62 accepted-task inventory).
- Targeted Context `access + graph-query + mcp-contract` tests **10/10 PASS**. Active spec link/ID check: 12 documents, 23 links, 39 FR, 51 unchecked tasks PASS.
- `npm test` performed the build successfully; its long-running 66-module runner was **stopped before full completion**, so **FULL REGRESSION = NOT_MEASURED**. No product source was changed.
- Stale Gateway G6 independently has missing npm dependencies; its full suite is not green (see Gateway `docs/STATUS.md`). Do not conflate Git cleanliness with release acceptance.