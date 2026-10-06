# Full context test inventory

Actual command: node --test test/context/*.test.js

1. frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
2. re-pair seals old namespace; refs and cursors never authorize another scope
3. read cursor binds repository scope and sealed state
4. durable cursor signature protects generation, query, expiry and position
5. sandbox denial is propagated once, without Git or alternate-path fallback
6. explicit sync constructs directed evidence-backed relations without causal inference
7. graph shares opaque entity identities but never persists metadata secrets
8. checkpoint separates observed Git metadata from reported summary and refs
9. checkpoint claims remain reported after indexing and search
10. checkpoint redacts reported secrets without breaking structured evidence
11. checkpoint rejects unknown evidence refs without fabricating checkpoint evidence
12. CLI search/read/status preserve ContextService JSON semantics with gateway offline
13. CLI keeps inaccessible local state typed and redacted without remote bypass
14. CLI ACCESS_DENIED remains local and uses the stable access exit code
15. CLI executable emits JSON, human output, and safe usage errors
16. CLI paginates search and read and explicitly syncs/rebuilds without source mutation
17. read-only CLI leaves persisted databases unchanged and reports safe accounting
18. CLI scope failure and sealed namespace cannot fall back
19. CLI rejects caller-controlled device/account/store selectors and exposes only contracted commands
20. device quota serializes all repos and includes sealed namespaces, without evicting evidence
21. repo quota pauses sync and import without publishing partial generations
22. transaction failure rolls back evidence and event together
23. restart abandons shadow generations and marks unresolved intents unknown without sync
24. process kill rolls back uncommitted WAL writes and preserves last-good generation
25. cleanup invalidates stateless search cursors and supports explicit sealed namespace selection
26. admin clean CLI refuses non-TTY input and cannot accept agent confirmation flags
27. explicit local admin payload purge reclaims quota and leaves metadata and content-free audit
28. fresh status creates no repo database; unknown intent and wrong job scope are visible
29. migration rejects a newer schema without replacing it and publication rejects invalid watermarks
30. symlink sandbox escape is denied on its canonical target
31. graph CLI is read-only domain parity and search optionally returns bounded related refs
32. high-degree traversal enforces examined, visited, node, depth and aggregate byte caps
33. cycles terminate and path, direction, relation filtering and timeline are deterministic
34. generation, retention, repository and sealed-owner boundaries are enforced before graph lookup
35. JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
36. legacy id wins over changed content, and excluded paths never persist payloads
37. scoped foreground jobs reject overlap, cancel safely and keep sync idempotent
38. startup, read, search, graph, status and idle never materialize pending evidence
39. sync indexes only pending retained events and advances watermark without copying old rows
40. test\\context\\policy-contract.test.js
41. Vietnamese and emoji byte-budget pages preserve code points and byte offsets
42. evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
43. secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
44. import deduplicates redacted content and indexes only redacted text
45. secret markers use keyed tags, never offline-guessable plain hashes
46. UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
47. excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
48. Git roots, worktrees, separate clones and nested repositories
49. non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
50. v1 repo migration preserves evidence and installs incremental retrieval schema
51. v2 migration adds snapshot tombstones and folds existing redacted FTS content
52. FTS filters first generation, retention, source and time without returning cross-scope evidence
53. pinned pagination retains page-two reindexed rows and excludes new generations
54. pinned generation excludes a clock-skewed G+1 event older than the cursor
55. read continuation cannot be replayed against different refs in the same repo
56. pinned keyset pagination uses deterministic bucket and timestamp ordering across generation advances
57. stable exact-match bucket precedes newer FTS-only matches across keyset pages
58. documents matching both exact and FTS preserve match_reason 0 and never repeat across keyset page boundaries with limit 1
59. expired authenticated search and read cursors are stale at the domain boundary
60. read cursor issued at G is stale after publication of G+1
61. one-byte payload tampering with the original MAC is invalid
62. query mismatch and search/read/durable kind confusion are invalid
63. current retention availability overrides pinned generation for purged evidence
64. Vietnamese stroked d folds on index and query sides
65. v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
66. concurrent migration opener waits and rechecks v3, then commits without DDL
67. concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
68. v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
69. parseVersion rejects unreadable and invalid versions directly
70. migration rejects unreadable and invalid versions before and after BEGIN IMMEDIATE
71. migration preserves the original error when COMMIT already released the transaction
72. substring and FTS matches collapse to one row with exact score zero
73. FTS search binds every SQL placeholder and uses all-null first-page keyset sentinels
74. FTS syntax characters are quoted as tokens and never interpreted as operators
75. empty-token queries skip FTS and return only substring matches
76. search/status are read-only, Unicode-aware, bounded and never sync implicitly
77. B1 maintenance uses incremental reclamation, never full VACUUM or WAL truncate
78. B1 concurrent purge waits for an active writer and preserves every event
79. B1 capture writer waits for purge lock release with zero lost events
80. B2 admin purge rejects agent environments even with TTY input and output
81. B3 killed cross-database writer reconciles exact committed evidence bytes on restart
82. quota rejection bursts create one deduplicated gap per minute
83. graph neighbor SQL fetch is bounded by remaining examined-edge budget plus one
84. graph path cannot traverse a purged intermediate node
85. portable skill freezes search-first and selective-maintenance behavior
86. portable skill forbids sandbox bypass and sealed namespace auto-selection
87. portable skill mentions only commands and flags covered by the CLI contract
88. test\\context\\sqlite-platform.test.js
89. WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
90. cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
91. JSON MAC encoding rejects colon-delimiter scope collisions across owners
92. status is read-only, capture gaps are visible and jobs/stores have ownership bounds

# tests 92
# pass 92
# fail 0
# cancelled 0
# skipped 0
# duration_ms 19578.504
