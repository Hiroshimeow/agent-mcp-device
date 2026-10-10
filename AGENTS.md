# Repository agent contract — MCP Device

**Read [docs/STATUS.md](docs/STATUS.md) before modifying source or choosing a branch.** It defines canonical Device/Gateway checkouts, release-vs-runtime distinctions, retained active work, and safety gates. [docs/ARCHIVE.md](docs/ARCHIVE.md) explains how to retrieve DONE/outdated work through Git history or private backups.

- Verify `git rev-parse --show-toplevel HEAD`, branch, dirty/untracked/ignored state and process/CWD on the actual device. Do not treat worktree path or branch name alone as authority.
- Device and Gateway are separate products. The Device source contains Context v1.0.11, but Gateway `develop` does **not** yet expose the Gateway Context patch. Never merge that patch without an explicit task.
- Do not `reset --hard`, clean files, remove worktrees forcibly, force-push, reload production, mutate identity/SQLite or publish/tag as a side effect of documentation or spec work.
- Keep `specs/002-device-local-context/` (used by regression verification), accepted evidence and executable benchmark core; do not mistake ignored caches for source.
- Record expected/actual tests, exact SHA and authorization. Distinguish historical acceptance, fresh measurement, current source and proposals; no tool call or rollout claim without evidence.
