## Current milestone

Full rule-by-rule audit of both the engine (`rules/engine.ts` and
related files) and the Rules-modal copy (`dom/rulesContent.ts`)
against the live GDD (read fresh this session - unchanged since the
last two sessions' reads), across all 10 areas the task named. Fixed
the one area explicitly authorized: `checkSuitCompletion()` now
detects genuine simultaneous Deity-Suit completion by opposing Teams
and produces a real stalemate, reintroducing a `'stalemate'`
`WinInfo.reason` for it. Two additional, confirmed engine bugs were
found during the audit but are **not fixed here** - they weren't
named by this task, they're each a real, separate gameplay-behavior
change in their own right, and bundling either into this PR would
violate "small, single-purpose PR." Both are written up in full below
and under "Known issues," with enough detail to scope a dedicated
follow-up task for each. Version stamp counter unchanged (`8`) at time
of writing; no deploy has run for this fix yet.

## What was implemented

- **`rules/engine.ts`'s `checkSuitCompletion()`** rewritten to check
  every player for suit completion (not stop at the first), collect
  every completer, then look at which Team(s) they belong to: one
  Team only -> that Team wins (unchanged behavior for the ordinary
  case, `reason: 'suit'`); both Teams represented -> `reason:
  'stalemate'`, `team: null`. Both call sites
  (`advanceBlocker()`/`redistribute()`) needed zero changes - they
  already just forward whatever `checkSuitCompletion()` returns.
- **`rules/types.ts`**: `WinInfo.reason` widened back from `'suit'` to
  `'suit' | 'stalemate'`, with a comment explaining this is GDD's
  Standard Win Condition stalemate (freshly implemented), unrelated to
  the old trick-40 forced end's own same-named-but-different
  `'stalemate'` reason removed two sessions ago.
- No DOM changes were needed: `ui/renderGameView.ts`'s game-over screen
  already renders `` `Winning team: ${winner.team ?? 'none (stalemate)'}` ``
  generically off `team === null`, regardless of `reason` - it was
  simply unreachable in practice until this fix, since nothing
  produced a `team: null, reason: 'stalemate'` result before now.

## Full per-area audit (engine status / Rules-modal status / what was fixed)

**1. Setup** (Deity assignment, shuffle/deal, forced 2-of-Yog-Sothoth
opener) - **Engine: correct.** `initGame()` shuffles `ALL_GODS`
(exactly the 4 distinct Deities) one per player, shuffles the real
40-card deck (`CARD_DEFS` = 4 Deities x 10 ranks, confirmed against
the GDD's own Card List table by spot-check), deals 10 each, and
finds whoever holds the 2 of Yog-Sothoth to lead. `isForcedTrick1Opener
(trickNumber, position) = trickNumber === 1 && position === 0` and
`playCard()`'s `position === 0` branch enforce that exact card as a
Single, scoped correctly to trick 1 only - every later trick's leader
is free to open with any single card. **Rules-modal: missing.** There
is no Setup section in the Rules modal at all - players are never
told about the forced first-card rule, the Deity/hand deal, or
anything else in this area. Not fixed here (net-new content/section is
a design decision the task didn't ask for, unlike the pure text-swap
Area 8 was scoped as) - flagged for a decision on whether to add one.

**2. Objective** (collect all 10 of own Deity Suit) - **Engine:
correct** for the suit-completion *detection* itself
(`checkSuitCompletion()`'s per-player check); the decision of what
happens next when completion occurs is Area 8's concern, covered
there. **Rules-modal: correct** - fixed in the prior terminology-audit
session (PR #68): "Gather all ten cards of thy Deity Suit..."

**3. Suit Cycle** (Yog-Sothoth -> Cthulhu -> Shub-Niggurath ->
Nyarlathotep, Lead Suit fixes Required Suit for every position
regardless of what's played) - **Engine: correct.**
`SUIT_CYCLE = ['YogSothoth', 'Cthulhu', 'ShubNiggurath', 'Nyarlathotep']`
matches the GDD's cycle exactly; `requiredSuitForPosition()`/
`suitAfterSteps()` reproduce the GDD's own worked example verbatim
(Lead Suit Cthulhu -> Shub-Niggurath/Nyarlathotep/Yog-Sothoth for
Players 2/3/4) when checked by hand. Required Suit is derived purely
from the Lead Suit and position, never from what's actually played at
intermediate positions (off-suit/Double plays don't perturb it).
**Rules-modal: correct** - "The Turning of Suits" text and the visual
cycle diagram (`CYCLE` array) both use the exact GDD order.

**4. Matching the Required Suit** (must play a Single of it if held;
otherwise a facedown off-suit Single or a Double) - **Engine:
correct.** `legalOptions()` forces `mustPlaySuit` whenever the hand has
any Required-Suit card (no off-suit/Double option offered at all in
that case); `playCard()` enforces it (`must play a required-suit
card` if a Double or off-suit is attempted while able to follow suit).
When unable to follow, both an off-suit Single and a same-rank Double
(any suits) are accepted. **Rules-modal: incomplete.** "Straying from
the Suit" correctly says an off-suit Single "is counted rank 0 and
cannot take the trick," but never mentions it's played face down with
its identity hidden from other players (GDD: "its suit, rank, Deity
Symbol and card identity remain hidden from the other players") - a
real, distinctive mechanic that's simply absent from the copy. Not
fixed here (an addition, not a correction of something already
stated wrong) - flagged.

**5. Winning a trick** (Doubles beat all Singles; highest-rank wins
within a play type, latest-play tiebreak; Ace rule) - **Engine:
partially incorrect - a confirmed bug.** Doubles-beat-Singles,
highest-rank-wins, and the latest-play tiebreak (`>=` in
`resolveTrick()`'s comparison loop, so a later tie overwrites the
earlier `best`) are all correct. The Ace rule is not: GDD says "an Ace
beats a 10 **if played after that 10** in the same trick" - order-
dependent - and repeats the same order-dependence in the Card List
section ("Beats a 10 if played after it"). The engine's
`hasTenInTrick()`/`rankValue()` only check whether a 10 exists
*anywhere* in the finished trick, with no regard for whether the
specific Ace was played before or after it. Concrete failure case: a
leader plays an Ace, a later position plays a 10 - per GDD "Laid
before, the Ten stands" (the 10 should beat the Ace), but the current
code sees `hasTen = true` and scores every Ace in the trick as 11,
so the Ace would incorrectly win. **Rules-modal: correct** - "The Ace
overcomes a Ten only when it falls after it within the same trick.
Laid before, the Ten stands" accurately states the real rule; the
engine simply doesn't implement what its own Rules modal already
promises. **Not fixed here** - this wasn't named by the task, it's a
real trick-outcome behavior change (correcting it needs real design
care around edge cases the GDD's wording doesn't fully spell out,
e.g. a trick with more than one 10, or an Ace-rank Double), and
bundling it into this PR would risk two major behavior changes in one
place. Flagged as a high-priority follow-up - see "Known issues."

**6. Redistribution** (redistributor receives all trick cards;
mandatory non-self delegate on a Double win; manual card-to-player
assignment; exact contribution-count matching; all end at 10 cards) -
**Engine: correct**, verified by direct derivation, not just reading:
for the distributor, final hand = (10 - ownContribution + totalTrick)
- (totalTrick - ownContribution) = 10 exactly; for every other
contributor i, final hand = (10 - contribution_i) + contribution_i =
10 exactly. `chooseDelegate()` rejects `delegateId === pendingWinnerId`
(no self-delegation); the delegate - never the winner - collects and
redistributes on a Double win (`advanceBlocker`/`redistribute` both
key off `pendingDistributorId`, set by `chooseDelegate` on a Double
win or directly by `proceedFromTrickResult` on a Single win).
**Rules-modal: correct** - "The Offerings" matches GDD's redistribution
rule and the mandatory-delegation rule ("Never thyself, and never
declined").

**7. Next trick / Invoker** (redistributor leads next trick) -
**Engine: correct** - `redistribute()`'s final return sets
`leaderId: pendingDistributorId` (whoever actually redistributed,
winner or delegate), and every leader (not just trick 1's) is
constrained to exactly one card via the same `position === 0` check
used for the forced trick-1 opener. **Rules-modal: correct** - "The
Invoker" section matches GDD exactly.

**8. Standard Win Condition / simultaneous completion - THE AREA THIS
TASK FIXED.** Previously: **engine incorrect** (see "Current milestone"
above) - `checkSuitCompletion()` returned the first completer found
with no check for an opposing-Team completer in the same pass, so
GDD's stalemate case could never actually occur. **Now fixed and
verified** - see "How this was verified" below. **A second, separate,
newly-discovered bug in this same area, also not fixed here:**
`advanceBlocker()` calls `checkSuitCompletion()` immediately after
collecting the trick's cards into the distributor's own hand, *before*
any gifts are given out - at that exact moment the distributor's hand
is inflated above 10 and every other contributor's hand is still
short by their own contribution, which does not satisfy GDD's explicit
"every player again holds exactly 10 cards" precondition for checking
victory at all. This is reachable and can change the actual outcome:
since the distributor freely chooses which cards to redistribute, a
distributor whose hand only *happens* to complete their suit right
after collecting (before they've chosen what to give away) might no
longer hold a complete suit once real redistribution finishes - so
checking (and potentially ending the game) at the earlier, premature
point can produce a different result than checking at the correct,
later point `redistribute()` already checks at. Confirmed reachable in
practice: an early draft of this session's own verification script
accidentally triggered exactly this path (a forced player's required-
suit play happened to complete the distributor's own suit right at
collection, ending the game before redistribution could be tested at
all) - the script was reworked to avoid it, but the underlying engine
behavior is unchanged. Not fixed here - not named by the task, and
fixing it means deciding whether `advanceBlocker`'s own check should
simply be removed (deferring entirely to `redistribute()`'s
correctly-timed check) or something more involved; needs its own task.
**Rules-modal: correct** for the actual outcome rule (stalemate
condition matches GDD); doesn't spell out the exact check-timing
detail, which is an implementation nuance, not something players need
in a rules reference.

**9. No Trick Limit** - **Engine: correct**, fixed and heavily
verified two sessions ago (PR #69): `resolveTrick40ForcedEnd()` and
the `TRICK_40_FORCED_END` constant are gone, `redistribute()` falls
through unconditionally to incrementing `trickNumber`, confirmed via a
20,000-step real-bot-AI simulation that reached trick 4013 with no
forced end. Re-confirmed this session: no `trick.?40`/`Fortieth`/
`forced.?end` reference remains anywhere in `prototypes/suits-mp`
describing current behavior. **Rules-modal: correct** - "Until the
Suit is Claimed" (added in PR #69) states the real current rule.

**10. Information visibility / masking** - **Known, separately-
tracked leak, confirmed present, not touched here per this task's
explicit instruction.** Exact mechanism, confirmed by reading
`host/mask.ts`'s `buildMaskedState()`: `currentTrick`/`previousTrick`
both map every play to `{ player, cards: play.cardIds, kind: play.kind }`
unconditionally - there is no branch that redacts `cardIds` when
`kind === 'offsuit'`. GDD requires a face-down off-suit Single's "suit,
rank, Deity Symbol and card identity" to "remain hidden from the other
players," and the architecture note is specific that this must hold
"over the wire," not just in what the renderer chooses to draw - but
the real card ID is sent to every peer regardless. A curious client
reading its own network payload directly (bypassing the UI) could
already determine another player's face-down card identity. This is
the same masking leak referenced in every prior suits-mp
`BUILD_STATUS.md` this session ("facedown-card masking leak
(`host/mask.ts`)") - status unchanged, still present, still tracked
separately, per this task's own instruction not to fix it here.

## How this was verified (Area 8's fix)

Wrote a scratch script (`stalemate-check.mts`, deleted before
finishing) driving the real engine via `initGame` + `applyAction` +
`settleAutoPhases` (`rules/engine.ts`/`host/gameHost.ts` - the same
functions production code calls, not a reimplementation) through two
hand-constructed scenarios:

- **Opposing-Team simultaneous completion**: a `ForcedDeal` puts P0
  (Cthulhu/Chaos) one card short of their Deity Suit and P1
  (Shub-Niggurath/Cosmos) one card short of theirs; both contribute
  their one missing-adjacent filler card to the same trick (P3 wins it
  with an ordinary lead card, deliberately avoiding the Ace/`hasTen`
  scoring rule so the trick's winner is unambiguous); P3 then
  redistributes back each one's actual missing card in the same
  `redistribute()` call. Result:
  `{"team":null,"reason":"stalemate","detail":"Stalemate: P0 (Cthulhu)
  and P1 (Shub-Niggurath) each completed a Deity Suit in the same
  redistribution, on opposing Teams."}` - exactly right.
- **Single completer (regression)**: same setup, but P1's missing card
  is deliberately *not* redistributed to them this time (confirmed via
  an explicit post-check that P1's hand still lacks it). Result:
  `{"team":"Chaos","reason":"suit","detail":"P0 collected all 10
  Cthulhu cards."}` - confirms the ordinary single-winner case still
  works correctly after the rewrite.

Both scenarios also asserted `state.winner === null` right after the
4th play (before redistribution) to confirm collection alone didn't
prematurely end the game in *these* particular constructions (see
Area 8's second finding above for why that assertion isn't
automatically true in general). Not separately exercised: two
same-Team players completing simultaneously (GDD: "If all players who
completed... belong to the same Team, that Team wins," not a
stalemate) - the code path for this is `teams.size === 1` with
`completers.length === 2`, identical in structure to the already-
verified `completers.length === 1` case (same `Set`/destructure/join
logic, just iterating one more array element) - reasoned about via
code review rather than exercised by a dedicated scenario, noted here
explicitly rather than left unstated.

## Key technical decisions

- **Fixed exactly the one area the task named, reported everything
  else.** Two other confirmed, GDD-unambiguous engine bugs turned up
  during the audit (Area 5's Ace-ordering rule, Area 8's second finding
  about `advanceBlocker`'s premature check). Both are real and would
  change actual game outcomes, which is exactly why they're *not*
  bundled into this same PR without being asked - "small, single-
  purpose PR" and getting real game-logic changes properly verified
  one at a time, the same discipline this task itself asked for on
  Area 8.
- **`checkSuitCompletion()` was the only place that needed to change.**
  Both call sites already just check `if (win) { ...return gameOver...
  }` generically - neither needed to know *how* a win/stalemate was
  determined, so widening the function's own internal logic was a
  fully self-contained fix with no ripple effects, confirmed by the
  typecheck passing with zero other file changes needed.

## Open questions

None on the Area 8 fix itself - the GDD was unambiguous and the fix
was verified directly. Two things from the audit are genuine decisions
for the user, not implementation questions:
- Should the Rules modal gain a Setup section (Area 1) and/or an
  off-suit-is-facedown clause (Area 4)? Both are additions, not
  corrections of something stated wrong, so left to a decision rather
  than assumed.
- Which of the two newly-found bugs (Area 5 Ace-ordering, Area 8's
  premature-check timing) to prioritize as follow-up work, and in what
  order - both are real and independent of each other.

## Known issues

- **Area 5: Ace-vs-10 ordering isn't implemented** (see full
  write-up above). High priority - this can produce a wrong trick
  winner in real play, which cascades into wrong redistribution and
  wrong next-leader. Worth its own task with careful handling of edge
  cases the GDD doesn't fully spell out (multiple 10s in one trick, an
  Ace inside a Double).
- **Area 8: `advanceBlocker()`'s premature `checkSuitCompletion()`
  call** (see full write-up above) - checks for victory before
  redistribution/the 10-cards-all invariant is restored, contradicting
  GDD's explicit check-timing rule. Worth its own task to decide
  whether the early check can simply be removed.
- **Area 1 / Area 4: Rules-modal gaps** (no Setup section; off-suit
  Singles' facedown/hidden-identity nature unstated) - lower urgency,
  content-only.
- **Area 10: facedown-card masking leak in `host/mask.ts`** - still
  present, still separately tracked, not touched here (per this task's
  own instruction).
- Carried over, still true, untouched by this task: no card-back art
  yet; the bottom HUD name tag can wrap for a long real name.

## Next proposed step

Two confirmed engine bugs (Ace-ordering, premature win-check timing)
are ready to be filed as follow-up tasks whenever wanted - both are
well-scoped from this audit's write-up above. The two Rules-modal
content gaps are lower-priority and more a product decision than a
bug fix.
