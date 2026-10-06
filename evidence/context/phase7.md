# Phase 7 — canonical live capture (Code Commit X)

Scope: T045–T049, based on `6652abf2ca3badf40a2052518ccb303f93719cab`.

## Ownership and lifecycle

- Public boundaries: `GatewayToolAdapter.call`, local server call handler, and direct dispatcher. AsyncLocalStorage suppresses nested recording without suppressing concurrent independent invocations.
- Trusted runtime explicitly installs an owner/repository-bound observer. Importing capture does not activate hooks. Production approval is still required by `executeLiveCapture`; service feature opt-in is checked before writes.
- Intent precedes one execution; outcome updates the same row. Capture uses quota/fencing admission, redaction with a 64 KiB retained payload cap, and 25 ms SQLite busy timeouts restored after each attempt.
- Storage failures fail open with in-memory health gaps. Unresolved durable intents become unknown after restart. Neither recording nor transport failures replay execution.
- Process identity is execution UUID plus runtime-generation UUID, not PID. Read metadata includes range/completeness/eviction. Identical canonical polling payloads reuse repository-scoped redacted evidence.
- Legacy history import remains unchanged. Active capture suppresses legacy toolHistory writes; disabled capture preserves existing behavior. `local_*`, history and UI event results are excluded.

## Verification

Environment: Windows, Node v22.22.2.

- `npm run build`: exit 0, zero TypeScript errors.
- `node --test "test/context/*.test.js"`: 179 tests, 179 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo; duration 32560.0651 ms.
- `node test/run-all-tests.js`: 66 modules, 66 pass, 0 fail; total execution 166404 ms. This runner also builds the project.
- `git diff --check`: exit 0.

Tests use the throwaway Ed25519 approval fixture and installed-config redirection established by `review-blockers.test.js`. Red runs confirmed absent execution API, missing process identity/range deduplication, and cross-observer outcome idempotency; green runs cover these contracts.

Compatibility fixture updates: the extracted-class PID test receives the new public-observer dependency, and branding expectations include the already-established approval revocation/skill package allowlist. Production packaging is unchanged.

Rollout remains explicitly gated: this phase does not add automatic repository discovery, public context schemas, scheduling, or gateway persistence. Phase 8 owns those separately.
