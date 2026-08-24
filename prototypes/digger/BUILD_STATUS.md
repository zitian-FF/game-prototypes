## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, a scrollable
board camera, and localStorage persistence (including offline energy
regen). Placeholder-art swap-ins are underway: the energy bar now uses
the real `ui_ammo` sprite, and this session added a projectile-laser
hit effect firing from the ship to the tapped tile on every successful
damage tap. Fixing the laser's visibility required a camera
render-order fix (see "Key technical decisions") — otherwise unrelated
to this session's actual feature.

## What was implemented

- `prototypes/digger/BRIEF.md`: idle-clicker mining spec — core loop,
  grid/board generation, energy, currency/upgrades, persistence,
  reuse-existing-code constraints, tuning seed values, house-rule
  restatements, out-of-scope list.
- `CLAUDE.md`: a `## Persistence` house-rule section (localStorage-
  only, versioned single-key JSON blob, save on every state-changing
  action, timestamp-based offline-progress pattern), inserted between
  `## Networking` and `## Placeholder-first`. Also updated so
  CI-pass-gated PR auto-merge is the repo-wide default, not just
  mp-base/mp-net.
- `tune.json`: `energyMax` is 31 (was 32) so energy's 32 possible
  values map 1:1 onto the `ui_ammo` sprite's 32 frames — see "Key
  technical decisions" below. **This session**: added `laserFadeMs:
  300`, the projectile laser's fade-out duration, Tweakpane-exposed
  like every other tunable.
- `src/state/types.ts`: `TileState` (`hp`, `loot`, `revealed`) and
  `GameState` (energy/timestamp, currency, shipLevel, depth, grid
  dimensions, tiles array) — the full save shape.
- `src/state/board.ts`: `generateBoard(depth)` (per-tile HP =
  `baseTileHp * tileHpDepthMultiplier^depth` with the same +/-1 jitter
  spread as the original `Phaser.Math.Between(1,3)` placeholder; loot
  rolled independently per tile at `lootChance`, valued in a range
  that scales by `lootValueDepthMultiplier^depth`), `rowsForDepth`,
  `shipDamage`, `upgradeCost`.
- `src/state/energy.ts`: `applyEnergyRegen` — timestamp-anchored regen
  catch-up; snaps `timestamp` to `now` once energy reaches the cap so
  no unbounded backlog can accumulate past full. Untouched this
  session.
- `src/state/persistence.ts`: `loadState`/`saveState` against
  `localStorage['digger:save:v1']`, single JSON blob, fresh-state
  fallback (depth 0, full energy) when no save exists or it fails to
  parse, and clamps a loaded save's `energy` to `Math.min(energy,
  tune.energyMax)` as a safety net for pre-cap-change saves. Untouched
  this session.
- `src/input/intents.ts`: `bindSelectIntent` byte-identical to the
  original placeholder version (untouched, per the original brief).
  `bindVerticalDragIntent` for the board-pan gesture. Untouched this
  session.
- `src/debug/debugPanel.ts`: Tweakpane panel gated on `?debug=1`,
  exposing all `tune.json` values with per-key slider ranges and a
  "Copy JSON" clipboard button. **This session**: added a `laserFadeMs`
  range entry (`min: 50, max: 2000, step: 50`).
- `src/main.ts` (`DiggerScene`): two-camera split — `cameras.main`
  stays the fixed logical-pixel camera (build tag, ship, all HUD, used
  for select-intent hit-testing) and `boardCamera` (via `cameras.add`)
  renders only the tile grid, clipped to a fixed-height viewport near
  the top and scrollable vertically. Tap hit-testing (both HUD buttons
  and board tiles) is done with plain screen-space arithmetic against
  `cameras.main`'s coordinates.
  - Board generation, energy no-op-on-empty, loot-on-clear, descend-
    when-fully-revealed, and ship-upgrade-cost/damage all match the
    brief.
  - Ship kept as decorative HUD-adjacent art below the board viewport,
    object-scaled by `artZoom`; bob tween amplitude used directly in
    logical pixels.
  - `tile_grass`/`tile_hole` swap kept as-is.
  - The energy bar is the `ui_ammo` sprite (32 frames, index =
    `state.energy` directly, ascending — see "Key technical
    decisions"), with the `${energy}/${energyMax}` count rendered
    inside its circular badge and the "Next in Ns"/"Energy full"
    countdown on its own centered line below.
  - **This session**: `setUpCameras()` now reorders
    `this.cameras.cameras` so `cameras.main` renders last (see "Key
    technical decisions" — required for the laser, and for any future
    HUD-layer effect that visually crosses into the board viewport,
    to actually be visible there). New private method `fireLaser(fromX,
    fromY, toX, toY)`: spawns a `projectile_laser` sprite at the ship's
    current screen position, rotated/scaled to reach the target point,
    playing the (already auto-generated) 2-frame looped animation,
    tweened to `alpha: 0` over `tune.laserFadeMs` and destroyed on
    completion. Called from `onTapBoard()` immediately after the
    `tile.hp -= shipDamage(...)` line, so it fires on every successful
    damage tap (not just kills), passing `this.ship.x/y` and the
    tapped tile's screen position (computed by mirroring the existing
    hit-test math in reverse, using the same `col`/`row`,
    `tileScreenWidth`, and `scrollTopWorldY` already in scope rather
    than rederiving them).

## Key technical decisions

- **Camera render order had to be fixed for the laser to be visible at
  all — this was the real work of this session, not the sprite math.**
  `boardCamera` is created via `this.cameras.add()` after
  `cameras.main` already exists, and Phaser renders cameras in
  `this.cameras.cameras` array order — so `boardCamera` was drawing
  *after*, i.e. on top of, `cameras.main`. Combined with
  `boardCamera.setBackgroundColor(0x0a0a0a)` (an opaque fill covering
  its entire viewport before it draws tiles), this meant *anything* in
  `hudLayer` — the laser, in particular its endpoint, which by design
  lands on a tile — was fully hidden wherever it crossed into the
  board viewport's screen region (y 56-396), even though the laser was
  correctly positioned and unclipped in Phaser's logical/update sense.
  Confirmed with a before/after Playwright screenshot: before the fix,
  a zoomed crop of the board-viewport region during an active laser
  showed the tile grid completely undisturbed (laser invisible); after
  reordering `cameras.main` to the end of `this.cameras.cameras`
  (`setUpCameras()`), the same tap produced a laser clearly visible on
  top of the tiles, and a follow-up screenshot 500ms later confirmed
  it still fades and destroys itself correctly. No visible regression
  in the normal (no-tap) boot screenshot from this reorder — the
  board's own tiles/background still render identically; only
  hudLayer content's stacking relative to the board viewport changed,
  which is exactly the fix needed. **If a future effect needs to
  render *behind* the board instead, this order will need to be
  reverted or made conditional** — currently it's a blanket "HUD always
  wins" rule.
- **Ship-to-tile coordinate conversion for cross-camera effects**
  (worth reusing verbatim for any future effect spanning the fixed HUD
  camera and the scrollable board camera): the ship's position needs
  no conversion (`this.ship.x`/`this.ship.y` are already in
  `cameras.main`'s fixed screen space). The tapped tile's position,
  however, lives in `boardCamera`'s scrollable board-world space and
  must be converted to that same fixed screen space by inverting the
  `onTapBoard` hit-test math:
  ```ts
  const tileScreenX = GRID_MARGIN_X + (col + 0.5) * tileScreenWidth;
  const tileWorldYCenter = (row + 0.5) * this.tileNativeHeight;
  const tileScreenY = BOARD_VIEWPORT_TOP + (tileWorldYCenter - scrollTopWorldY) * this.artZoom;
  ```
  using the exact same `col`, `row`, `tileScreenWidth`, and
  `scrollTopWorldY` already computed earlier in `onTapBoard` (not
  rederived), so the effect is pixel-accurate to the tile that was
  actually tapped, including current scroll position. This inverts
  `onTapBoard`'s screen-to-board conversion
  (`boardWorldY = scrollTopWorldY + (screenY - BOARD_VIEWPORT_TOP) / artZoom`)
  back the other way.
- **Why `energyMax = 31`, not 32**: the `ui_ammo` sprite has exactly
  32 frames, one per possible energy value; 0-31 inclusive is 32
  distinct values, a clean 1:1 mapping.
- **`ui_ammo` frame index = `state.energy` directly, ascending, no
  reversal** — confirmed by explicit follow-up instruction, overriding
  an earlier reversed mapping. Flag still open (see "Open questions"):
  direct pixel measurement of the source art shows this makes energy 0
  render as a nearly-full-looking belt and energy 31 (max) render as a
  nearly-empty-looking belt — inverted from conventional meter
  reading. Implemented as instructed; reverting is a one-line change
  (`ammoFrameIndex = tune.energyMax - this.state.energy`) if this
  turns out to have been a misunderstanding.
- **Ammo badge text coordinates**: measured directly from
  `ui_ammo0001.png`'s raw pixel data (white-interior blob bounding
  box), not eyeballed — `AMMO_BADGE_CX_FRAC = 0.099`,
  `AMMO_BADGE_CY_FRAC = 0.5` as fractions of the native frame, applied
  against the sprite's scaled size at render time.
- **Old-save energy clamp on load**: `loadState()` clamps to
  `tune.energyMax` so a save from before the 32->31 cap change can't
  sit stuck above the cap or index the ammo sprite's frame array out
  of bounds.
- **Energy-cap regen fix**: `applyEnergyRegen` snaps `timestamp` to
  `now` once `newEnergy >= energyMax`, discarding (not banking) time
  spent sitting at the cap.
- **Hit-testing decoupled from the board camera's transform.** Tile
  taps are resolved with manual row/col arithmetic against
  `cameras.main`'s fixed logical coordinates rather than calling
  `getWorldPoint` against whichever camera currently owns the tap,
  since `bindSelectIntent` (kept unchanged) always reads
  `scene.cameras.main`. (This is also why the laser's tile-position
  math above mirrors that same arithmetic rather than using a
  camera's own coordinate conversion.)
- **Persistence writes only on state-changing actions** (tap, upgrade,
  descend), not on every 1-second regen tick — the laser is a purely
  visual side effect and doesn't affect this.
- **Tile HP jitter** reuses the original code's absolute +/-1 spread
  rather than a percentage-based jitter.
- **Known crude-input tradeoff**: starting a pan-drag gesture over the
  board also registers as a tap (costs at most 1 energy, and now also
  fires a laser) on whatever tile is under the initial touch point,
  since `bindSelectIntent` fires on raw `pointerdown` and is kept
  unchanged per the brief.
- **Multiple simultaneous lasers are independent by design** — each
  `fireLaser()` call spawns its own sprite/tween with no shared state,
  so rapid tapping produces overlapping beams that each fade and
  self-destroy on their own timer. Confirmed via Playwright: three
  rapid taps on three different tiles produced three simultaneous
  beams at correct, independent angles/lengths in a single screenshot.

## Open questions

- The brief doesn't specify exact HUD layout/spacing — designed freely
  within "functional clarity," matching the existing suits
  prototype's text/button visual conventions.
- The board viewport's fixed pixel height (340px) was chosen freely,
  not specified by any brief; not in `tune.json` since it's a layout
  constant, not a "game feel" value.
- **Ammo frame-order semantics**: the ascending mapping currently
  shipped makes energy = 0 look full and energy = 31 look empty, the
  reverse of conventional meter reading. Explicitly confirmed as
  wanted after being flagged with screenshots, so implemented as
  instructed — but flagging again here since it's a deliberate
  departure from convention worth a second look during a human
  playtest, not something to silently "fix" back.
- **Camera render-order is now a blanket "HUD renders on top of board"
  rule** (see "Key technical decisions"). This was the correct fix for
  the laser, but nothing in the codebase currently *wants* HUD content
  to render behind the board — if that's ever needed (e.g. a future
  effect meant to appear "under" the tiles), this ordering will need
  to become conditional rather than a one-time global reorder.

## Known issues

- See "Known crude-input tradeoff" above — a drag-to-pan gesture also
  costs 1 tap (and now fires a laser) at its start point.
- No automated tests are checked into the repo — verification relies
  on manual Playwright interaction scripts run locally each session,
  per the prototype's placeholder-first/disposable nature and the
  absence of any existing test infra in this repo.
- Board viewport height (340px) and margin values are layout constants
  in `src/main.ts`, not `tune.json`.
- The ammo badge text is small (8px font) to fit the circular badge's
  limited diameter — legible in testing at up to 2 digits per side,
  but worth a human eye check on an actual phone screen.
- The laser's fade is alpha-only (no scale/color change), and its
  scale is a simple `distance / nativeFrameWidth` stretch with no
  perspective or thickness tuning beyond `artZoom` on the Y axis —
  functional, not polished, per "mechanics-first" scope for this task.

## Next proposed step

Playtest to tune `tune.json`'s starting values (loot chance/value,
tile HP scaling, upgrade cost curve, and now `laserFadeMs`) — they're
seeded placeholders, not yet human-tuned. Beyond that, the
currency/loot HUD row (still a plain text line, "Loot: N") remains the
next obvious placeholder-art swap-in candidate if/when matching art
exists.
