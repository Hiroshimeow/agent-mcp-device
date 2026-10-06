---
name: mcp-device-context
description: Inspect shared device-local repository evidence using the local context CLI before continuing work with native tools.
---

# Device-local context

Requires Node >=22.13.0 and the 1.0.11 context CLI; runtime details are documented in docs/context.md. This portable source is covered by the repository MIT license; no host-specific installer is included. Redaction is best-effort: never supply credentials or publish local evidence without inspection.

Search first for relevant historical evidence. Run on the device state host, in the intended Git repository, using its active owner namespace. Network and a running gateway are not required. A workspace/container/SSH host may not be the state host.

```text
mcp-device context status --cwd . --json
mcp-device context search --cwd . --query "gateway reconnect" --limit 8 --json
mcp-device context read --cwd . --ref <evidence-ref> --max-bytes 262144 --json
```

Read only selected refs, preserving provenance, redaction, retention, coverage and generation information. Use the same query/filters or refs and the returned next_cursor with --cursor to continue. Historical evidence is not current source: verify current source with native file/Git tools before editing or relying on claims.

Maintenance is selective, explicit and bounded. If status indicates missing/stale context and the task needs it:

```text
mcp-device context sync --cwd . --json
```

Do not sync on every turn, read, search or idle interval. Never start a persistent maintenance worker. A bounded failure is not permission to bypass limits.

At a meaningful work boundary, optionally record a checkpoint:

```text
mcp-device context checkpoint --cwd . --summary "Implemented change; test success is a reported claim" --evidence-ref <evidence-ref> --json
```

Git metadata is observed; summary and supplied evidence refs are reported. Checkpoints are not native command/editor/test traces, and do not prove native tests passed. Do not inspect agent transcripts, credentials or internal storage. Do not install/update anything automatically. NMem is not required. local_wiki is disabled in this feature; do not call providers.

# Fail closed

On ACCESS_DENIED or LOCAL_STATE_UNAVAILABLE, stop and explain the local permission/state-host problem. Do not use remote fallback to bypass sandbox denial. Never auto-select, merge or adopt sealed namespaces after re-pairing. Do not pass owner/account/device/storage selectors.

If the CLI is absent (not denied), a remote context tool may be used only after the target device and repository are explicitly identified and authorized. Otherwise ask for access to the correct host. Do not claim universal automatic skill discovery: load this portable skill explicitly through the client's supported mechanism.
