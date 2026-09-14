## Current milestone

Tutorial Scene 5: Off-suit (facedown). A new forced scenario (black-out/
in cut) that keeps the same narrative lineage as every prior scene, and
resolves the open question Scene 4's own report flagged: whether the
existing `{ kind: 'handCard' }` lock/pointer cleanly covers a facedown
confirm, or whether the still-reserved `actionButton` variant is
actually needed. Traced the real flow and confirmed via Playwright:
**`{ kind: 'handCard' }` covers it completely - no new variant was
needed.**

## What was implemented

**Scene 5's script (`tutorial/tutorialScenes.ts`):** `TUTORIAL_SCENE_5`
keeps `leaderId: 1` (local player last to act, same shape as Scenes 1
and 4) and `trickNumber: 5` (continuing the narrative, sidestepping
`isForcedTrick1Opener` same as every prior scene). The local player's
3-card hand (Nyarlathotep-2, ShubNiggurath-5, YogSothoth-9) is
deliberately: (a) genuinely off-suit - zero Cthulhu cards, the real
required suit at position 3 under this exact Suit Cycle shape - and
(b) three DIFFERENT ranks, so no two cards can ever form a Double.
Confirmed via the real `ui/handLegality.ts`'s `computeHandLegality`
(not eyeballed): `rules/engine.ts`'s `legalOptions` returns
`mustPlaySuit: null` and `doubleRanks: []` for this exact hand against
`requiredSuit: 'Cthulhu'`, which routes `computeHandLegality` into its
off-suit branch with `facedownSingle` as the only playType this hand
can ever produce - no 'partner' state ever appears for any card.

Three `auto` steps (ShubNiggurath-4, Nyarlathotep-6, YogSothoth-8) play
out first, same pattern as every prior scene's pre-turn plays, before
one `TutorialWaitStep` teaches the facedown play itself. The scripted
card is ShubNiggurath-5 - deliberately neither the local player's own
god (Nyarlathotep) nor their ally's (Cthulhu), so nothing about the
choice reads as thematically special; any of the 3 hand cards would
have been an equally legal facedown play. The scene ends once the
facedown card is committed - no need to play the trick out to
resolution, mirroring Scenes 3-4's own precedent. `TutorialScene.finishScene()`
needed no changes to pick this up.

## Investigation: which TutorialLock shape does a facedown confirm need?

Traced the real off-suit/facedown flow end to end rather than assuming
either way (per this task's own explicit ask, and Scene 4's own report
flagging this as the next open question):

- **Before any card is selected**, `computeHandLegality`'s off-suit
  branch marks *every* hand card `'legal'` (any card could, in
  principle, turn out to have a same-rank partner) - a materially wider
  starting pool than the play-phase branch's already-narrowed
  suit-matching pool Scenes 1/3/4 lock against. `applyTutorialLock`
  forcing every card but the one scripted `lockedCardId` to `'illegal'`
  narrows this exactly the same way regardless of how wide the starting
  pool was - same mechanism, same effect.
- **Once that one card is tapped** and becomes `view.selectedCards[0]`,
  the next render re-runs `computeHandLegality` fresh (now
  `selected.length === 1`) and `applyTutorialLock` reapplies: the locked
  card's own real state (`'selected'`, since it matches `selected[0]`)
  passes through untouched, and since this hand has no matching-rank
  card anywhere, every other card was *already* going to end up
  non-`'partner'`/effectively locked-out regardless - the tutorial lock
  and the hand's own natural shape reinforce each other rather than
  conflicting.
- **The action button itself never needed any tutorial-specific
  wiring.** `computeActionButtonState` already reads `legality.playType`/
  `onClick` completely generically - the same "Facedown Card" label and
  real `{ action: 'playCard', playType: 'facedownSingle', cards }`
  dispatch every other scene's own action button already produces for
  its own playType, just with a different label string.

**Conclusion, confirmed via real-gameplay Playwright verification (not
just this trace): `{ kind: 'handCard' }` + `applyTutorialLock` covers a
facedown confirm completely.** The still-reserved `actionButton`
`TutorialLock`/`GuidePointerTarget` variant was not implemented - there
was nothing left for it to do here. Verified directly:
- Before selection: real legality reports `playType: null`, but the
  hand-entry dump shows only ShubNiggurath-5 as `'legal'`, the other 2
  cards `'illegal'` - the hard-lock narrowing an otherwise-wide-open
  moment down to exactly one, same as every prior scene.
- A wrong-card tap (Nyarlathotep-2) is fully inert - no selection
  registers, the action button stays disabled.
- After selecting the correct card: real legality reports
  `playType: 'facedownSingle'`, no card anywhere shows `'partner'`, and
  the action button reads "Facedown Card / Commit the chosen card" -
  all driven by the real, unmodified `computeHandLegality`/
  `computeActionButtonState`.

## Masking confirmed real, not assumed

This is the first tutorial scene to ever produce an `offsuit`-kind
play at all (every prior scene's auto-plays were deliberately real
suit-matching `'normal'` plays, avoiding the masking question
entirely). Confirmed via a temporary debug hook (removed before
commit) exposing the real `state.currentTrick` right after the local
player's facedown commit: their own play shows `kind: "offsuit"` in
the actual game state - the exact classification `ui/renderGameView.ts`'s
existing `maskedPlayFaces` already branches on
(`play.kind === 'offsuit' && play.player !== yourSlot`) to decide
whether to hide a play's real identity. Since that masking function is
itself unchanged, pre-existing, and already exercised for real
multiplayer games, confirming the play's real `kind` is correctly
`'offsuit'` is sufficient to guarantee it would render as genuinely
facedown (card_back-equivalent) to any other real viewer - this
tutorial's single-client architecture always renders from the local
player's own perspective, where `maskedPlayFaces` deliberately shows
your *own* play plainly (there's no privacy concern in seeing your own
card), so the local player's own screen correctly shows the real
ShubNiggurath-5 art rather than a card-back - confirmed via screenshot,
this is the expected, correct behavior, not a masking failure.

## Bugs found and fixed during verification

None. Every real behavior (the off-suit state machine, the hard-lock,
the action button, and the real `kind: 'offsuit'` classification)
worked correctly on the first real-gameplay pass.

## Key technical decisions

- Kept the local hand to exactly 3 cards (down from Scene 4's 4) -
  the minimum needed to make "genuinely no possible Double" easy to
  verify by inspection (3 distinct ranks) while still giving the
  hard-lock something real to narrow down from.
- Deliberately picked a scripted card (ShubNiggurath-5) that matches
  neither the local player's own god nor their ally's, so the choice
  reads as arbitrary rather than thematically loaded - reinforcing the
  lesson's own point that any off-suit card would have worked.

## What's general vs. Scene-5-specific (for a later scene)

**General, reusable as-is (confirmed, not just assumed):**
- `{ kind: 'handCard' }`/`applyTutorialLock` now confirmed to work
  identically well across every hand-legality branch this project
  has (leading, required-suit-follow, and now off-suit/facedown) -
  a future scene needing to hard-lock a single card commit, regardless
  of which legality branch produces it, needs no new infrastructure.
- The `actionButton` `TutorialLock`/`GuidePointerTarget` variant
  remains genuinely unimplemented and, per this task's own
  investigation, is NOT needed for any single-card-commit moment - it
  would only make sense for a guided action that isn't really "pick a
  card" at all (a bare confirm with no card selection involved, per
  its own doc comment in `tutorialTypes.ts` - most likely Scene 6's
  delegate-selection confirm, if that turns out to need it).

**Scene-5-specific, won't transfer as-is:**
- `TUTORIAL_SCENE_5`'s own deal (the specific off-suit, no-pair hand)
  is this scene's exact authored content.
- The still-reserved `delegateTo` lock / plain `seat` pointer variants
  remain untouched - Scene 6 (Double, delegate, and winning the game)
  is the design doc's own next place those would actually get used.

## Open questions

None arose that needed asking - this task's own investigation question
(which TutorialLock shape a facedown confirm needs) was fully
resolved by tracing the real code and confirming via Playwright, per
the task's own explicit instruction to investigate rather than assume.

## Known issues

None. Verified via `npm run typecheck`, `npm run build`, and
real-gameplay Playwright runs on the final build: the real legality
computation offers only `facedownSingle` (never a Double) for this
hand, only the correct action is tappable at every stage (a wrong-card
tap is fully inert), the played card genuinely carries `kind: 'offsuit'`
in real game state (confirmed via a temporary debug hook, removed
before commit), and the local player's own screen correctly shows it
plainly (per the pre-existing, correct "you see your own plays"
masking rule) rather than as a false-positive card-back. Console clean
on boot aside from the same pre-existing, unrelated ICE-server fetch
failure present in this sandboxed test environment on plain boot too.

## Next proposed step

Scene 6 is next (per suits-mp-tutorial-design.md's Section 3) - Double,
delegate, and winning the game, the tutorial's final scene. It combines
three concepts in one hand (playing a Double, delegating to a named
ally, and the ally's own scripted redistribution completing the local
player's Deity Suit for real) and triggers the REAL end-game sequence
(Local Victory into the universal Victory Screen, appended with
"Tutorial Complete" per the design doc). This is the first scene likely
to actually need the still-reserved `delegateTo` `TutorialLock` and
`seat` `GuidePointerTarget` variants (for the delegate-selection step)
- worth tracing `chooseDelegate`'s real flow the same way this task
traced the facedown flow before assuming either variant's exact shape
is right.
