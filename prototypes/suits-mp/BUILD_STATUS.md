## Current milestone

Tutorial Scene 2: Redistribution - the first scene to exercise the
`redistributeAssignments` hard-lock/pointer variant. Continues directly
from Scene 1's own established scenario (same deal, same local
Deity/hand lineage, same ally) and teaches the local player's own
post-win redistribution: give one card back to each of the three other
seats. `TutorialScene.finishScene()` now advances to the next scene
when one exists, rather than always ending the tutorial - Scene 2 is
the first scene this applies to.

## What was implemented

**Scene 2's script (`tutorial/tutorialScenes.ts`):** `TUTORIAL_SCENE_2`
reuses `TUTORIAL_SCENE_1.deal` verbatim, but scripts all 4 trick plays -
including the local player's own Cthulhu-10 win - as `auto` steps this
time (Scene 2 isn't re-teaching "highest rank wins", it fast-forwards
through the already-taught win to reach redistribution). Once those 4
auto steps resolve, the real engine has already collected the trick and
moved to the `redistribute` phase on its own (a single win's winner is
immediately their own distributor - no `chooseDelegate` step). One
`TutorialWaitStep` follows, teaching the actual redistribution: give
ShubNiggurath-4 back to Player 2 (p1, the ally), Nyarlathotep-6 to
Player 3 (p2), YogSothoth-8 to Player 4 (p3) - each contributor gets
back exactly the single off-suit filler card they themselves played
this trick, none of which are the local player's own Cthulhu cards, so
the lesson holds: several weak, non-own-suit cards are available to
give away, and the correct assignment gives one to each of the other
three seats. The plan (`SCENE_2_ASSIGNMENTS`) is a single shared
`TutorialRedistributeAssignment[]` constant, read once as `lock` and
once as `pointer` (and mapped into `allowedAction`'s `{toPlayer, cards}`
shape) - one source of truth, not three copies that could drift.

**The `redistributeAssignments` type variant is now real**
(`tutorial/tutorialTypes.ts`): replaces the previously-reserved-but-
unimplemented `redistributeTo` shape (which could only express a single
card/seat pair) with `{ kind: 'redistributeAssignments'; assignments:
TutorialRedistributeAssignment[] }` on both `TutorialLock` and
`GuidePointerTarget` - a whole scripted plan (one entry per real
contributor), not a single target, since the "next correct action"
alternates between a hand card and a seat as the player progresses
through several assignments in one wait step.

**Resolution logic (`ui/renderGameView.ts`):**
- `nextTutorialRedistributeTarget(assignments, assignedIds, stagedId)` -
  resolves live, every render, which of the plan's entries is still
  unassigned, and whether the next correct tap is that entry's card (not
  yet staged) or its seat (already staged). Driven entirely off the
  *real* `view.redistributeAssignment`/`view.selectedCards` the ordinary
  redistribution UI already tracks - never a separate tutorial-only
  progress counter - so it naturally advances as the player actually
  redistributes for real, with no need for `TutorialScene` to observe or
  drive the intermediate multi-tap sequence itself (it only ever sees
  the final dispatched `{action: 'redistribute', assignments}`, exactly
  like Scene 1's single `playCard` dispatch model).
- `applyTutorialRedistributeCardLock(cardState, id, target)` - layers
  onto the real, already-computed `redistributeCardState` the same way
  Scene 1's `applyTutorialLock` layers onto play-phase legality: an
  already-`'illegal'` (assigned) or `'selected'` (staged) card is left
  alone; every other card is forced `'illegal'` unless it's the one
  pending target card. Wired into `renderCardFan`'s existing
  `inRedistributePhase` branch - real disabled state (`canTapRedistribute`
  already gates on `cardState !== 'illegal'`), not just a visual dim.
- Seat-side gating required threading a `tutorial` parameter down through
  `renderPlayerCluster` -> `renderPlayArea` -> `renderRedistributionStack`:
  `renderPlayerCluster` resolves the same target once per render and
  passes down `allowSeatTap` (true unless a tutorial redistribute-lock is
  active and this isn't the one resolved seat), which
  `renderRedistributionStack` uses to gate whether it creates its hit
  rectangle at all - the same "don't make it interactive in the first
  place" enforcement Scene 1's disabled `<button>` scene markers use, not
  a click handler with an `if` guard.
- The guide pointer's `renderWithView` branch resolves the same target a
  third time (card position via the existing
  `ui.lastHandLayoutsByCardId`, or seat position via
  `seatCenter(seatFor(target.toPlayer, state.yourSlot))` - both already
  existed, reused as-is) and points at whichever one is currently
  pending.

**`TutorialScene.finishScene()` now advances scenes** (`scenes/
TutorialScene.ts`): reaching the end of a scene's script advances to
`currentSceneIndex + 1` (same `cutToBlack` -> `loadScene` cut a manual
selector jump already uses) when `TUTORIAL_SCENES[nextIndex]` exists;
falls back to the completion modal - the same one this function always
showed - only when there's no next scene yet (`null` or past the end of
the array). This fallback is what fires after Scene 2 today, since
Scene 3 doesn't exist yet; a later task building Scene 3 replaces the
fallback the same way it replaces the `null` entry, never by touching
this method again beyond that.

**`TutorialCompleteModal.tsx`'s copy is now scene-agnostic:** it
previously hardcoded Scene 1's own lesson recap ("Tutorial: Part 1
Complete... You just won a trick with the highest rank"), which became
actively wrong the moment this same modal became Scene 2's fallback too
(Scene 2 teaches redistribution, not trick-winning). Changed to
"Tutorial: More Coming Soon... You've completed every lesson built so
far" - generic on purpose, since which scene is "last built" keeps
changing as later tasks add more, and this modal's whole purpose is to
be that changing fallback.

## Bugs found and fixed during real-gameplay verification

- **The redistribute lock/pointer/lesson never reached the screen at
  all**, even though `TutorialScene.pendingWait` was set correctly.
  Scene 1's own `wait` step is reached *before* the local player's
  trick-winning play, so it never collided with `presentGameView`'s
  multi-beat trick-result dwell; Scene 2's redistribution `wait` step is
  the first to immediately follow a trick-*completing* step (the
  scripted auto-play of the local player's own winning card). The old
  `runNextStep()` called `render()` once right after applying that
  auto-step (with `pendingWait` still null - this render is what
  actually detects the just-completed trick and starts the dwell), then
  called itself again, which set `pendingWait` and called `render()` a
  *second* time - but by then `presentGameView`'s `ui.pendingHoldMasked`
  early-return path silently swallowed that second call's whole
  `TutorialHudConfig`, including the correct lock/pointer/lesson. Every
  later beat of the dwell replayed with the *first* call's config
  (lock/pointer/lesson all null) instead. Caught via real-gameplay
  Playwright verification - every hand card stayed fully tappable and no
  lesson banner ever appeared - not just reasoned through.

  Fixed by restructuring so `pendingWait` is always resolved for
  whatever step `stepIndex` now points at (`syncPendingWaitForCurrentStep`)
  *before* the one render() call that might observe a trick completion,
  rather than as a follow-up second call - `runNextStep` split into
  `syncPendingWaitForCurrentStep()` (updates `pendingWait`) and
  `scheduleNextIfAuto()` (schedules whatever comes next, given
  `pendingWait` is already in sync), both called from `loadScene`,
  the auto-step timer callback, and `onPlayerAction` in the same
  sync-then-render-once order. This is a general fix, not a Scene-2-
  specific patch: any future scene whose `wait` step immediately follows
  a trick-completing step needs no special-casing, since the ordering
  invariant now always holds.

## Key technical decisions

- Kept Scene 2's whole redistribution teaching moment as **one**
  `TutorialWaitStep`, matching Scene 1's existing per-decision-point
  shape, rather than modeling the 3-assignment sequence as multiple
  scripted steps. The multi-tap progression (stage a card, then tap a
  seat, three times over) is resolved entirely client-side, live, off
  the real UI's own already-tracked staging state - `TutorialScene`
  never needs to know it's mid-sequence, only that the final dispatched
  action either matches `allowedAction` or doesn't.
- `redistributeAssignments`'s `assignments` array order must match the
  real engine's own `redistribution.contributions` order exactly (both
  the type's own doc comment and Scene 2's own comment call this out) -
  `TutorialScene.onPlayerAction` still uses the same plain
  `JSON.stringify` equality check Scene 1 uses, not an order-independent
  one, so getting this order right is load-bearing, not cosmetic.
- Real engine behavior worth documenting since it wasn't obvious from
  the design doc and was only confirmed via Playwright: `advanceBlocker()`
  collects *every* card played this trick into the distributor's hand,
  including the distributor's own winning play - so the local player's
  hand briefly holds all 8 cards (5 original + 3 collected) mid-
  redistribution, and since the winning Cthulhu-10 is never part of
  `contribution` (that explicitly excludes the distributor's own play),
  it's never gifted away either. The local player's hand after Scene 2
  is exactly their original 5-card hand again, unchanged - not "5 minus
  the played 10."
- Seat-tap gating threads a plain `boolean` (`allowSeatTap`) down through
  three function signatures rather than passing the whole `TutorialHudConfig`
  that deep - keeps `renderRedistributionStack` (which has no other
  reason to know about tutorials at all) as close to its pre-existing
  shape as possible.

## What's general vs. Scene-2-specific (for a later scene)

**General, reusable as-is:**
- The `redistributeAssignments` `TutorialLock`/`GuidePointerTarget`
  variant and its whole resolution pipeline
  (`nextTutorialRedistributeTarget`, `applyTutorialRedistributeCardLock`,
  the seat-tap gating threaded through `renderPlayerCluster`/
  `renderPlayArea`/`renderRedistributionStack`, and the pointer branch in
  `renderWithView`) handle any number of assignment entries, in any
  contribution-count shape (a Double win's 2-card gift is unaffected -
  `redistributeCardState`/`renderRedistributionStack`'s own multi-card
  stack handling was untouched). A future scene needing this again only
  needs its own `assignments` array with the right `cardId`/`toPlayer`
  pairs in real contribution order.
- `TutorialScene`'s `syncPendingWaitForCurrentStep()`/
  `scheduleNextIfAuto()` split is now the correct general pattern for
  *any* step sequencing, not just Scene 2's - a future scene doesn't
  need to think about the dwell-race bug this task fixed; it's handled
  underneath regardless of whether a `wait` step happens to follow a
  trick-completing step.
- `finishScene()`'s advance-or-fallback logic needs no changes for Scene
  3: it already checks `TUTORIAL_SCENES[nextIndex]` generically.

**Scene-2-specific, won't transfer as-is:**
- `TUTORIAL_SCENE_2`'s own deal/steps/assignments are this scene's exact
  authored content - a later scene designs its own from scratch, the
  same way Scene 1's Suit Cycle math was worked out by hand.
- The plain `{ kind: 'seat'; slot: NetPlayerId }` `GuidePointerTarget`
  variant is still unimplemented/reserved (Scene 2 only needed the
  `redistributeAssignments` variant, which resolves seat positions
  internally without going through this standalone variant) - a future
  delegate-selection scene (`delegateTo`/`chooseDelegate`) will likely
  need to actually wire this one up.
- `TutorialLock`'s `delegateTo`/`actionButton` variants remain reserved
  shapes only, still untouched by this task.

## Open questions

None arose that needed asking - the brief specified the exact lesson
mapping to design (one weak card per contributor) and the exact
fallback behavior for a not-yet-built next scene, both handled per
those explicit instructions.

## Known issues

None beyond the dwell-race bug above, fixed and re-verified via
real-gameplay Playwright runs on the final build (typecheck, build, and
a full redistribution flow - wrong card, wrong seat, correct sequence,
commit, scene-completion checkmarks, and the completion-modal fallback
all confirmed against the actual rendered/interactive state, not just
the underlying game state).

## Next proposed step

Scene 3 is next (per suits-mp-tutorial-design.md's Section 3) - replace
`TUTORIAL_SCENES[2]`'s `null` with a real script. `finishScene()` needs
no changes to pick it up automatically once it exists; the still-
reserved `delegateTo` lock/`seat` pointer variants are the most likely
next pieces of `tutorialTypes.ts` to actually implement, if Scene 3 (or
whichever scene teaches double-win delegate selection) needs them.
