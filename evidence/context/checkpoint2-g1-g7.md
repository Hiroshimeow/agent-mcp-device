# Checkpoint 2 G1–G7 verification

Precommit verification: `npm run build` succeeds. `node --test test/context/*.test.js`: 149 tests, 148 pass, 0 fail, 1 skip (G2). `npm test`: 64/66 modules pass; fails `test-canonical-release-cleanup.js` (CLAUDE branding in src/context/cli.ts) and `test-mcp-device-branding.js` (upstream marketing assets). These files were not changed for this checklist; the broad suite is not green.

Status: BLOCKED, not unconditional READY_TO_PROCEED. G2 requires a genuine SOC-signed approval fixture; the current compiled-in bootstrap pin explicitly states its private key was not retained. Do not rotate the production pin, retain an official private key in tests, or represent crypto substitution as official approval.

## G1 — provenance

Commit X contains source, tests, and this checklist. From a clean X, build and run the context suite into an OS temporary file outside the worktree. The evidence header records X, empty `git status --porcelain`, Node version, commands and exit codes. Copy only the completed evidence into `checkpoint2-raw-tap.txt`; Commit Y changes only that file. Verify one commit in X..Y and Y's parent equals X.

## G2 — pinned trust and blocked positive path

`src/device/official-trust.ts:9–14` defines the literal Ed25519 `SOC_PUBLIC_KEY`; authorization imports that constant directly. No argument, environment or arbitrary file can substitute the SOC key. The rest of official-trust.ts configures gateway URL and TLS CA (including environment/options/filesystem sources); those are distinct from the approval signing key. Claiming the entire module has no environment/file reads would be incorrect.

`test/context/pinned-gates.test.js` adds an unmocked positive test for both privileged functions. It expects `test/context/fixtures/official-soc-approval.json`, signed over canonical `{expires_at,features,schema_version}` by the official pin's private key, with both features and a still-valid expiry. Absent that fixture it explicitly skips and reports BLOCKED. Existing substituted-key positive controls are not G2 proof.

## G3 — grep

Run the exact requested `grep -rn "MCP_DEVICE_SOC_PUBLIC_KEY\|process.env" src/device src/**/gateway* src/**/capture*`; full output is included in the evidence header. It contains unrelated environment reads but no SOC key reads. Supplemental grep across `src` checks the SOC environment variable specifically.

## G4 — revocation

The trusted local administrator may place `config/revoked-approvals.json` alongside `soc-approval.json`:

```json
{"schema_version":1,"revoked_digests":["<lowercase SHA-256 hex>"]}
```

Digest UTF-8 `JSON.stringify({expires_at,features,schema_version,signature})` with keys in that order (canonical signed artifact, not raw file bytes). Formatting/key-order edits do not bypass revocation. Revocation is re-read on every invocation after signature validation, without cache. An absent revocation file means no revoked approvals; malformed/oversized/unreadable files fail closed. Revoked artifacts throw exactly `FEATURE_GATE_LOCKED: artifact revoked`. Trust assumes administrator-controlled config; this is a local digest denylist, not a signed remote CRL. Administrators should atomically replace the file.

Regression tests cover both functions, formatting changes, malformed revocation and unrelated digests. They use the explicitly labelled substituted-key test trust helper; official pin acceptance remains blocked under G2. Before implementation, both revocation tests and malformed-source test failed with `true !== false`; after implementation they pass.

## G5 — scope and atomicity

`executeLiveCapture` and `executePublicGateway` call `requireFeatureAuthorized` immediately before `return action()` inside their privileged function boundaries. That function calls the same uncached `approvalFailure` used by `isFeatureAuthorized`; using a boolean API alone would discard the required revoked error reason. No await, callback, timer or other application execution occurs between authorization and action invocation. This prevents startup-only authorization and checks subsequent calls after removal/expiry/revocation. It does not claim filesystem changes by another process cannot occur in the interval, or that asynchronous actions are continually authorized after invocation. These boundaries remain trusted domain APIs, not live capture registration/public network route wiring.

## G6 — hook safety

The interleaving hook exists ONLY in `test/context/review-blockers.test.js`: the harness replaces its own store's `registry.exec` with a local callback wrapping the original. Production `quotaWrite` has no hook parameter, hook field or environment switch; default behavior is the normal SQLite exec (no injected callback). The test wrapper runs once after admission COMMIT and before the evidence transaction. This is a test-harness injection, not a production runtime feature; there is no production callback default to set to undefined.

## G7 — separate process reaper

The test named `B2 repo.sqlite is authoritative and a separate reaper fences an in-flight worker` (formerly TAP test 128; numbering changes when tests are added) uses `spawnSync(process.execPath, ['--input-type=module','-e', ...])` from `node:child_process`. The child imports ContextStore and constructs `new ContextStore(root)`, obtaining independent registry/repository SQLite connections in a separate OS process. It expires reservations, reconciles quota and closes its own store. The parent asserts exit status 0, reservation deletion, authoritative epoch increment and worker rollback under its repo transaction.
