# Checkpoint 2 Opus R1/R2 follow-up

Worktree: `E:/git-project/wt-mcp-device-111-context`.
Runtime: Windows x64, Node 22.22.2, SQLite 3.51.2.
Scope: targeted review follow-up only; no release, public tools or live capture enablement.

## Implementation and decisions

- R1/B2: exact repository-specific terminal confirmation is now `PURGE <selected repository UUID>`, with exact equality (no trimming). Known agent environment markers are defense-in-depth, not proof of human identity. Accepted marker-stripping residual risk and out-of-band authorization exclusion are recorded in `decisions.md`.
- R2/B3: inspection confirmed the prior checkpoint already uses the **exact same registry `BEGIN IMMEDIATE` writer lock** for reconciliation, admission and purge. Admission holds the transaction over the whole repository action, so no independent committed reservation can be wiped by reconciliation. Keep this simpler architecture rather than add reservation tables. Added source documentation and concurrent-process evidence.
- B1: inspection confirmed writable connections already enable `PRAGMA secure_delete=ON`. Added a migrated v2 `auto_vacuum=NONE` database regression with indexed payload, positive raw-byte control, post-purge raw main-file byte scan, reusable pages and zero logical quota. Event/evidence tombstone metadata deliberately remains.

## Exact executed subtest mapping

All entries below are in `test/context/review-blockers.test.js` and appear verbatim in the spec/TAP artifacts.

| Finding | Exact subtest name |
| --- | --- |
| B1 bounded policy | `B1 maintenance uses incremental reclamation, never full VACUUM or WAL truncate` |
| B1 writer blocks purge | `B1 concurrent purge waits for an active writer and preserves every event` |
| B1 purge blocks writer | `B1 capture writer waits for purge lock release with zero lost events` |
| R1 marked TTY refusal | `B2 admin purge rejects agent environments even with TTY input and output` |
| R1 stripped markers, generic answer refused | `B2 stripped agent markers in TTY-capable child rejects generic PURGE` |
| R1 exact whitespace check | `B2 stripped agent markers in TTY-capable child rejects repository challenge with extra whitespace` |
| R1 residual risk demonstrated | `B2 stripped agent markers in TTY-capable child accepts exact repository challenge with documented residual risk` |
| R2 crash reconciliation | `B3 killed cross-database writer reconciles exact committed evidence bytes on restart` |
| R2 concurrent admission, sealed totals, no overcommit | `B3 reconciliation waits for a separate-process admission and retains sealed evidence totals` |
| B1 migrated NONE / secure deletion / quota | `B1 migrated auto-vacuum NONE purge clears indexed payload bytes and logical quota without rebuilding` |

The writer/purge and reconciliation tests use `fork()` with `fixtures/maintenance-worker.js`: separate OS processes, registry admission lock held while repository evidence is uncommitted. After writer completion the reconciliation tally is exactly 129 bytes, including 6 sealed bytes; active evidence count is 21. Lowering total quota to current physical usage rejects the next append and leaves logical usage unchanged.

## Reporting correction

There is no `test/context/status.test.js` in this worktree. Executed TAP inventory check found **97 subtest names, 97 unique, zero duplicates**. The three marker-stripping cases have unique descriptive names. Current TAP entries 90–92 are respectively:

- `portable skill freezes search-first and selective-maintenance behavior`
- `portable skill forbids sandbox bypass and sealed namespace auto-selection`
- `portable skill mentions only commands and flags covered by the CLI contract`

No speculative renaming of already-unique tests was made. Earlier evidence snapshots are preserved rather than rewritten.

## Exact verification artifacts

All commands exited 0:

1. `npm run build` — complete output: `checkpoint2-opus-build.txt`.
2. `node --test test/context/*.test.js` — complete output: `checkpoint2-opus.tap`.
3. `node --test --test-reporter=spec test/context/*.test.js` — verbatim complete output, every subtest name: `checkpoint2-opus-spec.txt`.

TAP summary:

```text
1..97
# tests 97
# suites 0
# pass 97
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 18947.5442
```

Spec summary:

```text
tests 97
suites 0
pass 97
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 13933.6683
```

Red/green: the three new CLI confirmation cases failed against the previous generic prompt; after repository-specific confirmation, targeted suite passed 13/13. The new B1/B3 tests passed against existing checkpoint implementations and verify their existing guarantees rather than falsely claiming a new production fix.

## Explicit limits retained

- Marker-stripping tests execute the actual child-process readline prompt with TTY-capable stream properties; **native Windows ConPTY integration was not run**. This verifies CLI behavior for the PTY-visible TTY branch, not a native PTY transport harness.
- Raw-byte erasure evidence covers the main SQLite file after PASSIVE checkpoint, not historical WAL frames, backups, snapshots or disk remanence. No unsafe WAL truncation/full VACUUM is introduced.
- Node emits its expected SQLite ExperimentalWarning; it is retained in the exact logs, not hidden.
- No live-capture enablement, Linux/Node-floor verification or final reviewer approval is inferred.
