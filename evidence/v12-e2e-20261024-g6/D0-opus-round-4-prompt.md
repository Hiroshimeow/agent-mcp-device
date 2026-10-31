D0 review round 4 — convergence round. Continue the same verified Opus 5.5 thread. Attachment v3 contains byte-exact copies of 10 critical G6 files; SHA-256 was verified equal on G6 and FJP. Please disregard truncation/transcription concerns from round 3 for these files.

Focus only on unresolved points and be willing to disagree.

1. Multi-runtime Skill semantics. The Skill lives in user agent homes and package postinstall has no runtime-root identity. PluginHost state is per runtime root, and one machine may have multiple runtimes. Reconsider your proposal to remove/install the global Skill whenever one runtime is disabled/uninstalled. Would it be more correct to keep package-owned Skill discovery while making CLI/status runtime-aware and ensuring disabled/uninstalled targets return an actionable limitation? Use the SPEC wording: disabled/uninstalled Palace must not leave active guidance *claiming Palace is callable*, and S3 expects disabled plugin to return an actionable limitation. Define the correct ownership boundary.

2. "Independent installable" does not necessarily mean independent release cadence/version numbering. Do not require a separate Palace version cadence unless the specification actually requires it. What independence is mandatory: artifact/package install/remove, dependency closure, PluginHost registration, CLI/Skill lifecycle, data preservation, and no implementation fork.

3. Live mutation. Inspect createPlatformDeviceCore and platform CLI exactly. Generic platform.invoke can route capabilities through PluginHost while direct knowledge.* advertisement is hidden by default. Decide:
   - whether this existing generic path satisfies the SPEC's "CLI or existing generic plugin host" allowance;
   - whether allowing knowledge.* through generic platform.invoke violates the default-tool-catalog rule or is an intended generic escape hatch;
   - whether a CLI write route is D0-required or only conditional after S2 E2E.
Do not propose a new transport unless existing mechanisms cannot satisfy the acceptance behavior.

4. Cancellation. The process child protocol already has a cancel method and AbortControllers, while ProcessDriver's outer abort currently calls fail(), killing/faulting the child. Is the minimal mature fix: send a bounded cancel frame first, allow cooperative cancellation, then terminate/fault only on cancel deadline or unresponsive child? Compare with current safety guarantees for a synchronously hung plugin.

5. Registry stale-lock race. Re-evaluate exact save() code. If the race is real, specify the smallest correctness fix, preferably reusing the recovery-token/lock technique already present in runtime-lease rather than adding a new lock subsystem.

6. Wrong-schema handling. PalaceStore performs DDL before checking meta.schema. The SPEC explicitly requires wrong-schema handling. Decide whether this is a current acceptance defect even though schema 2 does not yet exist, and the minimal fix/test.

7. CLI retrieval. Confirm or reject the >300 candidate truncation mismatch from exact CLI/store source. If real, specify canonical behavior to reuse rather than a custom ranking approximation.

8. Standalone package. Distinguish:
   - package dependency/import closure;
   - ability to install its Skill;
   - ability to register as a plugin into an existing Device PluginHost;
   - ability to operate without Device runtime.
The architecture says Palace is an optional plugin and no Palace service should be created. Do not invent a standalone daemon requirement unless the spec requires it.

9. Inspect platform-cli defaults: server state defaults to ~/.mcp-device/server, Palace CLI also defaults there, while knowledgeCli currently calls stateRoot(args) without serverDefault=true. Determine whether this is a real default-path inconsistency and how it affects acceptance.

10. Final output must separate:
   A) D0 architecture/design consensus,
   B) concrete implementation blockers to fix before D1,
   C) evidence deferred to D1/D2/D3,
   D) any remaining disagreement.
Give an explicit D0 gate verdict. D0 can accept a design while release remains blocked; do not conflate D0 signoff with RELEASE_READY.