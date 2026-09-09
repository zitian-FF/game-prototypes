## Current milestone

Fixed the hand fan so the outermost cards' actual rendered edges (the
real rotated-rectangle bounding box, not just where their centers sit)
always stay on-screen, for every hand size - including the case that
motivated this task, a trick winner's hand temporarily inflated by a
collected trick during redistribution.

## What was implemented

**This was a real, pre-existing bug, not just an edge case.** Before
this fix, `computeFanLayouts`'s `maxSpreadDeg` only bounded where card
*centers* sat; it never accounted for a tilted card's own width/height
projecting further sideways than its center. Measuring the actual tuned
values against the real 390px screen width showed the **normal
10-card starting hand already overflowed by ~34px on each side** (with
zero margin) - not just larger, redistribution-inflated hands. Confirmed
this both by direct calculation from the shipped formulas and by
screenshotting the real Single Player boot before this fix (a fresh
10-card hand's outer cards were pushed off both edges of the canvas).

**Files changed**: `ui/cardFan.ts`, `ui/renderGameView.ts`, `tune.json`.

- **`ui/cardFan.ts`** - added two new exports, `computeFanLayout`/
  `computeFanLayouts` themselves are unchanged:
  - `rotatedHalfWidth(cardWidth, cardHeight, rotationDeg)`: the real
    formula for a rotated rectangle's own axis-aligned bounding-box
    half-width - `(cardWidth/2)*|cos(angle)| + (cardHeight/2)*|sin(angle)|`.
  - `computeFanScale(count, pivotX, config, bounds)`: returns a single
    scale factor (<=1) to apply to **both** `radius` and the card's own
    display size together, sized so the outermost card's real edge lands
    at or inside `bounds.edgeMarginPx` from the screen edge. Scaling
    radius and card size *together* (rather than either alone, or the
    spread angle) reads as the whole fan "zooming out" as the hand grows
    - cards sit closer together AND get a little smaller - rather than
    flattening the arc's shape or shrinking cards out of proportion to
    their own spacing. It's a pure no-op (`1`) whenever the base
    (tune.json) config already fits a given count, so a hand size that
    was already safe renders completely unchanged - it only ever
    compacts, never enlarges.
- **`ui/renderGameView.ts`**'s `renderCardFan` now: computes `fanScale`
  via `computeFanScale` (using a **worst-case card footprint** -
  `cardWidth`/`cardHeight` pre-multiplied by `tune.handFanPopOutScale` -
  since any card in the fan, including an outermost one, can end up
  selected/popped-out, and the invariant has to hold for that case too,
  not just resting cards); builds a `scaledFanConfig` (radius scaled) for
  `computeFanLayouts`'s position math; and draws every card at
  `scaledDims` (width/height/fontSize all scaled) instead of the fixed
  `CARD_DIMS_STANDARD`, with the existing pop-out multiplier layered on
  top of that for selected cards exactly as before. Also fixed a subtle
  bug this introduced: the fan's pivot Y must be offset by the *scaled*
  radius, not the base tune.json radius, or the whole fan would jump up/
  down by the scale difference instead of compacting in place around the
  same baseline.
- **`tune.json`**: added `handFanEdgeMarginPx: 10` - the only new tunable
  value needed. `handFanPerCardStepDeg`/`handFanMaxSpreadDeg`/
  `handFanRadius`/`cardStandardWidth`/`cardStandardHeight` all stay as
  fixed base values in tune.json, exactly as the house rule asks - the
  new scaling logic is layered on top of them at render time rather than
  replacing them with per-count values.

## How this was verified

No test runner exists anywhere in this repo yet (no vitest/jest, no
existing `*.test.ts` files) - `cardFan.ts` had no unit tests to extend,
so per the task's own conditional instruction this relied on direct
numeric verification instead of adding a new test framework unprompted
(root CLAUDE.md: stack is fixed, ask before adding a dependency).

- `npm run typecheck` (repo root) - clean.
- `npm run build` (repo root) - clean.
- **Exact-formula check against the real shipped code** (via `tsx`,
  already available, no new dependency): imported the actual
  `ui/cardFan.ts` module and the real `tune.json` values directly (not a
  hand-copied re-implementation) and checked the edge-bound invariant,
  including the worst-case popped-out card, for every hand size 1
  through 20. **All 20 passed** - scale is `1.000` (no change) through
  count 7, mildly compacts from count 8, reaches `0.794` at the normal
  10-card hand, and plateaus at `0.731` from count 11 onward (since
  `maxSpreadDeg` itself saturates there) - so the same guaranteed-fit
  factor automatically covers every larger redistribution-inflated hand
  size too, not just the one tested.
- **Live Playwright verification**, real Single Player boot (no debug
  hooks needed for this part): screenshotted the real starting 10-card
  hand - all cards land comfortably inside the canvas (pixel-measured the
  card band directly: leftmost content at x=20, rightmost at x=369, of a
  390px-wide canvas), console clean (only the pre-existing sandboxed
  Google Fonts noise present on every boot in this environment,
  unrelated to this change).
- **Live Playwright verification, synthetic large hand**: a temporary
  debug hook (`window.__testHandFan` in `main.ts` - added, used, then
  fully reverted; confirmed via `git status`/`git diff` that only
  `cardFan.ts`, `renderGameView.ts`, and `tune.json` remain changed)
  drew synthetic hands through the exact same `computeFanScale`/
  `computeFanLayouts`/`drawCard` functions the real game uses (not a
  reimplementation), reusing the real Single Player scene's
  already-preloaded card art. A synthetic 18-card hand (a plausible
  worst-case redistribution scenario: a 10-card hand plus an 8-card
  trick where all four plays happened to be Twin Awakening pairs)
  rendered fully on-screen with room to spare on both sides, visibly more
  compact than the 10-card fan, and pixel-measured to the same [10, 380]
  bound the math predicted. A synthetic 10-card hand drawn through this
  same debug path matched the real Single Player boot's fan pixel-for-
  pixel in scale, cross-validating the two verification paths against
  each other.

## Open questions

None new. The task's own framing ("hand size grows during
redistribution, making overflow worse at exactly the moment it's most
visible") reads as if the *normal* hand size was already safe and only
redistribution made it unsafe - measurement showed the normal 10-card
hand was already unsafe before this fix, by a wide margin. Flagging this
mainly so it's visible when reconciling back with GPT, not because
anything in BRIEF.md needs to change over it.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); `ui_player_nameplate.png` still applies to the local seat
tag only (deliberate); the `'partner'` hand-fan state still has no
working visual differentiation from `'legal'`; the itch.io iframe
canvas-scale fix and the asset pipeline's downscale/recompress output
still want a real-device/live-deploy glance; this task's fan-scaling fix
has likewise only been checked in a local dev-server Playwright pass
(including a synthetic large-hand scenario, not a live multi-trick
redistribution reached through real bot play), not against an actual
itch.io build or a naturally-occurring redistribution in a full game.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the next open loop, now also covering this task's fan
scaling. If a unit-test runner (e.g. vitest) is ever added to this repo
for other reasons, `cardFan.ts`'s `computeFanScale`/`rotatedHalfWidth`
would be a good first candidate for a real regression test, since the
invariant they enforce is precisely specified and cheap to check
directly (as this task's `tsx` script already did, ad hoc).
