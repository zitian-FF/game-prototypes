## Current milestone

Removed the premature suit-completion check in `advanceBlocker()`,
closing a rules-correctness bug every prior session's BUILD_STATUS.md had
carried forward as a known issue. The GDD is explicit: "Victory is
checked only after redistribution is fully complete and every player
again holds exactly 10 cards." `advanceBlocker()` was checking right
after the distributor collected the trick's cards into their own hand -
before any redistribution happened - so a distributor whose suit merely
*looked* complete at that moment (because the cards that completed it
were exactly the ones they were about to be required to give away) could
end the game immediately, skipping mandatory redistribution and denying
the other players their rightful gifted cards.

## What was implemented

- **`rules/engine.ts`'s `advanceBlocker()`**: removed the
  `checkSuitCompletion(players)` call and its `gameOver` early-return
  entirely. The trick-card collection into the distributor's hand is
  unchanged - still correct and necessary, per the function's own
  existing doc comment about why collection has to happen here. The
  function now simply returns `{ ...state, players, phase: next,
  pendingBlocker: null }` after collection, with no win check in between.
- **Doc comment updated** to state plainly that no win check happens in
  this function anymore, and why: right after collection the distributor's
  hand is inflated above 10 and every other contributor is still short by
  their own contribution, so checking here could end the game on cards
  about to be given away, and would miss a win by whoever ends up
  *receiving* a gifted completing card. The only suit-completion check in
  the whole flow is now `redistribute()`'s own (untouched, still fires
  once every gift has actually been applied and the 10-cards-all
  invariant is restored).
- `redistribute()`, `checkSuitCompletion()`, and the mandatory-
  redistribution/delegation logic - untouched, per scope. No UI code
  touched - this is a rules-engine-only fix.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Constructed exactly the scenario the bug describes**, via a scratch
  script (deleted before finishing) driving the real engine directly
  (`initGame`/`playCard`/`proceedFromTrickResult`/`advanceBlocker`/
  `redistribute` from `rules/engine.ts`, `settleAutoPhases` from
  `host/gameHost.ts` - not a reimplementation): a distributor (P0,
  Cthulhu) missing exactly one Cthulhu card pre-trick wins a trick whose
  collected cards happen to include that exact missing card. A **sanity
  assertion first confirmed this is a genuine repro** - P0's hand really
  does look suit-complete immediately after collection, exactly the state
  the old code would have wrongly ended the game on. Then:
  1. **`advanceBlocker()` no longer ends the game at collection time** -
     phase proceeds to `'redistribution'`, `winner` stays `null`, even
     though the pre-fix code would have set `phase: 'gameOver'` right
     here (confirmed by the sanity assertion above).
  2. **The correct check still fires for a real win - including for a
     gift recipient, not just the distributor** - from that same
     pre-redistribution state, called `redistribute()` with gifts
     arranged so the distributor (P0) does *not* end up keeping their
     completing card (it's given away), while a different player (P3,
     ShubNiggurath) *receives* a gifted card that completes their own
     suit. Confirmed `phase: 'gameOver'`, `winner.team: 'Cosmos'`,
     `reason: 'suit'`, and explicitly confirmed P0 did not also complete.
  3. **No false positive when nobody actually completes** - from the same
     pre-redistribution state, called `redistribute()` with every
     contributor simply getting their own contributed card back (the
     "boring" case) and confirmed the game correctly continues to the
     next trick (`phase: 'blocker'`, `winner: null`,
     `trickNumber` advanced).
  All 12 assertions across the three checks passed on the first run
  after the fix was written.
- Playwright against `npm run preview`: booted a single-player-vs-bots
  game, confirmed the board renders normally (this fix touches no
  rendering code) with a clean console aside from the known pre-existing
  Google Fonts sandbox-network failure and the same intermittent,
  previously-established-as-unrelated 404 seen in prior tasks' checks.

## Key technical decisions

- **Deleted the check outright rather than moving or gating it** - the
  function's own doc comment already explained (accurately) why
  collection has to happen in `advanceBlocker()`, but the win check
  itself had no such justification for running there; `redistribute()`
  was already the correct, later point, and already had its own
  identical check. Removing the earlier one is strictly a subtraction -
  no new logic, no new call site, nothing to keep in sync between the two
  checks now that only one remains.

## Open questions

None - the GDD's check-timing requirement was unambiguous, and the fix
was verified directly against the real engine, including the specific
"gift recipient" case the brief called out as the more subtle half of
the bug (the old code could never have detected that case at all, since
it ran before any gifts existed).

## Known issues

Carried over, untouched by this task: the facedown-card masking leak is
already fixed (prior task) but genuine gameplay verification of it via
real bot/human play is still pending; Rules-modal content gaps (no Setup
section, off-suit hidden-identity nature unstated in the copy); the
other three seat tags still don't use `ui_player_nameplate.png`
(deliberate, from an earlier visual pass).

## Next proposed step

None specific to this fix - it's complete and verified. Whatever task
next does real multi-device or multi-bot playtesting is a natural place
to also pick up the still-pending genuine-gameplay verification items
noted above (off-suit masking, and now implicitly this fix too).
