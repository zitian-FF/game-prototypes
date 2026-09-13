## Current milestone

Tutorial prep: scene selector with checkmarks, a persistent Quit control,
real button styling for Landing's Single Player/Tutorial options, and
mobile text-selection prevention across the DOM overlay. Bundled as one
PR since none of the four parts are individually large; all build on the
Part 1 foundation (TutorialScene, tutorialUiStore.ts,
GuidePointerTarget/TutorialLock types, cutToBlack/cutFromBlack).

## What was implemented

**Scene selector (replaces the canvas "Trick: N / Phase: X" readout,
tutorial sessions only):** `tutorial/tutorialScenes.ts` now exports
`TUTORIAL_SCENES`, a 6-entry array (`TutorialScript | null`) anticipating
the full design doc structure - only index 0 (Scene 1) is built, the
rest are `null` placeholders. `TutorialScene.ts` tracks
`currentSceneIndex` and a `completedScenes` set, builds a
`TutorialSceneMarker[]` every render (`locked`/`current`/`completed`),
and exposes `jumpToScene(sceneNumber)` - tappable only for a scene
that's completed or the one currently in progress (re-running it from
the start), never a scene not yet reached or without a built script.
`dom/tutorial/TutorialTopBar.tsx` renders the markers as real
`<button disabled={...}>` elements (native disabled state, not just a
visual dim) plus a checkmark for completed scenes.

**Quit anytime:** the same `TutorialTopBar` also renders a persistent
Quit button, wired to `TutorialScene.quit()` - hides the game HUD and
calls the exact same `navigateToLandingMenu()` (`scene.start('Landing',
...)`) every other "Back to Menu" action in this codebase already uses,
per this task's own instruction to reuse that pattern rather than build
a new one. `ui/renderGameView.ts` now opens/closes this top bar at the
very start of `renderWithView`, before any of the early-return branches
(Rules/RedistLog/Menu modals, stalemate/Victory) - so it stays reachable
at every point *within* a scene, not just the ordinary hand-fan render
path.

**Real Landing buttons (Part 3):** Single Player and Tutorial now use
the same gradient/clip-path button language as Create Room/Join Room
(a real background, border, and clipped-corner chrome) instead of plain
clickable text - Single Player full-width and 52px tall, Tutorial
visibly smaller (58% width, 34px tall, more subdued color) to read as
the more casual/secondary option of the two.

**Text-selection prevention (Part 4):** `mountDom.tsx`'s DOM overlay
wrapper now sets `user-select: none` (+ vendor prefixes) and
`-webkit-touch-callout: none` once, at the top of the whole overlay
tree - covers every static text/UI element without touching each one
individually. The two real `<input>` elements (LobbyFlow.tsx's
player-name and room-code fields) explicitly restore
`user-select: text` / `-webkit-touch-callout: default` inline, since
those are exactly what this must never apply to.

## Bugs found and fixed during real-gameplay verification

- **The scene selector/Quit bar vanished during the trick-result dwell.**
  `presentGameView`'s multi-beat "hold on the just-completed trick, then
  settle" sequence (frozen render, delayed collect-flight render, final
  settle render) only ever threaded the `tutorial` config into the first
  ("live") of its four internal `renderGameView` calls - the other three
  passed nothing, which made `renderWithView`'s `if (tutorial) {...} else
  closeTutorialTopBar()` gate close the bar during every one of those
  dwell beats. Caught by literally watching it disappear right after the
  winning play in a real Playwright run. Fixed by forwarding `tutorial`
  to all four call sites - safe to do since `lock`/`pointer` only have
  any effect when `turnPhase === 'play'` (never true during the frozen
  dwell state) and `pendingWait` is already null by the time any of
  these fire.
- **A completed scene's marker didn't update in time.** The first
  attempt marked `completedScenes` *after* an extra `render()` call
  triggered by `runNextStep()`, once the script was exhausted. But the
  render that actually detects "a trick just completed" and kicks off
  the dwell is the *first* render (from `onPlayerAction`, before that
  extra call) - by the time the second render ran, `presentGameView`'s
  `ui.pendingHoldMasked` early-return path was already active, so it
  never produced a real draw at all; the checkmark only reached the
  screen whenever some *unrelated* later render happened to fire. Fixed
  by marking completion (`markCompletedIfFinished()`) *before* the one
  render call that will actually trigger the dwell, not after.
- **Jumping to a scene left the previous run's own completion timer
  alive.** Replaying (or jumping into) a scene mid-flight didn't cancel
  the prior run's pending `scene.time.delayedCall` (either an in-flight
  auto-step delay or the post-completion delay before `finishScene()`),
  so a stale timer could fire partway through the new run and wrongly
  show the completion modal over an in-progress replay. Caught via a
  real Playwright run reproducing the exact sequence (complete Scene 1,
  immediately jump back into it, watch the modal wrongly interrupt the
  replay a couple seconds later). Fixed by tracking the one outstanding
  timer in `TutorialScene.pendingTimer` and cancelling it at the top of
  `loadScene()`.

## Key technical decisions

- Scene markers are real `<button disabled>` elements, not a div with a
  click handler gated by an `if` - this means the "can't jump ahead"
  rule is enforced at the native HTML/browser level (confirmed via
  Playwright: a plain click on a locked marker times out waiting for an
  enabled element, and only a `force: true` click - explicitly bypassing
  the browser's own actionability check - reaches the handler at all,
  which itself then still no-ops).
- `TUTORIAL_SCENES` (the `null`-padded 6-entry array) and
  `TutorialScene`'s `jumpToScene`/`loadScene`/`completedScenes` machinery
  are the only things a Scene 2 task needs to touch to add a new scene -
  replace one `null` entry with a real `TutorialScript`. The selector,
  lock logic, and jump mechanism itself don't need revisiting.
- Chose to thread the *entire* `TutorialHudConfig` (not just a boolean
  "is tutorial active" flag) into every one of `presentGameView`'s
  internal render calls, rather than inventing a second, narrower
  "always-on" config channel - keeps a single source of truth for what
  the tutorial HUD looks like at any given render, at the small cost of
  `lock`/`pointer` being harmlessly non-null in a couple of render passes
  where they have no effect (see the dwell-render fix above for why
  that's actually safe).

## Open questions

None arose that needed asking - this was self-contained prep work with
a clear, itemized brief.

## Known issues

None beyond the three bugs above, all fixed and re-verified via
real-gameplay Playwright runs on the final build.

## Next proposed step

Scene 2 (Redistribution) is next: replace `TUTORIAL_SCENES[1]`'s `null`
with a real script, and implement the `redistributeTo` hard-lock/pointer
variants (`ui/renderGameView.ts`'s `applyTutorialLock` and the pointer
resolver only branch on `handCard` today - see tutorial/tutorialTypes.ts's
own doc comments on `TutorialLock`/`GuidePointerTarget` for the shapes
already reserved for this). `TutorialScene.finishScene()` will also need
to change from "show the completion modal" to "advance to the next
scene" once a scene after Scene 1 actually exists.
