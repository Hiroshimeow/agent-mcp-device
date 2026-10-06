# Device-local context — 1.0.11 (unreleased)

## Runtime and migration

Node **>=22.13.0** is required. Context uses built-in `node:sqlite`, WAL and FTS5; no external SQLite npm driver is needed. Validate the actual runtime with `node --test test/context/sqlite-platform.test.js`. SQLite may emit an experimental warning on supported Node 22 builds; that warning is not a test failure.

Upgrade Node before adopting this branch. Stop the runtime and back up the complete `~/.mcp-device/` directory (or configured state root), including WAL files, before migration. Store opening applies versioned local schema migrations; do not point an older runtime at a migrated context store. Legacy JSONL import is explicit/idempotent, preserves source files, and quarantines unknown owner/repository evidence rather than assigning it to the current account. There is no automatic legacy ownership adoption or rollback promise. Published 1.0.10 release history is unchanged.

## Local commands

Run on the device state host and inside the intended Git repository. A container or SSH workspace is not automatically the state host. `--cwd` and `--json` are shared flags. JSON is written to stdout; safe diagnostic codes go to stderr.

| Command | Main flags / meaning |
| --- | --- |
| `context status` | Read freshness, capture gaps, quotas and jobs; no indexing |
| `context search` | `--query`, `--limit`, `--max-bytes`, `--cursor`, repeated `--source-type`, `--since`, `--until` |
| `context read` | Repeated `--ref`, `--max-bytes`, `--cursor`; retained evidence, not current source |
| `context graph` | Repeated `--ref`, `--action` neighbors/path/timeline/related, `--target`, `--direction`, bounded `--max-hops`, `--max-nodes`, `--max-edges`, `--max-visited`, `--max-bytes`, `--wall-ms`, `--generation` |
| `context sync` | Explicit incremental indexing of retained events; no source scan |
| `context checkpoint` | `--summary`, repeated `--evidence-ref`; observed Git state, reported summary/claims |
| `context rebuild` | Explicit bounded derived-index rebuild |
| `context cancel` | `--job-ref`; scoped foreground/pending job semantics, not a persistent worker |

`mcp-device --help` exposes the generated command contract. Unknown flags/actions fail closed. Exit codes: 0 success; 2 invalid action/budget/scope; 3 permission/local-state/token denial; 4 missing/stale index/ref/cursor; 5 busy/quota/degraded storage; 1 unexpected internal failure. CLI calls ContextService directly and needs neither gateway nor network.

Search first, read selected refs, then inspect current files with native tools. Preserve returned scope, provenance, coverage, generation, retention/redaction and partial-result fields. Use continuations with the same query/refs; do not manufacture or repurpose cursors. Run sync only when required by the task and freshness, not on every turn. No status/read/search/idle scheduler exists.

## Public MCP schemas

The source of truth is [`../src/context/tool-contract.ts`](../src/context/tool-contract.ts), verified against the frozen six-tool fixture. Registration and live capture remain approval-gated; a local development version does not authorize production rollout.

| Tool | Lane | Operations |
| --- | --- | --- |
| `local_status` | read | Inspect state without maintenance |
| `local_search` | read | Bounded retained evidence retrieval |
| `local_read` | read | Selected refs/ranges within aggregate byte bounds |
| `local_graph` | read | Bounded evidence-backed activity relations |
| `local_index` | write | sync/checkpoint/rebuild/cancel, no destructive admin |
| `local_wiki` | read | status only, returns WIKI_DISABLED; zero provider calls |

Device/repository ownership and permissions are checked before ref/cursor/job lookup. Unsupported old devices return DEVICE_UNSUPPORTED rather than server fallback. Unknown public exceptions become INTERNAL_ERROR without sensitive details. Schema ceilings do not guarantee that every allowed input is implemented: unsupported graph continuations and maintenance orchestration inputs fail closed; domain graph limits are stricter than some schema maxima.

## Scope, privacy and limitations

Repository identity follows Git common-directory identity; worktrees share the repository, separate clones do not. Ambiguous/non-Git scopes fail rather than falling back globally. After re-pair, former owner namespaces remain sealed. ACCESS_DENIED/LOCAL_STATE_UNAVAILABLE is not permission to bypass a sandbox remotely.

See [PRIVACY.md](../PRIVACY.md): redaction is best-effort, local SQLite is not encrypted, and selected remote evidence traverses the gateway. No transcript reading, source-code parser, embedding provider, generated wiki or hidden worker is included. Activity edges describe observations/attempts, not causation or proof that an edit fixed a test. Capture gaps and unknown-after-restart remain explicit; no side-effect replay occurs. Process-crash tests do not prove host power-loss durability.

New captured evidence uses opaque 48-hex refs accepted by read and activity graph; existing migrations continue accepting legacy string/UUID refs. Observer-to-graph parity has a regression test. Benchmark capture and activity datasets remain separate and do not imply identical workloads.

## Approval trust and revocation

Phase 7/8 implemented and gated; production enablement pending SOC confirmation of fingerprint 45fa563f...d0d6a7c4 and private key custody.

Production pins `SOC_PUBLIC_KEY`; there is no environment, caller key or config-directory override. Test and benchmark positive controls substitute a throwaway key and installed-config file reads only in their isolated Node process using `syncBuiltinESMExports`; they do not replace the production pin. Approval artifacts authorize feature scopes, **not a device ID**. `expires_at` is an integer Unix timestamp in **milliseconds**. Anyone with write access to the installed config folder can modify the revocation list (including removing entries); filesystem access control is therefore part of the trust boundary. Missing, malformed or unreadable revocations fail closed. Every capture event rechecks authorization synchronously; revocation/expiry detaches the active observer before any write. Public context tools are hidden when authorization is locked, and locked device capability routing returns `DEVICE_UNSUPPORTED`; direct privileged entry calls throw `FEATURE_GATE_LOCKED`.

`src/device/gateway-*` is the existing device-management communication channel. Phase 8 public context dispatch/domain integration lives in `src/context/device-adapter.ts` and `src/context/gateway.ts`; the device tool adapter bridges these through `executePublicGateway`.

## Skill source and attribution

[`../skills/mcp-device-context/SKILL.md`](../skills/mcp-device-context/SKILL.md) is portable source shipped in the npm package. Load it explicitly through the client's supported mechanism; no installer or universal automatic invocation is promised. Exact validated clients/limitations are in `evidence/context/skill-compat.md`.

All new context code, documentation and skill source remain covered by the repository MIT [license](../LICENSE). No new third-party runtime dependency, copied external skill implementation, parser/model/provider or license obligation is introduced by Phase 9. SQLite is supplied by Node; Node/SQLite upstream license notices remain those of the installed runtime, not a bundled SQLite driver. The benchmark reuses this repository's accepted 1.0.10 benchmark core, attributed in `bench/README.md`.

## Evidence and delivery boundary

`evidence/context/platform-matrix.md`, `independent-review.md` and `acceptance.md` distinguish measured results, failures and NOT_MEASURED prerequisites. Benchmark measurements are local-domain fixture timings, not production network latency or release authorization. No merge, publish, tag or release is authorized by this work.
