# Context Policy Profile v1 — proposed default

**Purpose**: numeric defaults needed for implementation/acceptance. Values are product defaults for feature 002, configurable downward/upward by local owner within hard safety ceilings. No automatic deletion of source events is implied.

## Storage quotas

| Dimension | Default | Hard behavior |
| --- | ---: | --- |
| Repo stores per active owner namespace | 256 | New resolved repo beyond cap uses minimal unscoped/quota record; no new evidence store until owner cleans/configures. |
| Total context bytes per owner | 8 GiB | Stop new payload/derived writes before source-event reserve is consumed; warn/degrade. |
| Total context bytes per repo | 2 GiB | Same; no silent eviction of old source events. |
| Source-event metadata reserve per repo | 128 MiB | Reserved from payload/derived growth. If reserve exhausted, capture gap becomes possible and must be counted. |
| Retained payload per single event | 4 MiB | Larger output becomes partial with original-size-known/hash/range metadata when available. |
| Blob chunk | 1 MiB | Content-addressed retained bytes after redaction. |
| Active modifying index job | 1 per repo | Additional write job = BUSY/idempotent same-job response. |
| Active context jobs | 4 per owner | Beyond = BUSY. |

No default age TTL for committed event metadata in 002. Payload is not automatically age-pruned either; quota pressure degrades **new** payload/index capture rather than deleting old evidence. Explicit local owner-admin cleanup can be designed later.

Derived FTS/activity tables are rebuildable, but 002 still does not silently delete them under quota; it may pause sync and report `BUDGET_EXCEEDED`.

## Capture timing / SQLite contention

- Built-in node:sqlite, WAL.
- Capture pre-intent DB busy wait budget: 5 ms.
- Capture outcome update busy wait budget: 10 ms.
- Maintenance DB acquisition attempt: up to 100 ms; then yield/backoff or return BUSY according to job budget.
- No source IO, parsing, compression of large payload, network or provider call while holding SQLite write transaction.
- Capture priority over maintenance.
- Process-crash semantics are contract; power-loss durability is measured/documented separately according to chosen `PRAGMA synchronous`. Default implementation candidate is WAL + `synchronous=NORMAL` only if acceptance explicitly records that recent committed transactions may be lost on power failure; use `FULL` if power-loss durability becomes a required guarantee.

## Search/read budgets

| Operation | Default | Hard maximum |
| --- | ---: | ---: |
| search hits | 8 | 50 |
| search response UTF-8 bytes | 32 KiB | 128 KiB |
| read refs per call | 8 | 20 |
| read aggregate returned bytes | 256 KiB | 1 MiB |
| cursor lifetime | 10 min | 30 min |

Continuation is required when retained data remains but response budget truncates it.

## Graph budgets

| Dimension | Default | Hard max |
| --- | ---: | ---: |
| hops | 2 | 4 |
| returned nodes | 50 | 200 |
| examined edges | 500 | 2,000 |
| visited nodes | 200 | 1,000 |
| graph response | 64 KiB | 128 KiB |
| wall-time budget | 25 ms | 100 ms |

The engine must stop on whichever bound is reached first and return examined/visited/truncated_by. A SQL LIMIT after unbounded recursion is not compliance.

## Index maintenance

- `sync` default source scope: retained pending events for current repo; no tracked-file source scan in first increment.
- Foreground offline maintenance budget: 2 s default, 10 s hard. Exceeding it returns a job/limit error; no hidden persistent worker.
- `rebuild` operates on retained event evidence only in 002; no source-code parser scan.
- No idle/startup/per-tool auto-sync.

## Retrieval quality

Frozen corpus before tuning:
- exact path/identifier relevant result top-3: 100%;
- error/command/natural-language history Recall@8: >=0.90 overall;
- unauthorized cross-scope results: 0.

Performance samples failing correctness are excluded as invalid evidence, not counted as fast successes.

## Schema/token budget

Public MCP catalog target after adding six tools: <=10,000 estimated schema tokens using the gateway's existing estimate method. If exceeded:
1. first reduce duplicated descriptions and unnecessary fields;
2. do not merge read/write tools just to save tokens if it weakens annotations;
3. owner must explicitly approve any larger catalog before rollout.

## Degraded-state policy

Storage/quota/lock failure never triggers automatic side-effect replay.

Surface:
- pending events;
- capture gap count/reason;
- payload omitted/partial/redacted;
- index paused/quota exceeded;
- last-good generation;
- storage health.

No response may claim `coverage.complete=true` when a known gap exists within requested scope/time window.
