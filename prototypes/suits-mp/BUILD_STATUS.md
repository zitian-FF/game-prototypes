## Current milestone

Tutorial Scene 3: The Suit Cycle. Continues directly from Scene 2's real
final state (same local player Deity/hand lineage, same ally) - because
the local player redistributed in Scene 2, they lead the next trick
here, teaching that the lead card's suit sets the Required Suit
sequence for the other three seats.

## What was implemented

**Scene 3's script (`tutorial/tutorialScenes.ts`):** `TUTORIAL_SCENE_3`
reuses `TUTORIAL_SCENE_1.deal`'s hands/gods verbatim (`{ ...TUTORIAL_SCENE_1.deal,
leaderId: 0, trickNumber: 3 }`) - same local 5-card Cthulhu hand, same
ally at slot 1 - but flips `leaderId` from 1 to 0 so the local player
leads instead of following. `trickNumber: 3` (not 1) sidesteps
`isForcedTrick1Opener` the same way Scenes 1-2's `2` did, since trick
1's leader must open with the 2 of Yog-Sothoth specifically.

The script is a **single `TutorialWaitStep`** - no auto steps at all,
since there's nothing to fast-forward through before the lesson. The
local player's real legality, while leading (`state.currentTrick` is
empty), already marks every hand card `'legal'` (see
`handLegality.ts`'s `leading` branch) - leading genuinely has no suit
constraint. Per this project's established hard-lock rule, the single
scripted lead card is still restricted to exactly one via the existing
`{ kind: 'handCard' }` lock/pointer and `applyTutorialLock` (no new
`TutorialLock`/`GuidePointerTarget` variant needed - `handCard` already
covers this scene's one decision point, per the task's own note).
Scripted as **Cthulhu-2**, deliberately the weakest card in the local
hand, not the highest-rank one Scene 1 taught winning with - the lesson
is "any card leads", not "play your best card", and reusing the
strongest card here risked muddying that distinction.

The other three seats' single-card hands are worked out the same way
Scene 1's own Suit Cycle math was: with Cthulhu leading from slot 0
(`turnOrder(0) = [0,1,2,3]`), `requiredSuitForPosition`/`suitAfterSteps`
(rules/engine.ts, rules/cards.ts) give position 1 (slot 1, the ally)
ShubNiggurath, position 2 (slot 2) Nyarlathotep, position 3 (slot 3)
YogSothoth - so their hands hold exactly those suits (ShubNiggurath-4,
Nyarlathotep-6, YogSothoth-8), the same three cards Scenes 1-2's own
deal already used, just shifted one seat over since the leader moved
from slot 1 to slot 0. This scene never scripts their actual follow-up
plays, though - see below.

**The scene deliberately ends after just the lead play** - no trick
win, no redistribution. Per the task's own explicit permission, the
lesson ("the lead suit sets the Required Suit sequence for the other
three seats") is fully conveyed once the wheel updates, which happens
the instant a lead suit is known - there's no need to actually play out
the other three seats' responses to show it. `TutorialScene.finishScene()`
needed **no changes** to pick this up: the script's one step resolves,
`markCompletedIfFinished()` marks Scene 3 done, and the existing
advance-or-fallback logic (added in the Scene 2 task) takes over -
advancing to Scene 4 if it existed, falling back to the completion modal
since it doesn't yet.

## Suit Cycle wheel rotation - confirmed real, no new hook needed

Task requirement 3 asked to *confirm* (not assume) the wheel already
reflects the new lead suit, and report whether any tutorial-specific
hook was needed. **None was needed.** Read `ui/renderGameView.ts`'s
`computeSuitRing` and `dom/overlay/GameOverlay.tsx`'s `leadGodIndex`
handling, then confirmed via real-gameplay Playwright verification
(temporary debug hooks exposing `computeGameOverlayHudState`'s live
`leadGodIndex`, removed before commit):

- **Before any tap:** `leadGodIndex: null` (indeterminate - nobody's
  lead suit is known yet).
- **The instant the locked Cthulhu-2 card is tapped (still just
  selected, not yet committed):** `leadGodIndex` immediately becomes
  `1` (Cthulhu's `GOD_TO_SUIT_INDEX`). This is `computeSuitRing`'s
  existing `previewCardId`/`isLocalPreview` branch - built for the
  *leader's own screen* to preview the lead suit before committing,
  entirely pre-existing, non-tutorial-specific behavior - confirmed by
  screenshot: the center wheel's "LEAD" badge visibly rotates from
  Nyarlathotep's position to Cthulhu's the moment the card is tapped,
  before the Play Card button is even pressed.
- **After committing the play for real:** `leadGodIndex` stays `1`
  (continuous with the preview - no jump), now driven by
  `state.leadSuit`/`state.currentTrick[0]` instead of the preview path,
  and `currentTurnSeat` genuinely advances to the next real position
  (Player 2, awaiting a real ShubNiggurath follow) - confirming this
  scene really did hand off to an ordinary, un-scripted next decision
  point rather than faking a hand-off.

Nothing in `ui/renderGameView.ts` or `dom/overlay/GameOverlay.tsx`
needed to change for this - the wheel was already this reactive to real
game state before this task.

## Key technical decisions

- Kept Scene 3 to exactly one `TutorialWaitStep` with zero `auto` steps
  - the shortest possible script shape the existing types already
    support. No new infrastructure was needed anywhere: the same
    `{ kind: 'handCard' }` lock/pointer, the same `applyTutorialLock`,
    the same `syncPendingWaitForCurrentStep`/`scheduleNextIfAuto`
    sequencing, and the same `finishScene()` advance-or-fallback logic
    all worked unmodified.
- Deliberately did not script the other three seats' own follow-up
  plays after the local lead. The lesson is about the Required Suit
  *sequence being set*, not about watching it get satisfied - the
  wheel alone (already real, see above) carries the whole lesson, and
  the task explicitly permitted ending here.
- Reused `TUTORIAL_SCENE_1.deal`'s `hands`/`gods` via object spread
  rather than retyping them, overriding only the two fields that
  actually differ (`leaderId`, `trickNumber`) - keeps the "same
  lineage" continuity explicit in the code itself, not just in a
  comment.

## Bugs found and fixed during verification

None in the shipped code. One test-script-only false alarm during
authoring, worth recording so it doesn't get mistaken for a real bug if
rediscovered: an early verification script reused a `const c10 = await
handPos('Cthulhu-10')` variable captured all the way back during
Scene 1's own win (where Cthulhu-10 was legitimately `'legal'`) inside
a later `console.log` meant to describe Scene 3's card states - making
it look like Cthulhu-10 was still `'legal'` at Scene 3's wait step, when
a fresh read of the real live state showed only Cthulhu-2 legal, exactly
as scripted. Caught by re-querying live state directly rather than
trusting a stale local variable - same category of test-timing
artifact noted in this prototype's own tutorial-prep task, not a repeat
of it.

## What's general vs. Scene-3-specific (for a later scene)

**General, reusable as-is (confirmed, not just assumed):**
- The Suit Cycle wheel's live-preview-then-real-rotation behavior is
  fully generic game-state-driven behavior, not anything this task
  added - any future scene involving a lead decision gets this for
  free.
- `finishScene()`'s advance-or-fallback logic, `TutorialScene`'s
  `syncPendingWaitForCurrentStep()`/`scheduleNextIfAuto()` sequencing,
  and the `{ kind: 'handCard' }` lock/pointer/`applyTutorialLock` path
  all needed zero changes - confirming (per Scene 2's own prediction)
  that a scene whose only decision point is "play this one hand card"
  is now a fully solved, reusable shape.

**Scene-3-specific, won't transfer as-is:**
- `TUTORIAL_SCENE_3`'s own deal/lead-card choice is this scene's exact
  authored content.
- The still-reserved `delegateTo` lock / plain `seat` pointer variants
  remain untouched - a future double-win/delegate-selection scene is
  still the most likely place those get implemented for real.

## Open questions

None arose that needed asking - the design doc and task instructions
were explicit about the lesson, the lead-card framing ("any legal
lead"), and that this scene doesn't need to end in a trick win.

## Known issues

None. Verified via `npm run typecheck`, `npm run build`, and
real-gameplay Playwright runs on the final build (hard-lock rejecting a
wrong card tap with zero state change, the live wheel preview firing on
selection, the real committed rotation and turn hand-off, scene
completion/checkmark, and the completion-modal fallback since Scene 4
doesn't exist yet) - console clean on boot aside from a pre-existing,
unrelated ICE-server fetch failure present in this sandboxed test
environment on plain boot too.

## Next proposed step

Scene 4 is next (per suits-mp-tutorial-design.md's Section 3) - Powered
Deity Cards. Unlike Scenes 1-3, this one has the player *watch* three
scripted plays resolve first (via the real card-play travel animation)
before a 10 lands and their own Dormant Deity Card transforms (the real
Awakened reveal effect, already built and reused elsewhere - see
`ui/cardArt.ts`'s `playAwakenedEffect`) - then hands control back for
the player to play that now-Powered card and win. This is the first
scene that needs the player to sit through multiple scripted opponent
plays *before* their own guided moment, which today's `auto`/`wait`
step shape already supports (Scenes 1-2 already scripted multiple
`auto` steps ahead of a `wait`) - likely no new step *kind* is needed,
just careful authoring of delays so the reveal reads clearly against
the real animation timing.
