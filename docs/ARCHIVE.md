# RETIRED / DONE — reference only

This is a small restoration index, **not an active task list**. Cleanup: 2026-10-11. Git history retains tracked content; selected local logs/plans have a private hashed archive outside both repos.

## Superseded Spec Kit (Device)

**Last complete pre-006 tracked snapshot:** `8f3794a552627850a7e74876d376f8f6ec379ee9`.

| Retired from active HEAD | Why | How to view the original |
| --- | --- | --- |
| `specs/003-context-nextgen/` (14 files) | Source-code AST graph and deferred Wiki contradict current tool/session-first Palace direction | `git show 8f3794a:specs/003-context-nextgen/spec.md` |
| `specs/004-context-v112/` (2 files) | Old worktree baseline and source-graph roadmap are historical; accepted Device v1.0.11 facts incorporated in 006 | `git show 8f3794a:specs/004-context-v112/baseline.md` |
| `specs/005-experience-memory/` (5 files) | Historical experience proposal **forbids** cross-repo recall and autonomous skill merging; replaced by 006 | `git show 8f3794a:specs/005-experience-memory/spec.md` |
| `specs/001-mcp-runtime-review` | Already retired in earlier cleanup; v1.0.10 work is DONE | `git show baf7c5f:specs/001-mcp-runtime-review/tasks.md` |
| `docs/handoff/2026-10-10` | Completed snapshot with 177 historical tasks and 474 source entries; too noisy as active context | `git show baf7c5f:docs/handoff/2026-10-10/README.md` |

**Exception — do NOT delete:** `specs/002-device-local-context` is the DONE v1.0.11 contract fixture read by `scripts/check-context-acceptance.mjs` and tests. Its checklist is not an open backlog.

## Original evidence vs new Palace

- v1.0.11 historical acceptance summaries remain in `evidence/context` and runtime usage in `docs/context.md`. The completed handoffs `docs/delivery-1.0.11-clean.md`, `docs/integration-1.0.11-github.md` and `docs/context/checkpoint2-trust-boundary.md` are retired from HEAD; read them with `git show 8f3794a:<path>` if auditing release history.
- Old `003` P2 retrieval budgets can inform 006 but `003` P3 code graph / mandatory DEFER wiki **must not** automatically reappear.
- Old `005` A/B correctness/provenance insights were incorporated into 006; its human approval restriction has intentionally been superseded.
- Do not use Git `reset` to recover a historical doc; `git show <SHA>:<path>` reads it non-destructively.

## Private sidecar/plan archives

Prior G6 backups at `E:\git-project\_mcp-consolidation-20261010\` include 168 raw Device `.plan` handoffs (sha manifest copied to G8) and 1,534 old worktree artifacts. They are intentionally outside active Git.

**2026-10-11 evidence cleanup:** copied/verified **all 227 accepted evidence files** (4,923,239 bytes) into `E:\git-project\_mcp-consolidation-20261011\device-evidence\files\` with `manifest.json` and per-file SHA-256. Retired **166 raw `.log`, `.tap`, `.txt`, `.jsonl`, `.sha256`, `.patch`, `.diff` and completed v1.0.10 evidence files** (4,285,080 bytes) from Git HEAD; **61 Context `.md`/fixture reports** (638,159 bytes) remain, including `evidence/context/decisions.md` required by tests. Original tracked content is also recoverable from Git SHA `8f3794a`. Do not publish private raw logs or delete the external evidence archive before retention review.
This cleanup uses `E:\git-project\_mcp-consolidation-20261011\` for reviewed G6 Gateway old plan/log/config sidecars with SHA-256 receipts. Contains local data that must **not** be pushed to public GitHub.

This document does not grant permission to delete auth/identity state, protected execution artifacts or production-linked config just because a filename is under `logs/`.