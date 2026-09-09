## Current milestone

Added a fast, natural fly-in animation for the local player's own
card play - hand position to play-area landing, with a quick
scale-punch settle beat on arrival - referencing the snappy
Yu-Gi-Oh Master Duel-style card-play feel the task asked for. Scoped
deliberately to the local player only: other seats' plays still
appear instantly, exactly as before.

## What changed

**Files changed**: `ui/renderGameView.ts` (new `animateOwnPlayIntoPlayArea`,
`PersistentUIState` extended, `renderPlayArea`/`renderPlayerCluster`/
`renderCardFan` threaded to support it), `tune.json` (5 new feel
values). No changes to `ui/cardComponent.ts`/`ui/cardFan.ts` - both
reused exactly as they already were.

- **Capturing the real hand-fan origin**: `renderCardFan` already
  computes each hand card's real `computeFanLayouts`-derived
  `{x, y, rotationDeg}` every render (via its existing `entries`
  array) - this task adds one line caching that into a new
  `PersistentUIState.lastHandLayoutsByCardId: Map<CardId, {x,y,rotationDeg}>`,
  unconditionally, on every render. Since `renderPlayerCluster` (and
  therefore `renderPlayArea`) already runs *before* `renderCardFan` in
  the same render pass (see `renderWithView`'s call order, unchanged),
  a card that just left the hand is looked up in the map as it stood
  at the *previous* render - i.e. exactly where it was in the fan the
  moment before it was played, not a guessed or recomputed point.
- **Detecting "this specific play just appeared"**: a new
  `PersistentUIState.animatedOwnPlayKey` fingerprint
  (`${play.player}:${play.cards.join(',')}`) - `renderPlayArea` only
  triggers the fly-in on the one render where the local player's own
  `currentTrick` entry's fingerprint differs from the last one it
  animated; every other render of an already-landed play (including
  the trick-result dwell hold's own frozen re-render from the prior
  task) falls through to the ordinary, static `drawCardRow` untouched.
  Resets to `''` whenever the local seat's play area goes back to
  empty (between tricks), so the next real trick's play is always
  detected fresh.
- **`animateOwnPlayIntoPlayArea`**: for each face in the local
  player's fresh play (1 card normally, 2 for a Twin Awakening
  double - each animates independently to its own final row
  position), draws the card via the unmodified `drawCard` at its
  captured hand origin (position *and* rotation - the fan's tilt
  animates out to upright over the same travel tween, rather than
  snapping instantly, since starting rotation was the one thing the
  task's origin requirement didn't explicitly forbid animating and
  leaving it static looked like a jump-cut), calls
  `container.bringToTop(...)` so it renders above every other element
  already added this pass while mid-flight, then runs one Phaser tween
  (`x`/`y`/`rotation` to the exact final values `renderPlayArea`
  always used) followed by a second scale tween (`scaleX`/`scaleY` up
  to a punch peak and back down via `yoyo: true`) chained in its
  `onComplete` - fast decelerating travel into a snappy little impact
  bounce, not a float or a linear slide. A card with no captured
  origin (not expected for a genuine local play, but a safe fallback
  for e.g. a page reload mid-trick) lands directly with no animation,
  same as any other seat's play.
- Once both tweens finish, the card sits at exactly the same
  `x`/`y`/`rotation`/size `renderPlayArea` already placed it at before
  this task - this only changes the transition *into* that position.
- **Scope boundary, by construction, not just convention**: only
  `renderPlayArea`'s call for `pid === state.yourSlot` ever reads
  `animatedOwnPlayKey`/calls `animateOwnPlayIntoPlayArea` - every other
  seat's play always takes the original, unmodified `drawCardRow` path
  with zero new code in between. There's no shared "animate this
  play" flag either seat could accidentally trip.
- **`tune.json`**: `cardPlayTravelMs: 160`, `cardPlayTravelEase:
  "Cubic.easeOut"` (fast, decelerating into the landing spot - not
  linear), `cardPlayPunchMs: 90`, `cardPlayPunchScale: 1.12`,
  `cardPlayPunchEase: "Sine.easeInOut"` (the up-then-back-down punch,
  `yoyo: true` doubles this to ~180ms total) - five small, independent
  values so duration/easing/punch strength can each be retuned without
  touching the others. All five bind automatically to the existing
  generic `?debug=1` Tweakpane panel, same as every other tune value -
  confirmed live.

## How this was verified

Real gameplay, not fabricated/injected state, per the pattern
established across the last several tasks in this feature area:

- `npm run typecheck` / `npm run build` (repo root) - clean.
- Confirmed all five new keys appear as live-editable Tweakpane fields
  under `?debug=1`.
- Two temporary, read-only debug hooks (`HostGameScene.ts` exposing its
  own last-built real `MaskedState`; `main.ts` exposing that plus a
  real-legal-card click-target helper and direct access to the scene
  object - same pattern as prior tasks) - added, used, then fully
  reverted; `git diff` against `main` is empty except
  `ui/renderGameView.ts` and `tune.json`.
- **Verified the actual running Phaser tweens, not just the code path**:
  this animation is the *only* thing in this codebase that uses
  `scene.tweens` at all (confirmed via a full-source grep before
  relying on this), so `scene.tweens.getTweens()` - a real, un-modified
  Phaser API, not a test-only hook - unambiguously identifies this
  animation whenever it's running. A Playwright script played a real
  Single Player game and, the moment a real "Play Card" tap committed
  the local player's own card:
  - Polled `getTweens()` every 20ms. Samples show the position tween
    completing at exactly `(195, 453)` - `renderPlayArea`'s real,
    unmodified `seatCenter('bottom')` landing spot for a single-card
    play - followed by several consecutive samples showing `scaleX`
    ramping up through `1.068 -> 1.12` (the exact configured
    `cardPlayPunchScale` peak) and back down to `1.04` before settling,
    then `getTweens().length` returning to `0` - real, live,
    multi-frame proof of both the travel and the punch actually
    running, not just declared in config.
  - The origin sample matched the card's real fan position
    (`(210.7, 648.3)`, in the fan's baseline-Y neighborhood), not a
    guessed point.
  - Screenshotted the settled result: the local player's card sits in
    its normal bottom play-area slot, pixel-identical to how an
    unanimated play has always looked.
  - **Scope boundary, explicitly checked, not assumed**: the moment a
    bot's play landed (a different seat, `p2`), immediately queried
    `getTweens().length` - **0**, confirming zero animation for a
    remote seat's play, the same instant it appears, exactly as
    before this task.
- Browser console clean on boot (only the pre-existing, unrelated
  sandboxed Google Fonts network noise present on every boot in this
  environment) - both with the temporary debug hooks in place and
  after reverting them.

**This change benefits from the user's own live verification on a
real device, same as the Center HUD rotation-easing task.** The
Phaser-tween sampling above proves the travel lands at the exact
right pixel and the punch peaks at the exact configured scale, but
"does 160ms of travel plus a 1.12x punch actually read as snappy and
impactful, Master-Duel-style, on a real phone" is a feel judgment this
automated check can't make - the five `cardPlay*` Tweakpane fields
under `?debug=1` are there to retune live if the numbers don't land
right on first look.

## Open questions

None new - the task's own scope boundary (local player only) and
animation requirements (fast, eased, a punch/overshoot on arrival, no
DOM/CSS) were specific enough that no mid-session clarification was
needed.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); `ui_player_nameplate.png` still applies to the local seat
tag only (deliberate); the `'partner'` hand-fan state still has no
working visual differentiation from `'legal'`; the itch.io iframe
canvas-scale fix, the asset pipeline's downscale/recompress output, the
hand-fan edge-bound fix, the Center HUD easing curve, and now this
card-play animation's feel all still want a real-device/live-deploy
glance; a Twin Awakening double-card play's own animation (two cards
animating independently from two different hand positions to their
shared row) was implemented but not separately exercised this pass -
the driver script only ever committed single-card plays, since
reliably forcing a real double-selection through bot-driven gameplay
wasn't attempted; the code path is the same per-card loop used for the
already-verified single-card case, just run twice, so this is a
reasonable-confidence gap, not an unknown.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the next open loop - the animation feel specifically,
and a live look at a real Twin Awakening double-play's two-card
animation, would be the highest-value additions to this task's own
follow-up.
