D0 review round 2. Continue the same thread. Reassess round 1 using these newly inspected source facts. Be adversarial to both your prior design and the implementer's design; do not converge unless evidence supports it.

1) The specification does not categorically require live mutation. It says live owner-routed mutation OR stopped-runtime mutation under the existing exclusive lease may be used if the latter is sufficient for the acceptance workflow. Therefore classify "live mutation" as a hard blocker only if you can identify a required end-to-end user workflow that cannot meet acceptance with the stopped-runtime path.

2) Correction: provider-measured token A/B improvement is a mandatory release gate in S5. Removing a public token-savings claim does not remove this gate.

3) Existing implementation is richer than round 1 assumed:
- src/platform/plugin-host.ts already persists plugin installation source, enabled/disabled/uninstalled/faulted state, serializes lifecycle changes, uses revisioned registry writes, performs explicit upgrade with data backup and rollback, supports migration hooks through the isolated plugin child, and keeps native Device Core usable if Palace startup fails.
- src/device/runtime-owner.ts already has a local OS control channel used for runtime ownership/status/controlled shutdown.
- src/platform/runtime-lease.ts already prevents stopped-runtime maintenance from racing an active Device.
- Palace's standalone CLI opens SQLite read-only, checks schema=1, and does not use immutable mode.
- The distribution still has unresolved Palace data schema/rollback acceptance evidence; do not infer it is solved merely because generic hooks exist.

4) Skill installer remains genuinely incomplete. It links the agent skill directly to package files when possible, otherwise copies with a legacy ownership marker. The current safety fix preserves modified/extra user files, but package relocation can leave a dangling link; old-version copied skills cannot be safely recognized as pristine; disable/uninstall/reinstall ownership is incomplete; no interrupted-update recovery exists.

5) Standalone Palace package copies the same compiled implementation rather than a fork. Its current tarball omits LICENSE despite MIT metadata.

6) Native parity evidence is stronger than round 1 wording but still incomplete: a frozen original v11 comparator passes 14 output families and 4 side-effect families. Separate legacy exported parity has six failures shared by original v11 and v12 and two no-op rows. This is not sufficient to declare full parity.

Please provide:
A. Explicit corrections to any round-1 conclusions that were too strong or wrong.
B. Revised D0 PASS/AMEND/BLOCK for Skill lifecycle, standalone packaging, plugin lifecycle/fault isolation, SQLite owner/mutation policy, parity evidence, licensing, and release status.
C. For Skill lifecycle, compare the minimal fully-correct design against your heavier generation/journal design. State which mechanisms are strictly necessary for correctness and which are optional hardening.
D. For live mutation, compare reuse of existing runtime/plugin control mechanisms against adding a new Palace-specific channel. Prefer reuse unless correctness cannot be met. Do not propose a Palace MCP service.
E. List exact remaining source/evidence needed before D0 can be considered agreed.
F. State remaining disagreements clearly.