# Round 4 Process Output and Session Contract

Normative proposed semantics for NEW internal/additive operations, not a change to legacy
line fields. No owner policy or execution approval inferred. This document replaces the
Round-3 global-text-offset proposal. Raw global arrival audit remains useful; text offsets
are per stream because UTF-8 characters cannot cross stderr/stdout boundaries.

## Identity and operations

Device session key is opaque immutable runtimeGeneration+sessionNonce (not PID-derived).
Registry entry binds PID/process handle, authorization scope, lifecycle and output store.
Gateway outer owner/device token maps to this device key; existing wrapper accepts opaque
strings. Device adapter stops Number(session_id) conversion in the approved migration.
Legacy PID tool uses a separate captured compatibility adapter; never reinterpret token
as PID. PID reuse test forces process B PID N after A exits: A key still reads retained A
or SESSION_EXPIRED, never operates on B. Reconnect in same generation preserves keys;
restart makes old keys invalid. Registry/session/nonce metadata bounded by approved policy.
No reader/consumer registry or delivery acknowledgement is introduced.

Two unambiguous operations:
- `readRaw(session, globalOffset, maxBytes, waitMs, endOffset?)`: exact raw receipt bytes,
  stream attribution, accepts arbitrary retained global offsets.
- `readText(session, stream, streamOffset, maxBytes, waitMs, endOffset?)`: one selected
  stdout OR stderr projection, strict UTF-8; nextOffset always in that stream's raw bytes.

Global ledger assigns contiguous receipt byte ranges and sequence to chunks. Each chunk
also records contiguous stream-local range. Bounded coalescing/index/spill preserves these
mappings. Raw bytes are never re-encoded for identity. Text result has text, streamRange,
nextOffset, and ordered sourceRanges in global ledger (may be noncontiguous). Adjacent
source ranges merge; range count/metadata/envelope bounded independently under OD-1.
Text API does not expose one merged string or global nextOffset. UI may display separate
projections; any merged view must label presentation ordering and cannot invent causality.
Receipt order is observed event order, not OS causal order. No stream blocks the other.

## Bounds, decoding and retries

maxBytes bounds selected stream source-byte consumption in text mode; raw mode bounds
contiguous global bytes. Neither is serialized envelope cap; that is a separate approved
route budget, <= actual Gateway grant (policy maximum 48 KiB, possibly lower). Account
base64/escaping/status/sourceRanges before returning, using the stable budget partition
below rather than subtracting the current observation's serialized length. Emit largest complete-codepoint
prefix fitting both source budget and envelope/metadata cap. If first complete codepoint
cannot fit maxBytes: BUDGET_TOO_SMALL with minimumSourceBytes, nextOffset unchanged.
If source fits but envelope cannot fit first record: RESPONSE_BUDGET_TOO_SMALL with
nextOffset unchanged; never silently drop mapping metadata. Bounded index validation
returns INDEX_UNAVAILABLE if boundary metadata was lost, never guessed rounding.

### Stable replay identity and budget partition

Replay request identity is session key, coordinateSpace, start, explicit fence, maxBytes,
representationVersion and budgetProfileId. Profile fixes serializer/encoding and envelope
cap C, invariant transport-wrapper allowance W, observation allowance O, and replay budget
P=C-W-O. All allowances include exact JSON framing/escaping overhead with a fixed schema;
profile supplies a validated worst-case bound, not estimated averages. Replay block includes
selected bytes/text, mappings, nextOffset, readFence and selected-range status/blockedBy.
It is chosen using P alone, including its own serialized framing. Both raw/text obey this
partition. Profiles must fit bounded control/error records; otherwise reject profile before
reading output. No numeric reserve or product capacity approved in this proposal.

Observation block contains current root/pipe/termination/retention/snapshot metadata with
bounded fields and no unbounded message strings. It must fit O for every schema-valid state;
W similarly bounds adapter/wrapper fields. Lifecycle values, integer widths and wrapper
escapes are included in the worst-case bound. Unused O/W capacity is NEVER lent to P.
Thus exit/EOF/termination cannot shrink replay prefix or turn success into budget error.
Nonessential observations may be omitted only by a fixed profile rule, not opportunistic
payload-dependent trimming. If actual observation/wrapper violates its bound, fail closed
with ENVELOPE_PROFILE_VIOLATION, invalidate profile/evidence; this is an invariant fault,
not ordinary replay behavior. Never send an oversized envelope to preserve replay.

Replay promise holds only for the same representation/profile and retained bytes/index.
If current grant/policy no longer permits that profile/cap, return REPLAY_PROFILE_UNAVAILABLE
without output advancement (bounded control response under current authorized cap), or
transport-level refusal if even control cannot fit. Never silently adopt a smaller profile.
Caller explicitly selecting another approved profile starts a new replay identity and may
receive a different prefix. Retention/index expiry and invariant faults are explicit exceptions,
not identical-success promises. Profiles/lookup/control paths must themselves be bounded.

Text requested start inside a valid multibyte codepoint: OFFSET_MISALIGNED,
nearest valid boundaries, unchanged nextOffset. An explicit endOffset is a byte fence,
not a claim of a character boundary: a trailing incomplete scalar inside that fence
returns FENCE_INCOMPLETE (rules below), never consumes bytes beyond the fence. maxBytes is a budget, so its endpoint may
fall inside a codepoint: stop before that codepoint (or BUDGET_TOO_SMALL if zero prefix).
Start at incomplete live prefix or no complete first codepoint: TEXT_PENDING after bounded
wait, unchanged nextOffset. Incomplete at selected stream EOF: INVALID_UTF8. Invalid byte
at first position: INVALID_UTF8 offendingStreamRange/sourceRanges, no replacement text;
raw read remains exact. If valid prefix precedes invalid/pending bytes, return prefix,
nextOffset at fault and blockedBy metadata; next read there yields specified error.
Boundary detection follows strict UTF-8 scalar rules (reject overlong, surrogate, >U+10FFFF,
stray continuation). Decoder state independent per stream and cannot absorb other stream.

Three distinct concepts: snapshotEnd is captured byte extent for one observation;
explicit endOffset is an immutable selected-range fence; physical EOF is a lifecycle event,
not exhaustion of either range. Require start <= fence <= captured end, else INVALID_RANGE
or RANGE_NOT_CAPTURED. Only UNFENCED reads may wait at snapshot end/pending and refresh
snapshot within waitMs. Explicit fenced reads never wait, refresh or examine bytes beyond
fence to complete/validate a trailing scalar. A truncated UTF-8 prefix at fence yields
FENCE_INCOMPLETE with nextOffset unchanged (or valid prefix plus blockedBy), regardless of
later bytes or physical EOF; malformed bytes already inside fence still yield INVALID_UTF8.
This includes a numeric fence cutting a scalar known to continue outside the range: it is
not OFFSET_MISALIGNED at end. Start alignment still requires retained boundary metadata.

Every unfenced response records snapshotEnd. It returns readFence only for a range with
complete decoded scalars (including empty range); pending/EOF-invalid incomplete responses
omit readFence and advertise snapshotEnd as observation, not exact text replay promise.
Caller may explicitly fence that snapshot, choosing FENCE_INCOMPLETE semantics. Retry with
returned readFence uses explicit-fence rules. Unfenced pending may become valid or EOF-invalid;
no unchanged live-status promise. Same replay identity/profile and retained explicit range/source bytes gives identical
selected payload/status, irrespective of bytes outside fence or later EOF (subject only to
explicit retention/index/profile/invariant-fault exceptions above). Physical lifecycle metadata
is separately observed and may change; exact replay refers to selected payload/status only.
After range/retention validation, zero-length start=fence takes precedence over text
alignment/decoding: fenced reads return empty RANGE_END immediately, even if waitMs>0 or
stream is live. Unfenced start=snapshotEnd may wait; after wait, no bytes -> TEXT_PENDING if live,
or empty STREAM_EOF if naturally sealed. Completed empty stream follows the latter rule.
readRaw uses identical fence/wait/range-end rules without decoding.

Returned retentionUntil is policy bound, not perpetual pin; expiry returns OFFSET_EXPIRED
with gap, oldest available selected-space offset and no false complete result. Every offset
response names coordinateSpace (`globalRaw`, `stdout`, `stderr`). Tail is a view in that space.

## Concrete expected examples

Shapes below omit common session/lifecycle/budget metadata only. Hex data stands for exact
raw bytes; production raw response can use base64 plus length/hash. Source ranges are
half-open global byte intervals. Errors leave nextOffset at requested start.

### 1. Interleaved euro

Ledger: stdout E2 global[0,1),stdout[0,1); stderr 58 global[1,2),stderr[0,1);
stdout 82 AC global[2,4),stdout[1,3).

`readText(stdout,0,3)` after completion:
```json
{"stream":"stdout","text":"€","streamRange":[0,3],"sourceRanges":[[0,1],[2,4]],"nextOffset":3,"readFence":3}
```
`readText(stderr,0,1)` -> text "X", streamRange[0,1], sourceRanges[[1,2]],nextOffset1.
No combined euro/X ordering is asserted. `readText(stdout,0,2)` -> BUDGET_TOO_SMALL,
minimumSourceBytes3,nextOffset0. It does not require global coverage4 because text selects
stdout only. `readText(stdout,1,3)` -> OFFSET_MISALIGNED,before0,after3,nextOffset1.
`readRaw(globalOffset=0,maxBytes=3)` -> E2 58 82, ranges stdout[0,1),stderr[1,2),
stdout[2,3),nextOffset3; raw response is valid even though it is not decodable merged UTF-8.

### 2. Incomplete stdout and ready stderr

stdout F0 9F -> global[0,2),stdout[0,2); stderr "ready\n" -> global[2,8),stderr[0,6).
`readText(stdout,0,4,waitMs=0)` -> TEXT_PENDING,nextOffset0.
`readText(stderr,0,6)` -> text "ready\n",sourceRanges[[2,8]],nextOffset6 immediately.
stdout 98 80 later -> global[8,10),stdout[2,4).
`readText(stdout,0,4)` -> text "😀",streamRange[0,4],sourceRanges[[0,2],[8,10]],nextOffset4.
The earlier pending response did not consume anything; stderr never waited for stdout.
The pending response has snapshotEnd2, no readFence. Explicit `readText(stdout,0,4,0,2)`
returns FENCE_INCOMPLETE,nextOffset0,readFence2 both before and after the later bytes arrive,
and even after EOF: bytes outside fence never change selected payload status. Unfenced
retry returns emoji with readFence4. `readText(stdout,2,4,100,2)` returns empty RANGE_END
immediately (zero selected length); it does not read/wait for later bytes. Starting at2 with
no fence while the first two bytes are still pending requires boundary validation and
returns TEXT_PENDING; after completion start2 is OFFSET_MISALIGNED. Empty live stdout
unfenced at0 waits up to waitMs then TEXT_PENDING; empty naturally sealed stdout at0
returns empty STREAM_EOF; either with explicit fence0 returns empty RANGE_END.

### 3. Invalid stdout with valid stderr

stdout FF -> global[0,1); stderr 4F 4B -> global[1,3).
`readText(stdout,0,1)` -> INVALID_UTF8,offendingStreamRange[0,1],sourceRanges[[0,1]],nextOffset0.
`readText(stderr,0,2)` -> text "OK",sourceRanges[[1,3]],nextOffset2.
`readRaw(0,3)` -> FF 4F 4B,nextOffset3. No U+FFFD substitution. If stdout ends with F0 9F,
its live TEXT_PENDING becomes INVALID_UTF8 on EOF with raw recovery unchanged.

### 4. Tiny page and envelope

stdout bytes 41 E2 82 AC ("A€"),no interleaving.
`readText(stdout,0,2)` -> "A",streamRange[0,1],nextOffset1 (euro cannot fit remaining1).
`readText(stdout,1,2)` -> BUDGET_TOO_SMALL,minimumSourceBytes3,nextOffset1.
`readText(stdout,1,3)` -> "€",range[1,4],nextOffset4 if full envelope fits.
If encoded metadata budget cannot fit that first euro record: RESPONSE_BUDGET_TOO_SMALL,
nextOffset1. No advance to4 with missing text or sourceRanges.

### Replay/envelope boundary oracle (additional to the five byte examples)

Freeze approved test profile C/W/O/P and request identity; choose text and raw fixtures whose
replay block exactly fits P (next byte/codepoint cannot fit). Before and after root exit,
stdout/stderr EOF and termination-state changes: identical replay block/nextOffset/status,
observation fits O and entire response <=C. Unused observation capacity never changes prefix.
Same bytes with now-reduced grant -> REPLAY_PROFILE_UNAVAILABLE,nextOffset unchanged, not
shortened success; explicitly selecting a new smaller profile may shorten prefix. Simulated
observation >O -> ENVELOPE_PROFILE_VIOLATION, no oversized response, gate fails. Also test
unfenced `A`+F0 9F: return A/blockedBy TEXT_PENDING/snapshotEnd3 and NO readFence; explicit
fence3 returns A/blockedBy FENCE_INCOMPLETE, unchanged after completing bytes outside fence.

### 5. Arbitrary raw replay and expiry

Use example1 ledger. `readRaw(2,1,endOffset=3)` -> hex82,stream stdout,global[2,3),
stream[1,2),nextOffset3,readFence3. Repeating within retention returns same byte and tags,
regardless of invalid text boundary. After global[2,3) expires -> OFFSET_EXPIRED,
gap[2,3),oldestAvailableOffset and coordinateSpace globalRaw, not empty complete success.

## Lifecycle and legacy adapters

Root exit, stdout/stderr EOF, capture closed/forced_incomplete, termination verified/failed
remain separate per runtime contract. `outputFinal` means capture sealed, not no gaps;
cleanComplete requires natural pipe EOF and no unreported loss. Ordered stdin EOF follows
accepted writes; acknowledgements mean accepted byte count, not executed input.
Legacy stdio offset=0/positive/negative and length remain lines and captured shared cursor/
completed replay semantics while adapter retained by OD-4. Gateway offset/length retains
approved mapped semantics; exposing per-stream bytes requires explicitly additive/versioned
mapping, not silently changing existing Gateway arguments. Existing outer owner mapping
stays intact; device session key becomes opaque, with migration tests before acceptance.
