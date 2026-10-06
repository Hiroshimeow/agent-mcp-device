# US5B / Phase 8 verification

Worktree: `wt-mcp-device-111-context`, branch `feat/mcp-device-1.0.11-context`.
Baseline package: 1.0.10. No release version/trust configuration changed.

## Implemented and verified

- T050: six full fixture-matched MCP schemas, annotations, unknown-action rejection, 4,475 UTF-8 catalog bytes / 1,118.75 estimated tokens. Optional per-ref read byte ranges finalized and tested (Unicode boundaries, aggregate budgets, cursor binding).
- T051: gateway content canaries cover success, typed error, thrown sensitive error, truncation/cursor, debug output and metrics. No files change and no content reaches console or telemetry. Gateway imports no Store/search/service/filesystem implementation.
- T052: gated catalog and read/write custom-tool forwarding seam; device adapter executes existing local ContextService operations. Both device hello protocols advertise approved context capabilities/version. Existing ten device capabilities remain unchanged.
- T053: owner/online/version/capability checks before forwarding; authenticated device identity and permitted repository path before ref/cursor/job lookup. Typed safe errors without server fallback. Unknown exceptions redact to INTERNAL_ERROR; telemetry includes only bounded tool name/lane/outcome. All adapter local_* calls require executePublicGateway with FEATURE_PUBLIC_GATEWAY approval.
- T054: exact CLI/MCP JSON equality for status/search/read/graph, missing evidence, tampered cursor and sync/rebuild. No content/scope/error/coverage normalization. Write comparisons use copied starting state and deterministic test-only job entropy/time rather than stripping domain fields.
- T055: actual MCP SDK client refresh and replacement-client registration verified; see catalog-rollout.md. **Authenticated external account/client UI rollout remains unverified because no such accounts were available.**
- T056: full compatibility/context regression runs pass; artifacts below.

## Raw verification artifacts

| Artifact | Command | Result |
|---|---|---|
| phase8-build.log | npm run build | exit 0; TypeScript/build successful |
| phase8-targeted.log | node --test test/context/{mcp-contract,gateway-no-persistence,adapter-parity,read-ranges,catalog-rollout}.test.js | 7 passed, 0 failed |
| phase8-device-compatibility.log | node test/test-gateway-device-channel.js | exit 0 |
| phase8-full-regression.log | node test/run-all-tests.js | 66 modules passed, 0 failed |
| phase8-context-regression.log | node --test test/context/*.test.js | 186 tests passed, 0 failed, 0 skipped |

The initial full regression caught an unintended change to legacy allowed-root error wording. Restored the legacy message with an ACCESS_DENIED code; context errors still expose only the safe code. The final full regression was rerun after that correction. Node's existing SQLite experimental/punycode deprecation warnings remain; build has no errors.

## Scope and remaining rollout prerequisite

No hosted gateway repository/deployment or authenticated external client account was provided. This change supplies the accepted stateless registration/forwarding seams and validates them with real SDK transports, but does not claim a production gateway deployment or live-account catalog observation. Before live rollout, the coordinator must integrate these seams in the hosted gateway and record representative account refresh/re-registration observations. T055 is therefore not claimed complete against the original live-account requirement.

KISS/YAGNI review: no scheduler, provider, gateway persistence, content cache, remote fallback, new graph continuation engine or persistent job orchestration was added. Wiki remains disabled. Unsupported foreground job orchestration inputs and unavailable project mappings fail closed. Production security approval is still pinned; only isolated fixtures substitute throwaway keys/config reads.
