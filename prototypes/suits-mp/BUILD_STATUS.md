## Current milestone

Engine perf fix: `GameState.receivedLog` O(n²)-with-trick-count cost
eliminated. Internal representation change only - verified byte-identical
external behavior (masking, Redistribution Log UI, game logic/stats).

## What was implemented

- `rules/types.ts`: new `ReceivedRecordNode` (persistent singly-linked-list
  node: `{ record, prev }`). `GameState.receivedLog` field type changed
  from `Partial<Record<PlayerId, ReceivedRecord[]>>` to
  `Partial<Record<PlayerId, ReceivedRecordNode>>` - stores only each
  recipient's latest node, not the full array.
- `rules/engine.ts`: `redistribute()`'s per-gift write changed from
  `receivedLog[id] = [...(receivedLog[id] ?? []), record]` (O(current
  length) copy every gift) to `receivedLog[id] = { record, prev:
  receivedLog[id] ?? null }` (O(1)). New exported `receivedRecordsFor(state,
  slot)`: walks the linked list and returns the equivalent plain,
  chronologically-ordered `ReceivedRecord[]` every consumer already
  expected - same shape, same order, as the old field.
- `host/botTrust.ts`, `host/mask.ts`: both read sites (`computeTrustScores`,
  `buildDistributedEntries`, the `receivedByMe` masked-log source) switched
  from indexing `state.receivedLog[slot]` as an array to calling
  `receivedRecordsFor(state, slot)`. No behavior change - same records, same
  order, same filtering logic downstream.

## Key technical decisions

- Chose a persistent linked list over alternatives (e.g. a separate
  `Map`-based structure, or batching writes) because it's the minimal
  change that turns an O(n) full-array-copy per gift into an O(1) append,
  while every consumer already needed a full traversal to derive its own
  result (a trust score sum, a masked log) - so read cost is unchanged in
  complexity, only the write's repeated-copying is removed.
- Kept the field inside `GameState` (not moved to a side-channel) since
  it's genuine canonical game state, unlike Section 7's personality data -
  this task is representation-only, not an architecture change.
- Did not touch `host/botTrust.ts`'s "recompute fresh every call, no
  caching" design principle - `receivedRecordsFor` is still called fresh
  each time, matching the rest of the bot AI's established pattern.

## Verification

`npm run typecheck`: pass
`npm run build`: pass

**Redistribution Log UI correctness** (the actual consumer of this data):
verified with two independent, scratch (uncommitted) checks against real
games driven through the real `applyAction`/`chooseBotAction` path:
- 300 games: `receivedRecordsFor`'s internal consistency (chronological
  order, count, linked-list-head match) - 0 mismatches.
- 100 games: `buildMaskedState`'s `redistributionLog` (both `received` and
  `distributed` perspectives) cross-checked against an independently
  reconstructed shadow log built directly from the actual `redistribute`
  actions applied - 15,126 gift-groups checked, 0 mismatches. Includes one
  real traced example (game 0, trick 1): distributor's `distributed` entry
  and the matching recipient's `received` entry for the same gift, both
  correct.

**Performance fix, same 5000-game diagnostic that originally surfaced the
bug** (re-run post-fix, uncommitted scratch script mirroring
`scripts/simulate.ts`'s core loop with per-50k-iteration progress logging):

| | Before this fix | After this fix |
|---|---|---|
| Games hitting the 500,000-iteration cap | 3 / 5000 | 2 / 5000 |
| Time for EACH capped game | ~167.5s | ~2.2-2.3s |
| Per-50k-iteration-window cost | grew 477ms→33,709ms (9.5μs/iter→674μs/iter) | flat ~220-260ms (~4.4-5.2μs/iter) throughout |
| Whole 5000-game batch wall time | (not fully measured; single capped game alone exceeded 160s) | **7.3s total** |

The flat per-iteration cost after the fix (vs. the ~70x growth before)
directly confirms the O(n²) growth is gone - remaining cost is O(1) per
write, same as a normal game.

**Full-scale re-verification**, `scripts/simulate.ts` (the real,
committed tool, all logging enabled), 10000 games, run standalone with no
other CPU-competing process (an earlier attempt overlapped with unrelated
concurrent work and is not used for these numbers - see Known issues):
completed in **53 seconds** (9993 completed, 7 incomplete/capped - capped
games no longer dominate wall time).

| Metric | Last recorded baseline | This run | Verdict |
|---|---|---|---|
| Trick count median | 23 | 23 | Unchanged (exact) |
| Trick count mean | 25.92 | 25.80 | Unchanged (noise) |
| Ally-guess accuracy | 39.6% | 38.2% | Unchanged (noise, matches this series' established ~1-2pp run-to-run variance) |
| Stalemate rate | 9.44% | 9.41% | Unchanged (noise) |

Per-personality breakdown (unaffected, included for completeness since
`scripts/simulate.ts` already reports it): Rusher/Hoarder assist-role-share
split (69.1%/32.5% vs. Balanced's 50.5%) still matches Section 7's design
intent exactly, confirming this fix changed nothing about game logic or
bot decisions - performance only.

## Open questions

None - task was unambiguous and self-contained.

## Known issues

- One 10000-game verification attempt during this session took ~16
  minutes instead of the expected ~1 minute. Investigated: it ran
  concurrently with an unrelated task's dev server + several headless
  Chromium/Playwright sessions on the same machine, competing for CPU. A
  clean standalone re-run (numbers used above) completed in 53s,
  confirming this was resource contention, not a residual code issue.
- Rare extremely long games (tens of thousands of tricks) still occur and
  still hit the existing 500,000-iteration safety cap (7/10000 this run) -
  this is pre-existing, expected heavy-tail behavior under the GDD's "No
  Trick Limit" rule, unchanged by this task. What changed is that each
  such game is now cheap (~2s) instead of catastrophically expensive
  (~167s).

## Next proposed step

None required for this fix specifically. The stalemate rate (~9.4%) and
heavy-tailed trick-count distribution remain open, already-tracked areas
from prior tasks in this series - not affected by this performance-only
change.
