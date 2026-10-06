# R1–R4 review-blocker evidence

Checkout: E:/git-project/wt-mcp-device-111-context
Branch: feat/mcp-device-1.0.11-context
Code commit X′: 6d9d390b2dda5d1cf50da1906c0d5f57b07a454f

## R1 — direct checkout outputs

Verbatim output is in `r1-raw-outputs.txt`, captured using:

```sh
sha256sum evidence/context/checkpoint2-raw-tap.txt
grep -nE "^(not )?ok (28|59|67|133|134|137|138|139|140|141|142|143|144) " evidence/context/checkpoint2-raw-tap.txt
```

SHA-256: e512cccc36d12f7ab63aec7416462b1fd45107e614efd6f8c182f9de4c6cd95c

The requested numeric test IDs refer to the new run; inserting regression tests shifts subsequent IDs. Use test names as well as numbers when comparing earlier evidence.

Exact privileged entry points:
- `src/context/capture.ts:executeLiveCapture`
- `src/context/gateway.ts:executePublicGateway`
- `src/context/service.ts:executeFeature`

## R2 — fix and verification

Missing/unreadable revocations return `FEATURE_GATE_LOCKED: revocation list missing or unreadable` from the internal checker and cause `requireFeatureAuthorized` to throw; the boolean authorization API returns false. Default trust config resolves from `import.meta.url` to the installation's `config` directory, never process.cwd(). Public capture/gateway signatures have no configDirectory argument. Trusted runtime service options retain their documented internal config seam; MCP arguments do not populate it.

`config/revoked-approvals.json` ships as `[]`, including in the npm files allowlist. Digest arrays are validated; existing schema_version:1/revoked_digests objects remain supported for compatibility.

Regression evidence:
- `r2-red-tap.txt`: four R2 tests fail on original implementation; existing R3 revalidation behavior passes.
- `r2-red-build.txt`: build preceding red run.
- `r2-build.txt`: final npm run build, exit 0.
- `checkpoint2-raw-tap.txt`: `node --test test/context/*.test.js > evidence/context/checkpoint2-raw-tap.txt 2>&1`, exit 0; 158 tests, 158 pass, zero failures/cancellations/skips.
- `r2-code.diff`: full X′ diff.

Required R2 tests in review-blockers.test.js pass at IDs 137–138. Additional public entry configuration-injection tests pass at IDs 139–140. Existing signature, expiry, revocation, scope and removal tests continue passing; their positive fixtures now supply explicit empty revocation lists. Test-only filesystem substitution permits installed-config positive controls without shipping a production config override.

## R3 — registration and initialized-but-unauthorized service

`r3-registration-and-gates.txt` contains literal registration excerpts from src/server.ts and all privileged gate definitions. General MCP tools are registered in ListToolsRequestSchema's allTools array. The three privileged context entry symbols and both feature flags have zero matches in src/server.ts: these future Phase 7/8 functions are not registered as MCP tools. General tools are not claimed to be protected by the SOC context gate.

New test ID 141 initializes a service with both flags enabled and a valid signed positive-control artifact, verifies both actions, removes that artifact, and asserts FEATURE_GATE_LOCKED before either callback can run. Existing tests also reject enabled-flag construction without approval.

## R4 — SOC confirmation reference and provenance

User-supplied corporate SOC confirmation reference: `SEC-2026-09-SOC-PIN`, reported as logged in the corporate Jira/ServiceNow queue with fingerprint `45fa563ffc94da59545a6f0956f00b3a14ba7a521d999ad124d93196d0d6a7c4`.

This records the user's attestation; corporate queue existence/status was not independently verified in this checkout. A ticket reference is not a signed approval artifact and does not unlock either feature. No corporate ticket attachment or signed SOC approval was fabricated.

`r4-authorization-lines-1-45.txt` contains src/context/authorization.ts lines 1–45 verbatim. Features remain locked by default in the absence of valid SOC approval.

## Disposition

R1–R3 repository evidence is supplied for reviewer reevaluation. R4 reference is supplied with explicit attestation provenance, not independent corporate SOC confirmation. READY_TO_PROCEED remains the reviewer's decision.
