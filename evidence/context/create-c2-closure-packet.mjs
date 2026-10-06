import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const files = ['src/context/store.ts', 'src/context/service.ts', 'src/context/sqlite.d.ts', 'test/context/c2-closure.test.js', 'test/context/review-blockers.test.js'];
const tap = readFileSync('raw-tap.txt', 'utf8');
const summary = tap.slice(tap.lastIndexOf('\n1..')).trim();
const status = git('status', '--porcelain');
const head = git('rev-parse', 'HEAD').trim();
const runtime = execFileSync(process.execPath, ['--version'], { encoding: 'utf8' }).trim();
const fence = readFileSync(files[0], 'utf8');
const service = readFileSync(files[1], 'utf8');
const packet = `# v1.0.11 C2-1 through C2-6 closure evidence

Worktree: E:/git-project/wt-mcp-device-111-context. Verification executed in bash on Windows.
Pre-delivery HEAD: ${head}. Node: ${runtime}.
The delivery commit is the commit containing this packet (its own hash cannot be embedded without changing it).
No release, version bump, fleet deployment or SOC authorization was performed; package metadata remains 1.0.10.

## Finding-by-finding implementation

### C2-3: reaping and admission reconciliation
Under registry BEGIN IMMEDIATE, expired/dead leases bump epoch_counter before DELETE FROM reservations. Deletion cascades to reservation_epochs. The late-worker test resumes the exact reaped token while holding both transactions and expects RESERVATION_FENCED_OFF before repo COMMIT, with no retained evidence and exact quota after the next append. There need not be a replacement admission to revoke the worker.
Automatic reconciliation already preceded every quota allocation decision; retained that stronger unconditional trigger and added a regression proving a dead allocation larger than available quota is reclaimed automatically, then genuine exhaustion still throws QUOTA_EXCEEDED.

### C2-2: single writer and watermark
Formal invariant: each repository has at most one active writer lease. Admission checks for an existing living lease under registry BEGIN IMMEDIATE and refuses BUSY before allocating. The durable reservation/reacquisition gap therefore cannot admit another writer. Registry-first writer lock is held through repo COMMIT and quota finalization.
All production repository writes begin BEGIN IMMEDIATE. commitRepository additionally rejects calls without an active registry and repository transaction, preventing autocommit watermark mutation. The predicate check and update are one conditional UPDATE in the same repo transaction as evidence, followed by COMMIT. Out-of-order test commits epoch 2 and attempts epoch 1; it deliberately makes the old registry epoch current so the repository watermark independently rejects the old writer and remains unchanged.
Separate SQLite files are not a distributed atomic transaction; existing crash recovery and PID/expiry reconciliation remain mandatory and tested.

### C2-1: positive controls and secure deletion
The migrated auto_vacuum=NONE regression checks secure_delete=1, canary bytes PRESENT in main SQLite before purge, positive FTS vocabulary controls, and bytes ABSENT after purge in main DB, WAL, SHM and all five FTS shadow tables. Both pre-control and post-purge wal_checkpoint(TRUNCATE) assert busy === 0. Existing blocked-checkpoint test proves PURGE_CHECKPOINT_BUSY fails closed. Existing reservation-liveness tests cover secure_delete on registry, writable, read-only, unscoped and CLI-style handles.
Scanned ASCII fragment byte lengths (also emitted verbatim in raw TAP): full tokens canarytokenprefixalphaunique=27 and canarytokenprefixbetaunique=26; prefix canarytokenprefix=16; suffixes alphaunique=11 and betaunique=10; partial fragments canarytoken=11, tokenprefix=11, alphauniq=9, betauniq=8. Every fragment has a positive raw-byte control before purge.

### C2-5/6: hard approval boundary
FEATURE_LIVE_CAPTURE and FEATURE_PUBLIC_GATEWAY default false in src/context/service.ts. Constructor validates explicit true flags; initializeFeature and executeFeature refuse absent, malformed, expired, tampered, untrusted or wrong-scope approval with:
FEATURE_GATE_LOCKED: Phase 7/8 requires valid SOC security approval artifact
Default artifact location is config/soc-approval.json. Trusted local runtime may configure the directory; no agent tool can configure it. Approval requires an out-of-band pinned Ed25519 SOC public key; an artifact cannot introduce its own trust anchor. Signed UTF-8 bytes are JSON.stringify({schema_version:1,features:[...],expires_at:<integer>}) in that exact field order. signature is canonical base64 of a 64-byte Ed25519 signature. File size is limited to 16 KiB. Execution rechecks approval so removal/expiry/tampering revokes it.
Tests use ephemeral generated test keys, not production approvals. No signed production approval was created or committed. This introduces mandatory service initialization/execution boundaries for Phase 7/8; no actual live-capture hooks, public routes or new MCP tools exist or are enabled in this patch. Future Phase 7/8 implementation must use these boundaries; this is not a claim to have implemented Phase 7/8.

## C2-4: exact execution and evidence

Both requested commands exited 0:
- npm run build (complete output: evidence/context/c2-build.txt)
- node --test test/context/*.test.js > raw-tap.txt 2>&1 (complete combined output: raw-tap.txt)

Node's experimental SQLite warning is retained in TAP; it is not a test failure.
Initial red run: evidence/context/c2-red-tap.txt, 9 tests, 2 pass and 7 fail (epoch bump, second writer, transaction check, missing feature gate). Automatic reconciliation and historic out-of-order defense already passed. Initial targeted green run is evidence/context/c2-targeted-tap.txt; the final full suite below includes the tightened independent watermark and valid-transaction late-worker tests.

\`\`\`text
${summary}
\`\`\`

### Actual pre-delivery git status --porcelain
\`\`\`text
${status}\`\`\`
This is an intentionally dirty pre-delivery snapshot, not a claimed clean post-commit state. Post-commit HEAD/status are reported in the delivery response.

## Exact code snippets

### Store commit boundary
\`\`\`typescript
${fence.slice(fence.indexOf('  commitRepository('), fence.indexOf('\n  constructor('))}
\`\`\`

### Phase 7/8 boundary
\`\`\`typescript
${service.slice(service.indexOf('export const FEATURE_LIVE_CAPTURE'), service.indexOf('\ninterface Job'))}
${service.slice(service.indexOf('  constructor('), service.indexOf('\n  graph('))}
\`\`\`

## Actual implementation and regression diff

The following is the exact staged git diff for the five implementation/test files (not a reconstructed patch).

\`\`\`diff
${git('diff', '--cached', '--', ...files)}\`\`\`
`;
writeFileSync('evidence/context/c2-closure-review-packet.md', packet);
writeFileSync('evidence/context/c2-environment.txt', `git rev-parse HEAD\n${head}\nnode --version\n${runtime}\ngit status --porcelain (pre-delivery)\n${status}`);
