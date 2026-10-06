# Checkpoint 2 trust boundary

## Compiled Ed25519 pin

`src/device/official-trust.ts` contains the sole production approval pin:

```pem
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAKhves7kRYVJvUh3S9nyZr7g3nhSuibxSz819C85ECfA=
-----END PUBLIC KEY-----
```

SHA-256 of DER SPKI: `45fa563ffc94da59545a6f0956f00b3a14ba7a521d999ad124d93196d0d6a7c4`.

The bootstrap pin's private key was not retained. No real SOC-issued approval is claimed. The un-skipped G2 positive test signs with a locally generated Ed25519 pair and supplies its public key explicitly to the pure `verifyOfficialApproval` signature helper. No crypto substitution is used in this test. That helper does not authorize execution. The production authorization function supplies no alternate key, and the same test proves the test signature fails production authorization. Other existing integration positive controls substitute crypto only inside isolated test processes.

## Privileged entry point inventory

In `src/context/service.ts` the current Phase 7/8 boundaries are:

- Constructor: calls `initializeFeature` for each explicitly enabled feature.
- `initializeFeature`: calls the synchronous `requireFeatureAuthorized` boundary; registers no side effects.
- `requireFeatureAuthorized`: checks explicit opt-in and validates the pinned approval and revocation source.
- `executeFeature`: calls `requireFeatureAuthorized` synchronously immediately before `action()`.

There is no `startLiveCapture` or `dispatchGatewayTool` implementation in this phase. Adding those later requires the same colocated gate. Foreground local search/index/checkpoint APIs are not Phase 7/8 entry points. Direct module execution boundaries `executeLiveCapture` and `executePublicGateway` independently call the synchronous authorization function immediately before their callbacks.

Revocation takes effect on the next call. There is no await, scheduling, or cached authorization between validation and callback entry. This bounds the window but does not claim atomicity with a concurrent filesystem edit or cancellation of work already running. Missing approval locks execution. Missing revocation list means no revoked digests; unreadable or oversize lists lock execution, and malformed JSON/schema throws `FEATURE_GATE_LOCKED: revocation list malformed`.

## Trust read isolation

The full requested `git grep` is retained in checkpoint evidence. It has legitimate runtime matches; a claim of zero matches across all source would be incorrect. Approval authorization reads only the size-bounded approval and revocation files in the trusted config directory. No environment or argv key, feature flag, alternate key file, or CA file enters signature verification. The pure signature helper performs no runtime reads. The gateway TLS bootstrap in the same source module separately reads gateway URL and CA configuration; it never sets or replaces the SOC approval pin.

## Private overlap harness

`test/context/fixtures/fencing-overlap-worker.js` defines an unexported test-only subclass. It intercepts the registry COMMIT after durable admission and before evidence BEGIN, and pauses only in the child test process. Production constructors have no interleaving-hook option; the G6 regression injects candidate option names and proves no callback runs.

Two async overlap tests keep the worker alive while `child_process.spawn` runs a reaper/token replacement process. Both processes query `PRAGMA database_list` and compare real paths against the exact on-disk `repo.sqlite`. Each child must exit 0; the worker then resumes and must reject its stale epoch/token with `RESERVATION_FENCED_OFF`, leaving the evidence count unchanged.
