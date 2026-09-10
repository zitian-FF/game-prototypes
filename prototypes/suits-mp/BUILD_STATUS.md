## Current milestone

Fixed a bug reported from real gameplay: after winning a trick via a
Double, the seat nameplates that should be tappable to pick a delegate
were never actually clickable by a real mouse/touch event, even though
every piece of state and DOM wiring involved was already correct.

## What changed

**Files changed**: `dom/overlay/GameOverlay.tsx` (one style property on
the seat-tag `<button>`). No changes to `rules/engine.ts`,
`host/gameHost.ts`, `host/mask.ts`, or `ui/renderGameView.ts` - the real
state and its computation were never the problem (see root cause below).

- **Root cause**: `GameOverlay.tsx`'s root wrapper (`<div style={{
  position: 'absolute', inset: 0, pointerEvents: 'none' }}>`, near the
  top of the component) is deliberately click-through, so ordinary
  board/canvas taps (card selection, etc.) pass through the DOM chrome
  layer to the Phaser canvas beneath it. Every *other* real interactive
  DOM element in this file (the Sort/Action/Menu/Redistribution-Log
  buttons) explicitly opts back in with its own `pointerEvents: 'auto'`
  - the seat-tag `<button>` (rendered per non-local seat, the only way
  to pick a delegate) never did. It inherited `pointer-events: none`
  from the root wrapper, so a real click or tap at its screen position
  was resolved by the browser to the canvas sitting behind it,
  regardless of the button's own `data-tappable`/`disabled`/`onClick`
  wiring - all of which were already completely correct, exactly as the
  bug report's own static reading suspected.
- **Fix**: added `pointerEvents: delegate.tappable ? 'auto' : 'none'`
  to the seat-tag button's style. Scoped to `delegate.tappable` (rather
  than an unconditional `'auto'`) so a non-tappable seat tag - true for
  the entire game outside the brief selectDelegate window - continues
  to let ordinary board taps in that screen area reach the canvas
  underneath, unchanged from before this fix.
- **Why this wasn't caught by prior tasks' own Playwright verification**:
  every earlier task that needed to drive a delegate pick through this
  same button (the end-of-trick collect-animation task, most recently)
  hit the identical "canvas intercepts pointer events" error from a
  normal coordinate-based Playwright click, including with
  `{force: true}`, and worked around it by invoking the DOM element's
  own `.click()` directly via `page.evaluate()`. That workaround
  bypasses the browser's real pointer-event hit-testing entirely (a
  direct JS `.click()` call fires the element's handlers regardless of
  what's on top of it at that screen position) - so it correctly
  exercised the state/handler logic, but never noticed that a *real*
  mouse or touch event could never reach the button in the first place.
  This bug was real all along; only the test methodology used to reach
  past it obscured it.

## How this was verified

Real gameplay via Playwright (temporary `ForcedDeal`-based debug hooks
in `HostGameScene.ts`/`main.ts`, added and fully reverted before this
PR - `git diff --stat` against `main` confirms only
`dom/overlay/GameOverlay.tsx` changed), reaching an actual Double-win
selectDelegate phase as the local player.

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Reproduced the bug first, before any fix**: forced a deal giving
  the local player a legal Double win. Confirmed live that
  `state.delegateChoices` was correctly non-null
  (`["p1","p2","p3"]`) and `state.currentTurn` correctly named the
  winner (`p0`, local) - state-side, everything the bug report
  suspected as a possible root cause (item 2) was already right.
  Direct DOM inspection of the 'left' seat's tag showed
  `data-tappable="true"`, `disabled: false` (also already correct),
  but `getComputedStyle(...).pointerEvents === 'none'`, and
  `document.elementFromPoint()` at the button's own center resolved to
  the `<canvas>` element, not the button - confirming item 3's
  suspicion precisely. A real, coordinate-based Playwright click
  (`locator.click()`, no `force`, no JS-evaluated bypass) on that seat
  tag timed out with "canvas intercepts pointer events" - the same
  failure a real user's tap would hit.
- **After the fix**: the identical scenario, the identical real
  coordinate-based click - `getComputedStyle(...).pointerEvents` now
  reads `'auto'`, the click succeeds with no error, and the action
  button's label updates to `"Delegate to Player 2Commit the chosen
  card"`, confirming the tap correctly staged `view.delegateChoice`
  (item 4's "is there a distinct confirm step" - yes, confirmed: a
  seat tap only stages the pick locally; the existing action button's
  label/enabled state already correctly reflects "confirm this
  delegate" once one is staged, and was not itself part of the bug).
  Clicking that action button then sent the real `selectDelegate`
  network action and the state transitioned to `turnPhase:
  'redistribute'` with `currentTurn: 'p1'` - exactly the seat that was
  tapped, confirming the full real interaction end-to-end: tap a seat,
  see it stage, confirm/submit, and the real network action fires with
  the correct target.
- Browser console clean on a real, unforced boot into Single Player
  under `?debug=1` (only the pre-existing, unrelated sandboxed network
  noise - `net::ERR_CONNECTION_RESET` / a 404 - present on every boot
  in this environment).
- Visual check: the fix is a pure interactivity change (a CSS property
  with no visible rendering effect) - confirmed no visual difference
  in the seat-tag's appearance before/after.

## Open questions

None - the bug report's own four-point diagnostic structure (check
real state, check for a real-state bug, check for a pointer-blocking
issue, check for a distinct confirm step) mapped directly onto the
actual root cause and its resolution, with no ambiguity requiring a
mid-session decision.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps (no
Setup section, off-suit hidden-identity nature unstated in the copy);
`ui_player_nameplate.png` still applies to the local seat tag only
(deliberate); the `'partner'` hand-fan state still has no working
visual differentiation from `'legal'`; the itch.io iframe canvas-scale
fix, the asset pipeline's downscale/recompress output, the hand-fan
edge-bound fix, the Center HUD easing curve, the trick-result dwell
hold, the card-play arc animation, the Awakened reveal, and the
end-of-trick collect animation all still want a real-device/live-
deploy glance. Also still worth flagging: suits-mp still has no
permanent `?debug=1`-gated `ForcedDeal` hook (unlike the sibling
`suits` prototype's `rules/debugScenarios.ts`) - this is the fifth
task in this feature area to build and tear down its own one-off
version, and the *class* of bug this task found (a real click silently
swallowed by the canvas underneath, invisible to a JS-evaluated-click
test workaround) is a strong argument for that permanent hook also
supporting a "drive it with real coordinate clicks, not JS .click()
bypasses" mode for interactive-element verification specifically,
since the bypass is exactly what let this bug through undetected in
every prior task that exercised this same button.

## Next proposed step

Worth a targeted audit of every other DOM-overlay interactive element
for the same class of bug (missing `pointerEvents: 'auto'` under the
click-through root wrapper) now that one concrete instance has been
found - the redistribution-assignment UI and any other per-seat tap
target introduced since GameOverlay.tsx's original handoff are the
most likely remaining candidates, since they share the same seat-tag-
adjacent layout region as the bug just fixed here.
