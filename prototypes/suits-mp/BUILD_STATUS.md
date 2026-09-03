## Current milestone

Removed the trick-40 forced-end mechanic entirely, aligning suits-mp's
actual game code with the live GDD's "No Trick Limit" section (read
fresh this session): "There is no trick limit or forced end
condition... Play continues until the Standard Win Condition is met,
or simultaneous completion by opposing Teams produces a stalemate. A
forced ending may be reconsidered only if future playtesting data
shows that one is needed." This closes the rules-correctness gap
surfaced by the previous session's GDD terminology audit (PR #68),
which found the engine still implementing this removed mechanic. This
task removes exactly that one end-game path; the Standard Win
Condition (suit completion) is untouched and confirmed still working.
Version stamp counter unchanged (`8`) at time of writing; no deploy has
run for this fix yet.

## What was implemented

- **`rules/engine.ts`**: deleted `resolveTrick40ForcedEnd()`, its
  `suitCompletionCount()` helper (used only there), the
  `TRICK_40_FORCED_END = 40` constant, and the
  `if (state.trickNumber === TRICK_40_FORCED_END) { ... }` branch inside
  `redistribute()` that called it. `redistribute()` now falls straight
  through from the suit-completion check to the normal "advance to the
  next trick" path unconditionally - `trickNumber` just keeps
  incrementing forever with no special-casing at any boundary. Removed
  the now-unused `Team` type import (only referenced inside the
  deleted code).
- **`rules/types.ts`**: `WinInfo.reason` narrowed from
  `'suit' | 'trick40' | 'stalemate'` to just `'suit'` - see "Key
  technical decisions" below for why `'stalemate'` came out too, not
  just `'trick40'`.
- **`dom/rulesContent.ts`**: replaced the `id: 'forty'` "The Fortieth
  Trick" / "Forced ending" section (Roman numeral VII) with a new
  `id: 'noLimit'` "Until the Suit is Claimed" / "No trick limit"
  section, in the same archaic/ritual voice as the rest of the file,
  describing the GDD's actual current rule: no trick limit, and a
  stalemate only when both covenants complete a Deity Suit within the
  same offering (redistribution). Verified via a scratch harness
  (`RulesModal` rendered directly, "Unfold all" clicked, screenshotted)
  that the new section renders correctly, then deleted before
  finishing.
- **`net/actions.ts`**: updated the client-action comment block that
  asserted (present tense) "trick 40 is now an automatic host-computed
  forced end" and referenced the now-deleted `resolveTrick40ForcedEnd`
  - rewritten to describe both removals (role-guess, then trick-40) as
  history, with no dangling reference to deleted code.
- **`BRIEF.md`**: updated two places that described the trick-40 forced
  end as current, active behavior (a section titled "Trick-40 forced
  end (replaces role-guess)" written in present tense, and a bot-AI
  bullet listing it as a live end-game path) - both rewritten to past
  tense / "removed", matching the task's own allowance for genuinely
  useful historical-context comments elsewhere in the file (several
  other mentions already read as history, e.g. "a follow-up task...",
  and were left untouched).
- Confirmed via a broad audit (grepped the whole `prototypes/suits-mp`
  tree for `trick.?40`, `Trick 40`, `Fortieth`, `forced.?end`) that no
  other file - UI copy, code, or docs - references the removed
  mechanic as active behavior.

## Key technical decisions

- **Removed `'stalemate'` from `WinInfo['reason']` too, not just
  `'trick40'`.** The task's own instruction was to remove types "that
  only exist to support this removed mechanic" - and per the type's own
  prior comment ("`'stalemate'` covers only that forced end's own tie
  case now - the old role-guess exhaustion stalemate was removed along
  with role-guess entirely"), `'stalemate'` had already become
  single-purpose for exactly this mechanic once role-guess's own
  stalemate was removed in an earlier session. Confirmed nothing reads
  `reason`'s actual string value anywhere in the codebase (it's passed
  through opaquely end-to-end: engine -> `host/mask.ts` -> DOM, which
  only ever branches on `team === null`, never on `reason`) - so
  removing it has zero behavioral effect, and keeping a union member
  with zero remaining producers would just be confusing, unreachable
  type surface.
- **Did not implement genuine simultaneous-completion stalemate
  detection.** This surfaced a real, separate gap while confirming
  item 5 ("stalemate-via-simultaneous-completion logic... untouched and
  still functions correctly"): `checkSuitCompletion()` - the actual
  Standard Win Condition check, called from both `advanceBlocker()` and
  `redistribute()` - loops over players and returns the *first* one
  found with a completed Deity Suit. It has never checked whether a
  second player from the *other* Team also completed simultaneously,
  which is exactly the case GDD's Standard Win Condition says should
  produce a stalemate instead of a single winner. This isn't something
  the trick-40 removal broke - it was already true beforehand, just
  masked by trick-40's own (unrelated, count-based) stalemate path
  being the only place `'stalemate'` was ever actually produced.
  Implementing real simultaneous-completion detection is new engine
  work, not a removal, and touches the Standard Win Condition path this
  task was told to leave untouched - so it wasn't done here. Flagged
  clearly rather than silently left unfixed or silently "fixed" without
  being asked; see "Known issues" and the filed follow-up task.
- **Picked a plain-substitution approach for the Rules-modal section**
  rather than deleting it outright and shifting every later section up
  one Roman numeral. Keeping a same-position replacement (still numeral
  VII) was the smaller, more mechanical diff, and "no trick limit" is a
  real, current rule worth a Rules-modal section of its own - it isn't
  padding to preserve a numbering scheme.

## Open questions

None on the removal itself - the GDD was unambiguous, and this task's
own instructions were specific about what to remove. One thing raised
by item 5's verification isn't a question so much as a confirmed,
separate finding (see "Known issues" and "Key technical decisions"
above) that needed surfacing rather than silently acted on or ignored.

## Known issues

- **`checkSuitCompletion()` does not detect simultaneous completion by
  opposing Teams.** GDD's Standard Win Condition: "If both Teams have
  at least one player complete their Deity Suit during the same
  redistribution, the game ends in a stalemate with no winning Team."
  The current engine has no code path that produces this outcome at
  all - it always declares whichever player it iterates to first the
  winner. Filed as a separate follow-up task (implement real
  simultaneous-completion stalemate detection in `checkSuitCompletion()`
  and reintroduce a `'stalemate'` reason for it) rather than folded into
  this removal.
- Carried over, still true, untouched by this task: facedown-card
  masking leak (`host/mask.ts`); no card-back art yet; the bottom HUD
  name tag can wrap for a long real name.

## Next proposed step

The simultaneous-completion stalemate gap above is filed as its own
suggested task. Nothing else outstanding for this removal.
