1s 間の推論
D0 Review, Round 6: Final Correction

D0 VERDICT: PASS. NO MATERIAL D0 DISAGREEMENT. I accept all six corrections, and I choose packaging option A. The release stays RELEASE_BLOCKED_WITH_EVIDENCE. The implementation blockers and later-gate evidence below are listed apart from the architecture sign-off.

Corrections 1–6

1. E-0: CLOSED.

A deviceStore present means durableAuth is true.
requireAccountOwnership !== false means ownership is enforced by default, and startServerRuntime does not override it.
server-e2e.test.mjs runs Alice/Bob through the real server path and asserts the Core invocation count does not change.

That is sufficient D0 evidence. The e2e test stays in the regression suite.

2. Legacy metadata leak: WITHDRAWN. The trusted context uses listDevices({ accountId: context.accountId }). The argument-less call I relied on came from transcription loss, not from the source. I can't cite another path that enumerates devices without the account.

3. Relink semantics: ACCEPTED, and the quarantine requirement is WITHDRAWN.

I can't cite any contract that requires local state to be sanitized when ownership transfers. My round-5 position was a preference, not a requirement.
The documents you cite support your model:
Palace SQLite is Device-local runtime state.
Federation access is scoped to the current owner by the broker and router.
A deliberate transfer hands over all local state, including persisted imports, just as it hands over file and shell access.
What remains is documentation plus a D1 test that records the semantics, not a design change.
The test asserts: the old owner can't call the Device; the new owner can't reach the old owner's other Devices, including by replaying a reference minted with the persisted knowledge-reference.key (it must fail at callDevice); local cards, including imports, remain readable on the transferred Device as documented; and an ownerless Device dispatches nothing.

4. Bin collision: the experiment confirms it is real. I reject my own option C (§ Packaging decision below).

5. Scripts: ACCEPTED. The experiment shows Device's postinstall ran and created both Skill targets despite the allow-scripts warning. Any inference that scripts were blocked is withdrawn. --ignore-scripts (or scripts blocked by policy) stays a required recovery scenario with its own test: install with scripts disabled, then confirm that palace status reports the missing Skill and that the documented repair or Device-start reconcile restores it.

6. SKILL.md: AGREED. The required changes are: run palace status first, report disabled/uninstalled as an actionable limitation, remove the source-checkout fallback, and say plainly when only candidates exist. The Skill must never stop the runtime. My round-5 D6.4 wording already met this: it documented operator-initiated stopped-runtime mutation and said not to stop the runtime unless the user asks. That wording stays documentation only.

Packaging decision: A
Criterion	A: Device keeps palace; standalone owns it elsewhere	B: one canonical package owns the bin	C: drop Device bin, add mcp-device palace
§2.3 stable commands palace status/search/read/skills	✅	✅ only if achievable	❌ breaks the stable command
S1 default install from main package	✅	❌ (see below)	⚠ changes UX
Standalone independently installable/removable	✅ (no Device, or a separate prefix)	✅	✅
Mature mechanism	Plain npm bin ownership	None found	Plain, but it violates the contract

Why B fails: npm only links bins of the top-level package in a global install. Bins of dependencies (regular, optional or bundleDependencies) are not linked onto the global PATH [npm behavior; I know of no exception]. Getting the transitive Palace bin onto PATH would need a nested install or a postinstall that writes shims, which are exactly the hacks you excluded. It would also break offline cold install. Rejected unless someone shows a counterexample.

Why A satisfies the spec: the spec requires the standalone package to be installable and removable independently. It does not require both root packages to be global in the same prefix. Two packages cannot own one command name, and npm's EEXIST is the correct refusal.

A is accepted only together with these obligations (they are blockers, not design questions):

Same-prefix conflict test: install standalone into a prefix that already has Device. It must exit non-zero, leave the prefix byte-identical (no partial node_modules/@hcu-lab.me/palace, and Device's palace, palace.cmd and palace.ps1 unchanged), and leave Device's palace status working.
Documentation: same-prefix co-install is unsupported; --force is unsupported; and if Device is installed, Palace is already provided.
Separate-prefix lifecycles: test install, uninstall, reinstall and upgrade of each package in its own prefix, plus a manual PluginHost registration from the standalone prefix (installationSource:'manual', which is B8).
palace status identifies itself: package name, version and install path, along with the runtime state it reads. With two prefixes, PATH order decides which palace runs, and that must be visible.
Skill ownership with multiple owners (B1) is still needed. Agent skill homes are per-user, not per-prefix, so Device in prefix X and standalone in prefix Y both target the same Skill directories. This is the one reason the "owners" record remains.
Final D0 gate

D0 Architecture: PASS. NO MATERIAL D0 DISAGREEMENT.

Implementation blockers before D1:

Unchanged: B1 through B10 and B12.
B1: Skill ownership record with multiple owners, copy by default, three-way hash, staged rename, recovery.
B2: runtime-aware CLI and state-coded errors.
B3: default root.
B4: schema check before DDL.
B5: shared searchCards.
B6: cancel, grace period, then kill.
B7: registry lock token.
B8: provenance set by the command.
B9: version-only re-pin, plus --bundled.
B10: standalone LICENSE, import closure and manifest.
B12: SKILL.md wording.
B11 replaced by A obligations 1–4.
E-0: closed.

D1 evidence:

S2 agent end-to-end run (this is the trigger for live mutation).
Validation runner contract, including automatic learns from logs.
Relink transfer-semantics test.
Negative test that the default catalog cannot reach platform.invoke/knowledge.*.
Pi/Codex Skill discovery.
Install with scripts disabled.
Whether a RuntimeOwner listener exists in server mode (only needed if the trigger fires).

D2: fault matrix, upgrade/rollback with real data (including a crash during restore), lease races, disposition of the 6 FAIL and 2 no-op parity rows.

D3 / release: S5 provider token A/B after B5, 24-hour soak, publish.

Remaining disagreements: none at the architecture level. Not release-ready.