## Current milestone

Tutorial mode, Part 1: foundation (scripted-scenario system, hard-lock
gate, guide pointer, scene transition) plus Scene 0 (intro overlay) and
Scene 1 (winning a trick). Scenes 2-6 (suits-mp-tutorial-design.md,
Section 3) are explicitly out of scope for this task.

## What was implemented

- **Menu entry point**: a "Tutorial" option on the Landing screen, below
  "Single Player," following the exact same no-networking pattern
  (`lobbyUiStore.ts`'s `showLanding` gained an `onTutorial` callback
  alongside `onSinglePlayer`; `LandingScene` wires it straight to
  `scene.start('Tutorial')` - no room code, no TURN fetch, no Trystero
  call).
- **Scripted-scenario system** (`tutorial/tutorialTypes.ts`,
  `tutorial/tutorialScenes.ts`): a `TutorialScript` extends the existing
  `ForcedDeal` (unchanged) with a `steps` sequence of either `auto`
  (a scripted remote seat's action, applied after a real delay) or `wait`
  (blocks for one specific local player action). `TutorialScene.ts`
  drives this exactly the way `HostGameScene` drives a real game: one
  `GameState`, every action - scripted-remote or local - applied through
  the same `host/gameHost.ts` `applyAction()` a real peer's action goes
  through, rendered via the same `buildMaskedState`/`presentGameView`
  pipeline. No separate/simplified tutorial rendering path exists
  anywhere.
- **Hard-lock gate** (`ui/renderGameView.ts`'s `applyTutorialLock`): a
  small post-processing step over the real, already-computed
  `computeHandLegality()` result - every card the real system marked
  legal/selected/partner is forced to `'illegal'` unless it's the one
  hard-locked card. This piggybacks on the hand fan's *existing*
  `illegal` treatment (dimmed + non-tappable, via `renderCardFan`'s
  `canTapPlay` check), so no new disable/grey-out mechanism was built -
  the real legality system still runs underneath, exactly as the brief
  asked.
- **Guide pointer** (`tutorial/guidePointer.ts`): a placeholder procedural
  triangle with a repeating bounce tween, all timing/size/color in
  `tune.json`. Positioned via a small `GuidePointerTarget` union resolved
  inside `renderWithView` right after `renderCardFan` runs (so
  `ui.lastHandLayoutsByCardId` - a hand card's real screen position - is
  already populated).
- **Scene transition** (`tutorial/sceneTransition.ts`): `cutToBlack`/
  `cutFromBlack`, reusing the same native `camera.fadeOut`/`fadeIn` API
  the real Local Victory sequence already uses for its white fade, just
  black and with its own `tune.tutorialTransitionMs`. Part 1 exercises it
  once, for the Scene 0 -> Scene 1 handoff.
- **Scene 0**: `TutorialIntroModal.tsx`, a dismissible full-screen DOM
  overlay - 4 players/2 hidden teams/goal in plain language, explicitly
  naming Player 2 as this tutorial's ally (matches Scene 1's actual god
  assignments - both on Team Chaos) with a note that a real game hides
  this.
- **Scene 1**: the local player holds several Cthulhu cards (2, 5, 9,
  DeityCard, 10) and is last to act; three scripted remote seats auto-play
  first with real per-play delays; the guide pointer indicates the 10;
  every other hand card (all of them genuinely legal follows under the
  real rules) is hard-locked out. Confirming the 10 runs the real
  `resolveTrick`/rank comparison - nothing about the outcome is faked.
- A `TutorialCompleteModal.tsx` (reusing the exact Back to Menu button
  styling `VictoryModal.tsx` already established) covers the screen once
  Scene 1's trick resolves and the real trick-result dwell has had time
  to play out, since Scenes 2-6 (which would normally follow - the
  player's own real redistribution) aren't built yet. `hideGameOverlay()`
  is called first, matching the same step the real Local Victory sequence
  already takes before covering the HUD.

## Key technical decisions / bugs found and fixed during verification

- **The Suit Cycle rotates the required suit per trick *position*, not
  per lead suit** (`rules/cards.ts`'s `suitAfterSteps`,
  `rules/engine.ts`'s `requiredSuitForPosition`) - each of the 4 seats in
  a trick is required to follow a *different* god, cycling from whatever
  the leader played. This was a genuine misunderstanding caught only by
  watching the scripted scene actually play: an earlier version of
  Scene 1's script had all 3 remote seats hold Cthulhu cards (matching
  the leader's own suit), which real-gameplay Playwright verification
  showed rendering as masked, face-down "off-suit" plays instead of the
  intended real follows - since none of those seats' *positions* actually
  required Cthulhu. Fixed by leading with a ShubNiggurath card
  specifically (3 steps around the cycle from Cthulhu, so the local
  player's own position lands back on Cthulhu) and giving each remote
  seat the god its own position actually requires
  (Nyarlathotep/YogSothoth/YogSothoth... see tutorialScenes.ts's own
  comment for the worked-through math). Rank is still compared uniformly
  across all 4 plays regardless of each one's own suit (`scoreOf` only
  reads rank), so "highest rank wins" reads correctly once each play is a
  real, suit-matching follow.
- **The DOM overlay wrapper defaults to `pointer-events: none`**
  (`mountDom.tsx`) - every full-screen modal must opt back in explicitly
  per element. `TutorialIntroModal`/`TutorialCompleteModal` initially
  didn't, so a tap meant to dismiss/confirm silently passed through to
  the canvas underneath (caught immediately by the Playwright
  verification below - a real click never landed). Fixed by adding
  `pointerEvents: 'auto'` to each modal's outer div, matching
  `RulesModal`'s own scrim.
- **`initGame()`'s forced-deal path needs its own `settleAutoPhases()`
  call** - `initGame` returns `phase: 'blocker'` even for a forced deal
  (real games only ever see this via `createInitialState()`, which
  already wraps it); `TutorialScene` builds `GameState` directly and had
  skipped this, so the very first scripted remote play was rejected as
  "not this player's turn" until fixed.
- The Tutorial's own separate `dom/tutorial/tutorialUiStore.ts` mirrors
  `domUiStore.ts`'s bridge pattern rather than growing that file - the
  same separation `dom/lobby/lobbyUiStore.ts` and
  `dom/overlay/gameOverlayStore.ts` already use for their own concerns.

## What's general vs. Scene-1-specific (per this task's own request)

**Built generally, ready for Scenes 2-6 as-is:**
- The scripted-scenario step sequence (`auto`/`wait`), `TutorialScene`'s
  driver loop, the hard-lock gate, the guide pointer's `handCard`
  resolution, and the black-out/in transition all work for any scene, not
  just a single trick.
- `TutorialLock`/`GuidePointerTarget` are already typed as unions covering
  `redistributeTo`/`delegateTo`/`actionButton`/`seat` variants (Scenes
  2/3/6 will need these), even though only `handCard` is resolved to a
  real screen position or hard-lock behavior today - see both types' own
  doc comments in `tutorialTypes.ts`.

**Scene-1-specific shortcuts a later scene will need to revisit:**
- **No non-deck-constrained/fabricated remote data path exists.** Every
  scripted action (local or remote) goes through the real
  `applyAction()`, which validates hand membership and required-suit
  legality identically for every seat - there is no bypass for genuinely
  invalid/fabricated cards the design doc's Section 1.2 explicitly
  permits for remote seats. Scene 1 didn't need that latitude (its remote
  plays are ordinary legal follows once the Suit Cycle math above is
  right), but Scenes 4/5/6 (a scripted 10 landing to power a Deity Card,
  a hand engineered to lack a Double, an ally "redistributing" back
  exactly 2 needed cards) may need one. Whoever builds those should
  decide then whether a direct-state-mutation bypass is worth adding, or
  whether continuing to construct fully valid `ForcedDeal`s (as Scene 1
  does) stays sufficient.
- **`TutorialScene.finishScene()` is a dead end, not a "load the next
  scene" hook.** It shows a one-off completion modal and returns to
  Landing. The first follow-up scene brief should replace this with
  advancing `this.script`/`this.stepIndex` to the next scene's own
  `ForcedDeal` (via `cutToBlack`/`cutFromBlack`), not extend the
  completion modal.
- `TutorialLessonBanner` only ever shows one static string per step - no
  design decision was made about staged/sequential lesson text within a
  single step, since Scene 1 didn't need it.
- Redistribution/delegate-selection guide-pointer and hard-lock target
  resolution (`seat`, `redistributeTo`, `delegateTo`, `actionButton`) are
  typed but not implemented - see the "Built generally" note above.

## Open questions

None arose that needed asking - the design doc and this task's own brief
were self-contained for the scope of Part 1.

## Known issues

None found beyond the three bugs already listed above (Suit Cycle
mismatch, pointer-events, missing settleAutoPhases), all fixed and
re-verified via real-gameplay Playwright runs on the final build.

## Next proposed step

Scope Scene 2 (Redistribution) as its own follow-up task: it's the first
scene to exercise the `redistributeTo` hard-lock/pointer variants this
foundation typed but didn't implement, and the first to need
`TutorialScene.finishScene()` replaced with a real "advance to the next
scene" transition instead of ending the tutorial.
