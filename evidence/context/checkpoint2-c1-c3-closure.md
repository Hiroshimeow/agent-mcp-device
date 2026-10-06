# Checkpoint 2: C1–C3 closure

Code Commit X″: `7aaf95b4470709a3fc5462eacfc89a7006ec7588`

## Narrow sign-off

READY_TO_PROCEED for Checkpoint 2, Phase 7/8 gated on a pinned key, pending SOC confirmation of the fingerprint.

This is not SOC confirmation, nor permission to enable Phase 7/8. The compiled bootstrap pin remains the sole production trust anchor; its private key was not retained. A corporate SOC replacement requires a reviewed source/build change. SHA-256 DER SPKI fingerprint: `45fa563ffc94da59545a6f0956f00b3a14ba7a521d999ad124d93196d0d6a7c4`.

## C1

Exact authorization.ts lines 46–end: `checkpoint2-c1-lines.txt`.

Revocation JSON must be an array of lowercase SHA-256 digest strings; versioned objects are now rejected. Matching uses exact `revoked.includes(digest)`. All approvalFailure errors, including untrusted signatures and the outer catch, return a FEATURE_GATE_LOCKED-prefixed error; only successful authorization returns undefined. GATE_ERROR is defined at authorization.ts:9.

Regression tests at test/context/review-blockers.test.js:474–481 cover valid JSON non-arrays `{ "revoked": true }`, `"invalid"`, and the previously accepted versioned object. The versioned-object test failed before implementation (missing expected exception); the two other examples already failed closed.

## C2

Exact options, constructor and requireFeatureAuthorized: `checkpoint2-c2-lines.txt`.

ContextServiceOptions no longer contains configDirectory. The service calls requireFeatureAuthorized(feature) without a directory argument, resolving authorization against the installed module configuration. JavaScript callers may provide extra properties but the configDirectory override is ignored. Regression tests at test/context/review-blockers.test.js:483–491 cover both features with a cryptographically valid caller-directory positive control and assert initialization/execution remains locked. Both initialization assertions failed before implementation (missing expected exception).

Positive-control service tests redirect module filesystem reads within isolated test processes; no production service configuration-injection seam is retained.

## C3

Exact src/server.ts:264–273: `checkpoint2-c3-registration.txt`.

Unedited raw stdout of requested searches:

- `git grep -nE "executeLiveCapture|executePublicGateway" src`: `checkpoint2-c3-entrypoints-grep.txt`
- `git grep -nE "requireFeatureAuthorized" src`: `checkpoint2-c3-authorization-grep.txt`

The capture/gateway functions occur only at their gated definitions; no server registration or call site is present. Every entry and service execution revalidates authorization before invoking the supplied action.

## Fresh verification

- `npm run build > evidence/context/checkpoint2-build.txt 2>&1`: exit 0.
- `node --test test/context/review-blockers.test.js test/context/c2-closure.test.js test/context/pinned-gates.test.js > evidence/context/checkpoint2-c1-c2-targeted-tap.txt 2>&1`: exit 0; 66 pass, 0 fail.
- `node --test test/context/*.test.js > evidence/context/checkpoint2-raw-tap.txt 2>&1`: exit 0; 163 pass, 0 fail, 0 skipped/cancelled/todo.
- `git diff --check`: exit 0 (Git line-ending conversion warnings only).

Node emits its existing experimental SQLite warning. No test failures are present. Evidence is committed separately as Commit Y″, the direct child of X″; obtain its identity with `git log -1 --format=%H -- evidence/context/checkpoint2-c1-c3-closure.md`.
