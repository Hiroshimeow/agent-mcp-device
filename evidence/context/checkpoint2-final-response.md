# Checkpoint 2 — final source-verified response to Opus

## Scope, provenance and disposition

Audited worktree: `E:/git-project/wt-mcp-device-111-context` (not the integrating worktree). Audited HEAD / evidence commit Y: `50ae25521943bdea8e85bdf20260c4fe1ca32746`. Code commit X: `07bf2455918baa216a6d2ebb588dd040bd78b0dd`. The worktree was clean before and after fresh build/tests, before adding this response. References below are relative to that worktree; excerpts are verbatim source, not proposed implementations.

**Disposition: evidence packet ready; requested security claims are NOT all established.** Do not treat this packet as SOC approval or Phase 7/8 enablement. Specifically:

- The actual pin is `SOC_PUBLIC_KEY`, not `OFFICIAL_SOC_PUBLIC_KEY`; the verification call is in `authorization.ts`, reached by `service.ts`.
- Config filenames are fixed, but their parent directory is configurable through trusted API options and defaults to the process working directory. Immutable absolute/root-relative paths cannot be claimed.
- No `dispatchGatewayTool` or Phase 7/8 MCP registration exists. Existing general MCP tools do not all route through ContextService.
- The approval is read once; signature and revocation digest derive from the same parsed artifact, but NOT the same literal Buffer. They use different canonical serializations.
- No overridable production interleaving hook method exists. The test subclass intercepts the public registry handle.
- Missing revocation file currently permits an otherwise valid approval. Missing-revocation fail-closed evidence does not exist.
- The supplied ticket identifier `SEC-2026-09-SOC-PIN` is an external reference only. No signed ticket or independently authenticated corporate SOC attestation was supplied or found. Fingerprint agreement is not proof of corporate authority.

## Fresh verification

Executed from this worktree, both commands exited 0:

```sh
npm run build > /tmp/context-final-build.txt 2>&1
node --test test/context/*.test.js > /tmp/context-final-tests.txt 2>&1
```

On this Windows/Git Bash host the log paths resolve to `C:/Users/admin/AppData/Local/Temp/context-final-build.txt` and `C:/Users/admin/AppData/Local/Temp/context-final-tests.txt`. These are fresh local verification logs, not replacements for committed reviewer evidence. Fresh TAP summary:

```text
1..153
# tests 153
# suites 0
# pass 153
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 23271.4524
```

Committed test IDs below refer to `evidence/context/checkpoint2-raw-tap.txt` at Y. Test ordinals are TAP run ordinals, not stable source identifiers. Opus's separately verified pin and async-overlap findings are acknowledged; no additional corporate provenance follows from those findings.

## B1 — signature seam, production call chain and SOC reference

### Exact seam and compiled pin

`src/device/official-trust.ts:9–29`:

```ts
// Sole compiled-in SOC trust anchor: no runtime/env/filesystem override.
// Fail-closed bootstrap pin; private key was not retained. An authenticated
// corporate SOC replacement requires a reviewed source/build change.
export const SOC_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAKhves7kRYVJvUh3S9nyZr7g3nhSuibxSz819C85ECfA=
-----END PUBLIC KEY-----`;

// SHA-256 over DER SPKI (not PEM formatting).
export const SOC_PUBLIC_KEY_SHA256 = '45fa563ffc94da59545a6f0956f00b3a14ba7a521d999ad124d93196d0d6a7c4';

/** Pure signature verification seam. The explicit key is for local tests only:
 * runtime authorization never supplies it and always uses the compiled pin.
 * This helper alone does not authorize execution or check revocation. */
export function verifyOfficialApproval(artifact: { expires_at: number; features: string[]; schema_version: number; signature: string }, testPublicKeyForTestingOnly?: KeyObject): boolean {
    try {
        const key = testPublicKeyForTestingOnly ?? createPublicKey(SOC_PUBLIC_KEY);
        const signature = Buffer.from(artifact.signature, 'base64');
        if (key.asymmetricKeyType !== 'ed25519' || signature.length !== 64 || signature.toString('base64') !== artifact.signature) return false;
        const payload = JSON.stringify({ expires_at: artifact.expires_at, features: artifact.features, schema_version: artifact.schema_version });
        return verify(null, Buffer.from(payload), key, signature);
```

The second argument is a real exported signature-test seam; its name/comment is not a security boundary. Production authorization supplies no second argument. This proves the production call uses the default compiled pin, not that arbitrary same-process code cannot call the helper with another key. The helper alone confers no runtime authorization.

### Exact production chain

`src/context/service.ts:13–18` defines all service options:

```ts
export interface ContextServiceOptions {
  FEATURE_LIVE_CAPTURE?: boolean;
  FEATURE_PUBLIC_GATEWAY?: boolean;
  /** Trusted runtime configuration only; never accepted from tool arguments. */
  configDirectory?: string;
}
```

`src/context/service.ts:28–31`:

```ts
  constructor(private readonly store: ContextStore, private readonly options: ContextServiceOptions = {}) {
    for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'] as const) {
      if (options[feature] === true) this.initializeFeature(feature);
    }
```

`src/context/service.ts:36–49`:

```ts
  initializeFeature(feature: GatedFeature): void {
    this.requireFeatureAuthorized(feature);
  }

  requireFeatureAuthorized(feature: GatedFeature): void {
    if (this.options[feature] !== true) throw new Error(GATE_ERROR);
    requireFeatureAuthorized(feature, this.options.configDirectory);
  }

  /** Revalidate synchronously immediately before the side effect. Revocation
   * takes effect on the next call; this is not cancellation of in-flight work. */
  executeFeature<T>(feature: GatedFeature, action: () => T): T {
    this.requireFeatureAuthorized(feature);
    return action();
```

`src/context/authorization.ts:24` is the actual sole production signature call:

```ts
    if (!verifyOfficialApproval(artifact)) return 'SOC_KEY_UNTRUSTED';
```

`src/context/authorization.ts:53–55`:

```ts
export function requireFeatureAuthorized(scope: GatedFeature, configDirectory?: string): void {
  const failure = approvalFailure(scope, configDirectory);
  if (failure) throw new Error(failure === 'SOC_KEY_UNTRUSTED' ? `${GATE_ERROR}: SOC_KEY_UNTRUSTED` : failure);
```

Source call-site audit found one production invocation of `verifyOfficialApproval`: the one-argument call above. No constructor option, environment key, DI key or artifact key field is forwarded to its optional key parameter. Service options do affect feature opt-in and file directory, which must not be conflated with pin injection. `test/context/pinned-gates.test.js:11–18` (TAP 59, line 381) proves a genuinely signed local artifact verifies with the explicit test key but fails the default pin and production authorization; it does not substitute crypto in that test.

### Out-of-band SOC reference — NOT VERIFIED

Requested external reference: ticket **`SEC-2026-09-SOC-PIN`**, purported corporate SOC signature confirming DER-SPKI SHA-256 **`45fa563ffc94da59545a6f0956f00b3a14ba7a521d999ad124d93196d0d6a7c4`**.

No signed ticket, signature-verification material, authenticated SOC channel or ticket-system access was supplied. Repository search for the ticket identifier returned no match before this response. Therefore this is a user-provided reference, **not a verified signed attestation**. Existing `docs/context/checkpoint2-trust-boundary.md:17` explicitly says: “No real SOC-issued approval is claimed.” `evidence/context/decisions.md:78` explicitly states the compiled key is a bootstrap pin and not evidence of corporate SOC approval. A real authenticated ticket must be attached/validated out of band; this evidence packet cannot manufacture it.

## B3 — trust-path environment and file-path audit

Audit scope includes the complete approval chain (`official-trust.ts`, `authorization.ts`, `service.ts`, `capture.ts`, `gateway.ts`) and the distinct TLS bootstrap in the pin-containing module. Full-source environment/argv/read matches are already preserved in `evidence/context/checkpoint2-trust-grep.txt`; a global zero-match claim is false.

| Match / input | Exact source reference | Trust effect / conclusion |
| --- | --- | --- |
| Compiled PEM and optional explicit key | `official-trust.ts:12–17,22–28` | Production one-argument call selects compiled PEM. Signature helper has zero env/argv/file reads. |
| Default directory via `process.cwd()` | `authorization.ts:10` | `configDirectory = join(process.cwd(), 'config')`; controlled by launch cwd, not an immutable install root. |
| Approval filename | `authorization.ts:13` | `join(configDirectory, 'soc-approval.json')`: fixed basename, configurable parent. No direct env/argv read here. |
| Approval metadata / bytes | `authorization.ts:14–15` | `statSync(path).size > 16384` rejects; one `readFileSync(path, 'utf8')` parses artifact. Separate stat/read is not an atomic file-size bound under concurrent replacement. |
| Revocation filename | `authorization.ts:31` | `join(configDirectory, 'revoked-approvals.json')`: fixed basename, configurable parent. |
| Revocation metadata / bytes | `authorization.ts:34–39` | `statSync` then one UTF-8 `readFileSync`; oversize >1 MiB and other read failures lock; ENOENT explicitly permits. |
| Revocation JSON/schema | `authorization.ts:42–46` | Parse/schema failure locks; matching canonical artifact digest locks. |
| Directory constructor option | `service.ts:16–17,28,42` | `configDirectory` accepted and forwarded as trusted runtime configuration. No key option exists. No runtime enforcement here that directory is absolute or protected. |
| Direct capture directory argument | `capture.ts:5–6` | Optional `configDirectory` forwarded to authorization. Every callback entry is gated. |
| Direct gateway directory argument | `gateway.ts:5–6` | Same directory injection, separately gated feature scope. |
| Feature defaults / options | `service.ts:11–15,28–31,40–42` | Both constants default false. Explicit true invokes initialization gate; true alone cannot authorize invalid artifact. |
| Test 140 forced flag | `test/context/review-blockers.test.js:477–484` | Actual env name is `FEATURE_PUBLIC_GATEWAY`, not `MCP_DEVICE_FORCE_CAPTURE`; service ignores env flag and still gates constructor opt-in. Artifact `{}` fails schema. Unknown `socApprovalPublicKey` is not consumed. |
| Attacker env key | `test/context/pinned-gates.test.js:37–45` | `MCP_DEVICE_SOC_PUBLIC_KEY` exists only as test attacker input; self-signed approval fails production pin with `SOC_KEY_UNTRUSTED`. |
| TLS gateway URL env/config | `official-trust.ts:55–62` | `process.env.MCP_GATEWAY_URL`, `options.gatewayUrl`, stored gateway URL; only `bootstrapOfficialGatewayTrust`, not approval verification. |
| TLS CA filename and option | `official-trust.ts:41–42,55–57,75–80` | Module-relative `../data/official-app-ca.pem` or `options.caPath`; `fs.readFile(caPath, 'utf8')` validates CA certificate. Does not replace SOC pin. |
| Foreground checkpoint Git env | `service.ts:80–82` | Copies process env and clears Git overrides for Git subprocess; not part of Phase 7/8 approval signature path. |
| argv inputs in these five modules | Complete file audit | No `process.argv` match. This does not make API directory/cwd inputs immutable. |

Exact test 140, `test/context/review-blockers.test.js:477–485`:

```js
test('B3 forced env/config flag and caller key cannot bypass invalid approval', t => {
  const f = approvalFixture(t);
  writeFileSync(f.path, '{}');
  const previous = process.env.FEATURE_PUBLIC_GATEWAY;
  process.env.FEATURE_PUBLIC_GATEWAY = 'true';
  try {
    assert.throws(() => new ContextService(f.store, { configDirectory: f.configDirectory, FEATURE_PUBLIC_GATEWAY: true, socApprovalPublicKey: 'attacker' }), /FEATURE_GATE_LOCKED/);
  } finally { if (previous === undefined) delete process.env.FEATURE_PUBLIC_GATEWAY; else process.env.FEATURE_PUBLIC_GATEWAY = previous; }
});
```

### Build provenance

`package.json:37`:

```json
"build": "shx rm -rf dist && tsc && shx chmod +x dist/*.js && shx cp src/device/update-helper.cjs dist/device/update-helper.cjs && shx mkdir -p dist/data && shx cp src/data/onboarding-prompts.json dist/data/ && node scripts/copy-official-ca.cjs && node scripts/build-ui-runtime.cjs",
```

`tsconfig.json:8–9,18–21` sets `outDir: "./dist"`, `rootDir: "./src"` and includes `src/**/*.ts`, `src/**/*.d.ts`. Thus trust/context TypeScript is compiled directly from `src/` to `dist/` by `tsc` during `npm run build`. The whole build also copies assets/helper and builds UI runtime; saying every file in dist is solely tsc output would be inaccurate. Fresh build exited 0.

## B4 — privileged routing and TOCTOU byte source

### Actual MCP dispatch (not the requested universal routing claim)

`src/server.ts:1173–1186` registers `CallToolRequestSchema` and ends with:

```ts
    if (isUiOriginCall) {
        return runInUiOriginCallContext(() => handleCallToolRequest(request));
    }
    return handleCallToolRequest(request);
});
```

`src/server.ts:1188–1189,1249` defines `handleCallToolRequest` and its own `switch (name)`. The separate existing dispatcher is `src/tool-dispatcher.ts:24–28,66–69`:

```ts
export async function dispatchToolCall(
    name: string,
    args: any,
    options: DispatchToolOptions = {}
): Promise<ServerResult> {
```

```ts
        switch (name) {
            case 'get_config':
                try {
                    result = await getConfig();
```

These do **not** establish that every privileged existing MCP tool routes through `dispatchGatewayTool()` or ContextService. No `dispatchGatewayTool` implementation exists in source; no Phase 7/8 public MCP tool/hook registration was delivered here. Existing device tooling must not be conflated with future context public-gateway registration. `docs/context/checkpoint2-trust-boundary.md:26` records this scope limitation.

### Delivered Phase 7/8 callback boundaries

`src/context/capture.ts:5–8`:

```ts
export function executeLiveCapture<T>(action: () => T, configDirectory?: string): T {
  requireFeatureAuthorized('FEATURE_LIVE_CAPTURE', configDirectory);
  return action();
}
```

`src/context/gateway.ts:5–8`:

```ts
export function executePublicGateway<T>(action: () => T, configDirectory?: string): T {
  requireFeatureAuthorized('FEATURE_PUBLIC_GATEWAY', configDirectory);
  return action();
}
```

Along with `ContextService.initializeFeature`, `requireFeatureAuthorized` and `executeFeature` shown in B1, these are the delivered boundaries. Neither direct module needs service initialization to gate its callback. Future routing coverage remains unproved until actual hooks/routes/tools exist.

### Single approval read: same artifact, not identical Buffer

`src/context/authorization.ts:13–15,24–30`:

```ts
    const path = join(configDirectory, 'soc-approval.json');
    if (statSync(path).size > 16384) return GATE_ERROR;
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
```

```ts
    if (!verifyOfficialApproval(artifact)) return 'SOC_KEY_UNTRUSTED';
    // Digest the canonical signed artifact, not file formatting: whitespace or
    // insertion-order changes cannot resurrect a revoked approval.
    const digest = createHash('sha256').update(JSON.stringify({
      expires_at: artifact.expires_at, features: artifact.features,
      schema_version: artifact.schema_version, signature: artifact.signature
    })).digest('hex');
```

Signature verification (`official-trust.ts:25–28`) decodes `artifact.signature`, creates `Buffer.from(JSON.stringify({ expires_at, features, schema_version }))`, then verifies it. Digest calculation serializes the **same in-memory parsed object**, including the signature. There is zero second approval-file read before digesting. The second file read is the revocation list, not the approval.

Consequently no approval-file swap between signature check and digest changes the artifact being digested. However the requested “digest directly from the SAME in-memory buffer whose signature was verified” is literally false: raw file text is parsed; signed payload excludes signature; digest includes signature; verification creates a Buffer and hashing receives a string. Canonicalization deliberately makes formatting/key-order edits unable to revive a revoked artifact. `pinned-gates.test.js:69–84` tests revocation followed by reformatted/reordered artifact and proves callback count remains one.

### Exact residual-window sentence

`docs/context/checkpoint2-trust-boundary.md:28`:

> This bounds the window but does not claim atomicity with a concurrent filesystem edit or cancellation of work already running.

The preceding sentences are “Revocation takes effect on the next call. There is no await, scheduling, or cached authorization between validation and callback entry.” The same paragraph explicitly says missing revocation list means no revoked digests.

### What test 142 actually covers

TAP 142 (`checkpoint2-raw-tap.txt:900–901`) is **`B3 direct gateway import is initialization-gated`**. Its source is the parameterized test at `test/context/review-blockers.test.js:487–490`:

```js
for (const module of ['capture', 'gateway']) test(`B3 direct ${module} import is initialization-gated`, async () => {
  const api = await import(`../../dist/context/${module}.js`);
  assert.throws(() => api[module === 'capture' ? 'executeLiveCapture' : 'executePublicGateway'](() => assert.fail('unauthorized action')), /FEATURE_GATE_LOCKED/);
});
```

This covers an imported gateway module invoked without approval, NOT a previously authorized/initialized service. Service entry points on a constructed disabled service are TAP 29/30 (`checkpoint2-review.test.js:20–30`). Previously valid direct entry then expired/deleted approval is TAP 62/64 (`pinned-gates.test.js:53–63`); post-approval revocation is TAP 65/66 (`pinned-gates.test.js:69–84`). No single test 142 claim should subsume these distinct cases.

## B2 — hook method and constructor injection

### No production overridable hook exists

There is no `afterAdmission`, `interleavingHook` or `pauseAfterAdmission` hook method in `src/context/store.ts`. The exact production pause location is a normal transaction sequence in `src/context/store.ts:507–512`:

```ts
      // Deterministic interleaving boundary: lease acquired and registry epoch
      // read, admission COMMIT releases registry; NO evidence BEGIN IMMEDIATE
      // has started. A reaper can now revoke in its own repo transaction.
      this.registry.exec('COMMIT'); // Durable before repo writes.
      this.registry.exec('BEGIN IMMEDIATE'); // Preserve registry -> repo lock order.
      const result = action();
```

The real hook-like method is test-only, `test/context/fixtures/fencing-overlap-worker.js:6–17`:

```js
// Private test harness only: no constructor option or runtime hook is exposed.
class InterleavingTestStore extends ContextStore {
  pauseAfterAdmission() {
    const exec = this.registry.exec.bind(this.registry);
    let paused = false;
    this.registry.exec = sql => {
      exec(sql);
      if (sql === 'COMMIT' && this.activeReservation && !paused) {
        paused = true;
        const db = this.repoDatabase(owner, repo);
        assert.equal(db.isTransaction, false);
        const file = db.prepare('PRAGMA database_list').all().find(row => row.name === 'main').file;
```

The subclass intercepts the public `registry` handle (`store.ts:27`), not an overridable production hook. TS-private fields used by the JavaScript harness are not an isolation boundary against same-process arbitrary code. Production constructor has only a read-only option (`src/context/store.ts:67`):

```ts
  constructor(private readonly stateRoot: string, options: { readOnly?: boolean } = {}) {
```

### Exact injection regression

TAP **28**, `checkpoint2-raw-tap.txt:178–179`; complete source `test/context/checkpoint2-review.test.js:7–18`:

```js
test('G6 production constructors ignore attempted interleaving hook injection', t => {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  let calls = 0;
  const injection = { afterAdmission: () => { calls++; }, interleavingHook: () => { calls++; } };
  store = new ContextStore(root, injection);
  const owner = store.activateOwner('review'), repo = store.repository(owner, 'review');
  const service = new ContextService(store, injection);
  store.append(owner, repo, 'production append');
  service.sync(owner, repo);
  assert.equal(calls, 0);
});
```

Result: candidate injected options are **ignored**, not runtime-rejected with an exception. No public constructor hook option is exposed. Verified async overlap evidence remains TAP 133/134 (`checkpoint2-raw-tap.txt:845,853`), using the test-only worker and a real separate reaper/token-replacement process; no new overlap claim is needed beyond Opus's verified result.

## N1–N4 — residual evidence requested in this follow-up

The following subsections address this request's residual bullets, not a renaming of older N1–N7 findings in `checkpoint2-review-packet.md`.

### Missing revocation file — requested fail-closed result is contradicted

Exact policy branch, `src/context/authorization.ts:33–40`:

```ts
    try {
      if (statSync(revokedPath).size > 1048576) return GATE_ERROR;
      revokedText = readFileSync(revokedPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      return GATE_ERROR;
    }
```

`undefined` means authorized (`authorization.ts:49–50`). No dedicated missing-revocation fail-closed regression was found. Existing positive fixture controls omit the revocation file and succeed with test-process crypto substitution. Do not confuse approval-file deletion tests (TAP 62/64) with revocation-list absence.

A fresh diagnostic against freshly built dist reproduced this behavior. It created a temporary signed artifact, substituted crypto key construction **only in its isolated diagnostic process**, left the revocation list absent, called production `isFeatureAuthorized`, then restored crypto and deleted the temporary directory. No production files/keys were changed:

```sh
node --input-type=module -e "import crypto from 'node:crypto'; import {syncBuiltinESMExports} from 'node:module'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; const root=fs.mkdtempSync(path.join(os.tmpdir(),'c2-missing-revocation-')); const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519'); const original=crypto.createPublicKey; try {crypto.createPublicKey=()=>publicKey; syncBuiltinESMExports(); const a=await import('./dist/context/authorization.js'); const payload={expires_at:Date.now()+60000,features:['FEATURE_LIVE_CAPTURE'],schema_version:1}; fs.writeFileSync(path.join(root,'soc-approval.json'),JSON.stringify({...payload,signature:crypto.sign(null,Buffer.from(JSON.stringify(payload)),privateKey).toString('base64')})); console.log('revocation_file_exists='+fs.existsSync(path.join(root,'revoked-approvals.json'))); console.log('authorized_with_missing_revocation='+a.isFeatureAuthorized('FEATURE_LIVE_CAPTURE',root)); } finally {crypto.createPublicKey=original; syncBuiltinESMExports(); fs.rmSync(root,{recursive:true,force:true});}"
```

Exit 0, actual output:

```text
revocation_file_exists=false
authorized_with_missing_revocation=true
```

Malformed list fails closed (TAP 67, `pinned-gates.test.js:85–92`); that is not a missing-list test. Remediation would require a separately authorized policy/code/test change; this task changed documentation only.

### Exact X/Y Git proof

X is the code commit recorded in `checkpoint2-review-summary.md:3`; Y is the immediate evidence/documentation commit. Executed raw commands and output:

```text
$ git -C E:/git-project/wt-mcp-device-111-context diff 07bf245 50ae255 --stat
 evidence/context/checkpoint2-build.txt         |  314 ++++
 evidence/context/checkpoint2-canonical.txt     |    1 +
 evidence/context/checkpoint2-raw-tap.txt       | 2378 ++++--------------------
 evidence/context/checkpoint2-review-summary.md |   32 +
 evidence/context/checkpoint2-trust-grep.txt    |  166 ++
 5 files changed, 846 insertions(+), 2045 deletions(-)

$ git -C E:/git-project/wt-mcp-device-111-context rev-parse 50ae255^
07bf2455918baa216a6d2ebb588dd040bd78b0dd

$ git -C E:/git-project/wt-mcp-device-111-context rev-list --count 07bf245..50ae255
1
```

This proves immediate parent and one-commit evidence-only delta (no source changes), **not** the earlier prescription that Y changes only the raw TAP file. It changes five evidence files. `evidence/context/decisions.md:77` and `checkpoint2-g1-g7.md:9` describe a TAP-only prescription that this latest X/Y pair does not satisfy literally. This uncommitted response is outside that immutable X/Y delta.

### Phase 7/8 mapping to TAP 137–143

| TAP ID / committed line | Exact test name | Source and entry coverage |
| --- | --- | --- |
| 137 / 871 | `B3 tampered SOC signature is rejected` | `review-blockers.test.js:460–465`; `isFeatureAuthorized('FEATURE_LIVE_CAPTURE', ...)`: valid control then tampered signature. |
| 138 / 877 | `B3 expired signed SOC artifact is rejected` | `review-blockers.test.js:467–470`; Phase 7 authorization predicate, expired artifact. |
| 139 / 883 | `B3 Phase 7 approval cannot authorize Phase 8 gateway` | `review-blockers.test.js:472–475`; Phase 8 authorization predicate rejects Phase 7-only scope. |
| 140 / 889 | `B3 forced env/config flag and caller key cannot bypass invalid approval` | `review-blockers.test.js:477–485`; ContextService constructor → initializeFeature → requireFeatureAuthorized for public gateway; invalid artifact, explicit true, env true, unused attacker key. |
| 141 / 895 | `B3 direct capture import is initialization-gated` | `review-blockers.test.js:487–490`; `executeLiveCapture` direct callback invocation rejects without approval. |
| 142 / 901 | `B3 direct gateway import is initialization-gated` | Same parameterized source; `executePublicGateway` direct callback invocation rejects without approval. |
| 143 / 907 | `quota rejection bursts create one deduplicated gap per minute` | `review-blockers.test.js:492–496`; ContextStore quota/gap accounting, **not** a Phase 7/8 approval entry-point test. |

Additional coverage must be cited rather than falsely assigning it to 137–143: TAP 29/30 cover service `requireFeatureAuthorized`, `initializeFeature`, `executeFeature` on a constructed disabled service; TAP 61/63 cover direct invocation without service initialization; TAP 62/64 cover expiry/removal after valid direct setup; TAP 65/66 cover post-setup revocation and formatting resistance. Positive controls other than TAP 59 substitute crypto in isolated test processes and are not real approvals under the compiled corporate pin.

## Outstanding proofs / reviewer decision inputs

1. Attach/authenticate the real SOC-signed ticket; bootstrap pin fingerprint correctness alone is insufficient.
2. Decide/remediate missing-list fail-open policy if fail-closed is required, and add the missing-file regression.
3. Decide whether trusted directory injection/cwd-relative defaults meet policy; immutable absolute trust paths are not implemented.
4. Implement and independently audit future actual capture/public MCP routing before claiming universal privileged-tool coverage.
5. Accept the actual same-parsed-artifact canonical digest semantics or request a specified alternative; do not claim Buffer identity.
6. Accept/document the five-file evidence-only Y delta or require a new exact TAP-only provenance pair.

No release, merge, rollout, authenticated SOC authorization, or full trust-boundary closure is asserted by this response.
