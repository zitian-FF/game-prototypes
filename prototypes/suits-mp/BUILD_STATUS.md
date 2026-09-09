## Current milestone

Extended the card-play fly-in animation (previously local-player-only)
to all four seats: a higher, genuinely-arced toss motion with a
scale-punch settle on arrival, referencing the Yu-Gi-Oh Master
Duel-style card-play feel. Remote seats now fly in from their
nameplate position instead of appearing instantly; the local player's
origin/behavior is unchanged from the prior task.

## What changed

**Files changed**: `ui/renderGameView.ts` (`animateOwnPlayIntoPlayArea`
renamed to `animateCardPlayIntoPlayArea` and generalized to all seats,
`PersistentUIState` extended, `renderPlayArea`/`renderPlayerCluster`
threaded to support it, new `REMOTE_NAMEPLATE_ORIGIN` constant),
`tune.json` (one new value, one adjusted). No changes to
`ui/cardComponent.ts`/`ui/cardFan.ts`/`host/mask.ts` - all reused
exactly as they already were, which is also why the masking guarantee
below holds structurally, not just by convention.

- **Per-seat animation trigger**: `PersistentUIState.animatedOwnPlayKey`
  (a single string) became `animatedPlayKeyBySeat: Record<NetPlayerId,
  string>` - the same "fingerprint changed since last animated" logic
  as before, just one independent slot per seat instead of one shared
  slot for the local player only. Every seat resets its own slot to
  `''` when that seat's play area returns to empty between tricks.
- **Per-seat origin**: `renderPlayArea` now takes the seat name and
  passes `isOwnSeat ? null : REMOTE_NAMEPLATE_ORIGIN[seat]` into
  `animateCardPlayIntoPlayArea`. `REMOTE_NAMEPLATE_ORIGIN` is a new
  constant (`{top, left, right}`, no `bottom` entry - the local player
  never uses it) whose coordinates are derived from
  `dom/overlay/GameOverlay.tsx`'s own `TOP_TAG_TOP`/`SIDE_TAG_TOP`
  nameplate anchor constants plus roughly half that tag's own height,
  kept in sync by value the same way this file's other row anchors
  already are documented to be. Inside
  `animateCardPlayIntoPlayArea`, `remoteOrigin ?? handOrigin` picks
  the nameplate point for a remote seat or the real captured
  `lastHandLayoutsByCardId` position for the local player, unchanged
  from the prior task; a remote seat's starting rotation is always 0
  (a nameplate has no "tilt" to animate out of, unlike a fanned hand
  card).
- **A genuine arc, not a straight line**: replaced the previous
  `scene.tweens.add({x, y, rotation, ...})` targets-based tween with
  `scene.tweens.addCounter({from: 0, to: 1, ...})` driving a manual
  `onUpdate`. This was a necessary rewrite, not a style choice -
  Phaser's targets-based tweens always interpolate the named
  properties along a straight line between their start and end
  values; easing reshapes *speed over time* along that line, it never
  bends the path itself. `addCounter` instead hands back a single
  eased progress value `t` per frame, which `onUpdate` uses to compute
  `x`/`y` manually: a straight lerp between origin and landing, minus
  `tune.cardPlayArcHeight * Math.sin(Math.PI * t)` on `y` (screen y
  grows downward, so subtracting lifts the card; the `sin` shape rises
  from 0, peaks at the midpoint, and returns to 0, so the card starts
  and lands exactly on the straight-line endpoints and only bulges
  upward in between) - a real toss trajectory. `onComplete` still
  snaps to the exact final `x`/`y`/`rotation` to eliminate any float
  residue from the manual lerp, then chains the same scale-punch tween
  as before.
- **Z-order bug found and fixed (affects the previous task's animation
  too, not just this one's remote seats)**: the original
  `container.bringToTop(drawn.container)` call happened immediately
  inside the animation function, during `renderPlayerCluster`'s own
  pass. But `renderCardFan` (the hand fan) runs *after*
  `renderPlayerCluster` in the same render pass and adds its own new
  children to the same shared container - so any hand-fan card drawn
  afterward would still end up rendered *on top of* an already-flying
  card for its entire flight, violating "must render above other
  elements during flight." This was a latent bug in the prior task's
  local-only animation as well, just never surfaced there because nothing
  else that render pass happened to occupy the same visual moment as
  clearly. Fixed with a new `PersistentUIState.cardsAnimatingThisRender`
  scratch array: `animateCardPlayIntoPlayArea` now pushes the flying
  container here instead of calling `bringToTop` immediately, and
  `renderWithView` drains it (`bringToTop` for real) once, at the very
  end of the whole render pass, after everything else that pass could
  possibly draw - hand fan included - is already in place.
- **Masking correctness during flight**: `renderPlayArea` computes
  `maskedPlayFaces(play, state.yourSlot)` *before* deciding whether to
  animate, exactly as it did before this task - a hidden off-suit
  play is already reduced to a single `{kind: 'facedown'}` face with
  no card id at all by the time the animation function ever sees it.
  The animation draws exactly that face for the entire flight, so
  there is no code path (old or new) by which real Deity/rank art
  could appear mid-flight for a masked play - the same placeholder
  rectangle-and-stripe treatment (`cardComponent.ts`'s `facedown`
  branch) used at rest is used throughout the toss too. No temporary
  or substitute card-back asset was built for this task, per the
  explicit instruction that a real card-back is a future, drop-in
  replacement at that same rendering branch.
- **`tune.json`**: `cardPlayArcHeight: 70` (new - the arc's peak
  height in pixels, clearly higher than a subtle curve, tunable
  independently of everything else). `cardPlayTravelMs` bumped from
  160 to 190 (a slightly longer window felt necessary for a 70px arc
  to read clearly rather than as a blur - still fast/snappy, not a
  float). `cardPlayPunchMs`/`cardPlayPunchScale`/`cardPlayPunchEase`
  unchanged from the prior task. All six bind automatically to the
  existing generic `?debug=1` Tweakpane panel - confirmed live.

## How this was verified

Real gameplay, not fabricated/injected state, per the pattern
established across the last several tasks in this feature area:

- `npm run typecheck` / `npm run build` (repo root) - clean.
- Confirmed all six `cardPlay*` keys appear as live-editable Tweakpane
  fields under `?debug=1`.
- Temporary, read-only debug hooks (`HostGameScene.ts` exposing its
  own last-built real `MaskedState` and container; `main.ts` exposing
  those plus a real-legal-card click-target helper and a real
  redistribute-plan helper - same pattern as prior tasks) were added,
  used, then fully reverted via targeted edits (not a blanket
  `git checkout`, since `HostGameScene.ts` also carries real permanent
  code from an earlier task) - confirmed via `git diff --stat` against
  `main` showing exactly `ui/renderGameView.ts` and `tune.json`
  changed, nothing else.
- A Playwright script played a real Single Player game end-to-end,
  watching for the first genuine occurrence of each of three cases and
  sampling the top-of-container object 8 times (15ms apart) as each
  occurred:
  - **Local player's own play**: landed at exactly `(195, 453)` -
    `renderPlayArea`'s real, unmodified bottom-seat landing spot -
    with real card art visible throughout, matching the always-shown
    local-hand behavior.
  - **A bot/remote seat's face-up play** (`p2`, on-suit): landed at
    exactly `(195, 150)` - the top seat's real landing spot - with
    real Deity/rank art visible throughout, correct for a legal,
    unmasked play.
  - **A bot/remote seat's facedown off-suit play** (`p3`): landed at
    exactly `(332, 305)` - the right seat's real landing spot - with
    **zero** Image-type descendants (`hasImage: false`) across all 8
    samples spanning the entire animation and rest, i.e. never showing
    real art for even one sampled frame. This is the task's CRITICAL
    masking requirement, and it held.
- **Arc shape itself, directly traced**: rather than trust an external
  poller (which raced the click-to-render round trip in an earlier,
  discarded diagnostic attempt - see Known issues below for what that
  looked like and why it was a test artifact, not a bug), a temporary
  `onUpdate` hook pushed the tween's own computed `{t, x, y}` into a
  buffer read back after the animation settled. One real local play's
  trace: at `t≈0.59`, `y≈466.6` versus a straight-line prediction
  between origin and landing of `y≈533.8` at that same `t` - the card
  sat about 67px higher than a direct line would put it (consistent
  with `cardPlayArcHeight: 70` peaking near the midpoint), then
  converged to exactly the final `(195, 453)` by `t=1`. Confirms the
  arc is real, not just declared in code.
- Browser console clean on boot under `?debug=1` (only the
  pre-existing, unrelated sandboxed network noise - `net::ERR_CONNECTION_RESET`
  / a 404 - present on every boot in this environment, unchanged from
  prior tasks) - checked with temporary hooks removed.

**This change benefits from the user's own live verification on a
real device.** The traced tween data proves the arc's shape and
landing pixel are exactly as configured, but "does a 70px arc at 190ms
read as a real toss, Master-Duel-style, on a real phone, for all four
seats" is a feel judgment this automated check can't make - the six
`cardPlay*` Tweakpane fields under `?debug=1` are there to retune live
if the numbers don't land right on first look.

## Open questions

None new - the task's own requirements (arc height as a tunable value,
per-seat origin rules, the masking constraint, continuing to use the
placeholder facedown treatment rather than building a substitute
asset) were specific enough that no mid-session clarification was
needed.

## Known issues

Carried over, mostly untouched by this task: Rules-modal content gaps
(no Setup section, off-suit hidden-identity nature unstated in the
copy); `ui_player_nameplate.png` still applies to the local seat tag
only (deliberate); the `'partner'` hand-fan state still has no working
visual differentiation from `'legal'`; the itch.io iframe canvas-scale
fix, the asset pipeline's downscale/recompress output, the hand-fan
edge-bound fix, the Center HUD easing curve, the trick-result dwell
hold, and now this arc animation's feel all still want a real-device/
live-deploy glance; a Twin Awakening double-card play's own animation
(two cards animating independently to their shared row) uses the same
per-card loop as the already-verified single-card case but wasn't
separately exercised this pass. Also carried over: an early attempt at
directly sampling the arc's mid-flight shape via an external
`requestAnimationFrame` poller produced a misleading "frozen position"
result - it was racing the click's async state-update round trip and,
during that race window, sampled a stale pre-play hand-fan object
instead of the flying card. This was a test-methodology artifact, not
a real bug (resolved by tracing the tween's own values directly
instead, per "How this was verified" above), but is worth remembering
if a future task's own external polling produces a similarly
suspicious frozen reading early in a click-driven state transition.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the next open loop - the arc's height/timing/feel
across all four seats specifically, and a live look at a real Twin
Awakening double-play's animation, would be the highest-value
additions to this task's own follow-up.
