D0 review round 6 — final correction before recording consensus. Same Opus 5.5 thread. This is intentionally narrow.

1) Your Round-5 E-0 is now source-proven, not merely a fixture assumption:
- authenticated-mcp-wrapper.mjs constructs createDeviceBroker({ deviceStore, pairingStore, usageStore, ... }) in the real startServerRuntime path.
- device-broker.mjs sets durableAuth = Boolean(deviceStore) and requireAccountOwnership = options.requireAccountOwnership !== false.
- startServerRuntime does not set requireAccountOwnership false.
- test/v12/server-e2e.test.mjs runs the real authenticated server path with Alice/Bob and asserts cross-owner calls fail before the remote Core invocation count changes.
Therefore E-0 should be CLOSED as D0 evidence (still retain regression coverage).

2) Your legacy enumeration concern is also source-disproved. authenticated-mcp-wrapper.mjs creates extension trustedContext with:
listDevices: () => deviceBroker.listDevices({ accountId: context.accountId })
not listDevices() without accountId. So capability.list/knowledge router enumerate only that account. Please withdraw the legacy metadata-leak concern unless you can cite another actual path.

3) Relink semantics: docs/v12-platform.md says plugin private data is part of the Device runtime state root and local knowledge CLI works before account pairing. ACCEPTANCE.md says federation references are account-scoped. I interpret this as:
- Palace SQLite is Device-local state.
- federation access is scoped to current owner account by broker/router;
- deliberate Device ownership transfer transfers its local state, including persisted imports, just as the new owner receives authorized file/shell access to the same Device.
This is not silent simultaneous cross-account sharing. Document this transfer semantic and test it; do not invent per-account SQLite partitioning unless a source requirement says ownership transfer must sanitize local state.
If you still believe imported cards require quarantine, cite the contract that requires that rather than the safer-sounding preference.

4) Actual npm experiment on G6 with the exact accepted test artifacts, isolated prefix:
- install @hcu-lab.me/mcp-device@1.0.12: exit 0; palace/palace.cmd/palace.ps1 created.
- then install @hcu-lab.me/palace@1.0.12 into the SAME prefix: npm EEXIST on prefix\palace.ps1; standalone install exit 1.
So the collision is real.
However your proposed fix "remove bin.palace from Device and use mcp-device palace" conflicts with the frozen contract unless another mechanism preserves the stable primary palace CLI: §2.3 says minimum stable commands already implemented are "palace status/search/read/skills", §2.2 says CLI-first, and S1 requires default installation from main package. There is currently no mcp-device palace subcommand.
Reassess the requirement before changing UX. The spec requires the standalone package to be independently installable/removable; it does NOT explicitly require both root packages to be globally installed into the same npm prefix simultaneously.
Compare:
A) Keep palace bin in Device for default UX; standalone owns palace in standalone/separate-prefix installs; same-prefix co-install is explicitly unsupported because two packages cannot own one command. Manual standalone PluginHost override can come from another prefix. Test both independent lifecycles plus conflict fails cleanly.
B) Refactor packaging so one canonical Palace package owns the binary even for the default Device distribution, but only if you can show a mature npm-compatible mechanism that installs the transitive/default Palace bin globally/offline without nested npm hacks and without breaking main-package cold install.
C) Your prior "remove Device bin + invent mcp-device palace" substitute.
Judge by acceptance criteria and UX, not by ease. Do not require same-prefix co-install unless the spec requires it.

5) npm emitted an allow-scripts warning in that experiment, but the Device postinstall DID run and created both Skill targets. Withdraw any inference that this experiment proved scripts were blocked. --ignore-scripts/blocked scripts remain a required recovery scenario from the SPEC, but need a dedicated test.

6) SKILL.md wording changes should preserve operational truth without adding a lifecycle engine. "palace status first", clear disabled/uninstalled limitation, no source-checkout fallback, and candidate-only honesty are agreed. Do not require the Skill to stop the runtime itself.

Please return:
- explicit correction/acceptance for 1–6;
- final packaging choice A/B/C or a better mature-reference option, with why it satisfies the exact spec;
- final D0 verdict;
- remaining disagreements, if any.
If architecture is fully converged, state "NO MATERIAL D0 DISAGREEMENT" and keep implementation/evidence blockers separate from architecture signoff.