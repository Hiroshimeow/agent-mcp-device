# Checkpoint 3 / Phase 9 native Linux rerun

## Source and installation

- Source worktree: `E:/git-project/wt-mcp-device-111-context`, clean at `0c0a806406e432181915425a4ccaba85dfc17dff` before execution.
- A native `/usr/bin/git clone --no-hardlinks --no-checkout` of the shared repository was checked out at that exact source SHA on Linux ext4 at `/home/ayumi/test-mcp-context-build`. This is the committed source of the clean worktree, not a Windows dependency installation.
- `node_modules` and `dist` were removed before `npm ci`. No Windows-built modules or dist were copied. Native `/usr/bin/node` v22.21.0 and `/usr/bin/npm` 11.6.3 were used. `npm ci` installed 635 packages and invoked prepare; an explicit `npm run build` then also exited 0.
- `phase9-linux-native-sharp.txt` captures the installed sharp resolution and native library versions. No extra sharp installation was required.
- All test and benchmark commands exited 0. Raw stdout/stderr were copied to `evidence/context/` in the same Linux invocation and compared byte-for-byte with `cmp`.
- An earlier successful `/tmp/test-mcp-context-build` run was not retained because WSL cleared `/tmp` between invocations. The committed evidence comes exclusively from the repeated persistent home-filesystem run, not from that discarded run.

## Results and caveats

The raw TAP footer is preserved in `phase9-linux-native-context.tap` and extracted in `phase9-linux-native-footers.txt`: exactly 198 tests, 198 pass, zero failures/cancellations/skips/todos. Duration: 34936.522587 ms.

The benchmark produced 15 samples (three per capture/sync/search/activity/contention scenario), all valid, with zero invalid samples. Raw JSONL, generated summary, stdout and stderr are retained. The SQLite experimental warning is expected on Node 22 and is not a test or benchmark failure.

The benchmark reports `git_dirty: true` because the environment/install/build/TAP output files were created as untracked files in the clone before benchmark environment capture, not because source code was edited. `harness_commit` is the tested source SHA above; `baseline_commit` is the benchmark harness's historical baseline, not the tested source. No source or lockfile changes were applied. Installation reported 14 dependency audit vulnerabilities (2 moderate, 12 high); no dependency remediation was attempted in this evidence-only task.

## Evidence-only provenance and attributes

Previous evidence commit (`git rev-parse HEAD` before this task):

```
0c0a806406e432181915425a4ccaba85dfc17dff
```

Checkpoint 3 base (`git rev-parse f58b95a`):

```
f58b95ae1c1be735f3f9601d8a8695e445a8b101
```

The `.gitattributes` diff in `f58b95a` adds only:

```
# Checkpoint 3 raw output and hash manifest remain byte-identical.
/evidence/context/checkpoint3-* -text -whitespace
```

That addition applies only under `evidence/context/` and disables text/EOL normalization for raw evidence; it does not alter code, dependencies, or execution behavior. The pre-existing phase9 rule likewise covers `/evidence/context/phase9-*`. The whole file also has an older `/raw-tap.txt -text` rule; the claim of evidence-only scope refers specifically to the Checkpoint 3 addition, not every historical attribute. This task does not change `.gitattributes`.

The new evidence commit SHA and the final `git diff --stat f58b95a..HEAD` are returned externally after committing (a commit cannot embed its own final SHA). Both appended manifests include SHA-256 lines for every new native artifact, including raw footers, and are byte-verified against the committed blobs before completion.
