## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, a scrollable
board camera, and localStorage persistence (including offline energy
regen). Placeholder-art swap-ins are underway: the energy bar uses the
real `ui_ammo` sprite, a projectile-laser hit effect fires from the
ship to the tapped tile, and this session added a pooled debris
particle burst (weak on every damaging hit, strong additionally on the
hit that clears a tile) using Phaser's built-in `ParticleEmitter`.

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
  technical decisions" below. `laserFadeMs: 300` for the projectile
  laser's fade-out duration. **This session**: added 14 `debris*`
  tunables (scale/lifespan/cone-angle/speed/gravity/rotation-speed
  ranges, plus separate weak/strong particle-count ranges) — see
  "Trigger points" below for weak vs. strong. All Tweakpane-exposed.
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
  "Copy JSON" clipboard button. **This session**: added range entries
  for all 14 new `debris*` tunables.
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
  - `setUpCameras()` reorders `this.cameras.cameras` so `cameras.main`
    renders last (required for the laser, and for any future HUD-layer
    effect that visually crosses into the board viewport, to actually
    be visible there). Private method `fireLaser(fromX, fromY, toX,
    toY)`: spawns a `projectile_laser` sprite at the ship's current
    screen position, rotated/scaled to reach the target point, playing
    its looped animation, tweened to `alpha: 0` (and, **this session**,
    `scaleY: 0`) over `tune.laserFadeMs` and destroyed on completion.
    Called from `onTapBoard()` immediately after the
    `tile.hp -= shipDamage(...)` line, so it fires on every successful
    damage tap (not just kills), passing `this.ship.x/y` and the
    tapped tile's screen position (computed by mirroring the existing
    hit-test math in reverse, using the same `col`/`row`,
    `tileScreenWidth`, and `scrollTopWorldY` already in scope rather
    than rederiving them).
  - `create()`'s generic per-key animation loop (`frameRate: 20` for
    every key found in `animations.json`) excludes `projectile_laser`,
    which gets its own `anims.create` call right after the loop with
    `frameRate: 15` instead — Phaser's `AnimationManager.create()`
    refuses to replace an existing key (just warns and keeps the
    original), so this can't be done as an "override after the fact."
  - **This session**: `buildDebrisEmitter()` (called once from
    `create()`, not per-hit) creates a single persistent
    `this.debrisEmitter` via `this.add.particles(0, 0, 'atlas', {...})`
    using `fx_debris`'s 5 frames, ignored by `cameras.main` the same
    way `tileSprites` are (board-world space, not `hudLayer` — debris
    never needs to leave the board, unlike the laser). `onTapBoard()`
    calls `this.debrisEmitter.explode(count, tileWorldX, tileWorldY)`
    twice: a weak burst (`debrisWeakCountMin`-`Max` particles) on every
    successful damage hit, right after the existing `fireLaser` call,
    using the tile's board-world center (same formula `buildBoard`
    uses to place `tileSprites`, reusing the already-computed `col`/
    `row`); and, additionally, a strong burst
    (`debrisStrongCountMin`-`Max`) inside the `tile.hp <= 0` block, so
    a killing hit fires both. Continuous per-particle rotation (both
    direction and speed randomized, animating over the whole lifespan
    rather than a single static angle) uses the emitter's `rotate`
    onEmit/onUpdate custom-op pair — see "Key technical decisions" for
    why a plain `rotate: {min, max}` range doesn't do this and how the
    per-particle spin rate is threaded from onEmit to onUpdate.

## Key technical decisions

- **Debris continuous rotation: onEmit/onUpdate custom-op pair worked,
  no cleaner built-in alternative found in 3.90 docs.** A plain
  `rotate: { min, max }` range only assigns one static angle per
  particle at emit time — it doesn't animate over the lifespan, so it
  can't produce "visibly tumbling" particles. Used the documented
  `EmitterOpCustomUpdateConfig` shape instead: `onEmit(particle)` rolls
  a random deg-per-lifespan spin rate via
  `Phaser.Math.Between(debrisRotationSpeedMinDeg, debrisRotationSpeedMaxDeg)`
  and stores it; `onUpdate(particle, key, t)` returns `spinRate * t`
  every frame, where `t` is Phaser's own 0-1 lifetime progress — so
  each particle spins continuously at its own random rate and
  direction (negative values spin one way, positive the other) for its
  whole life. The per-particle spin rate is threaded from onEmit to
  onUpdate via `debrisSpinRates`, a `WeakMap<Particle, number>` keyed
  by the particle instance itself, rather than stashing an untyped
  custom field directly on Phaser's `Particle` object (`particle.data`
  exists but is reserved for internal ease-equation state, not general
  custom data — confirmed by reading `Particle.js`). Verified visually,
  not assumed: a Playwright screenshot series at 70ms intervals shows a
  single particle's internal facet lines at a clearly different angle
  in each successive frame (not one fixed angle), confirming genuine
  continuous rotation.
- **Debris frame randomization needed no onEmit fallback — confirmed
  by reading Phaser's source, then re-confirmed visually.**
  `frame: this.animations.fx_debris.frames` (a plain array) hits
  `ParticleEmitter.setEmitterFrame`, whose `pickRandom` parameter
  defaults to `true` for an array input (`this.randomFrame = pickRandom`
  in `ParticleEmitter.js`) — so per-particle frame randomization is the
  default, no `Phaser.Utils.Array.GetRandom` onEmit fallback needed.
  Confirmed visually too: bursts show multiple distinct `fx_debris`
  shapes (round rock, angular shard, diamond/kite) simultaneously
  rather than one repeated shape or an obviously sequential cycle.
- **Debris burst position is board-world, not screen space — no
  cross-camera conversion needed, unlike the laser.** `tileWorldX =
  (col + 0.5) * this.tileNativeWidth` and the pre-existing
  `tileWorldYCenter = (row + 0.5) * this.tileNativeHeight` (already
  computed for the laser's screen-Y conversion) are exactly the
  formula `buildBoard` uses to place `tileSprites`, so
  `debrisEmitter.explode(count, tileWorldX, tileWorldYCenter)` lands
  precisely on the tapped tile. `this.debrisEmitter` is added to
  `cameras.main`'s ignore list the same way `tileSprites` is — it only
  ever renders via `boardCamera`, scrolling/clipping with the board
  automatically, with no need for the fixed-camera screen-space
  conversion `fireLaser` requires to reach the ship.
- **Claimed laser start/end reversal did not reproduce — verified, not
  assumed fixed.** A follow-up task asserted the beam's anchor
  (`fromX`/`fromY`) and stretched end (`toX`/`toY`) were swapped, and
  gave two possible causes to check in order: (1) the `fireLaser` call
  site in `onTapBoard` passing tile coordinates before ship
  coordinates, or (2) `sprite.setOrigin(0, 0.5)` anchoring the wrong
  edge, fixable by flipping to `setOrigin(1, 0.5)`. Checked (1) first:
  the call site already reads `fireLaser(this.ship.x, this.ship.y,
  tileScreenX, tileScreenY)` — ship first, correct. Checked (2) via
  Playwright screenshots (per the task's own "verify via screenshot,
  don't guess blindly" instruction) rather than blindly applying the
  suggested `setOrigin(1, 0.5)` swap: a straight-up shot (tile directly
  above the ship) and a diagonal shot to the top-left corner tile both
  showed the beam correctly spanning from the ship's position to the
  tapped tile, angled correctly toward off-center targets, with no
  reversal in either test. `setOrigin(0, 0.5)` was left unchanged — the
  `setOrigin(1, 0.5)` fallback would have actively introduced a
  reversal, not fixed one. The `projectile_laser` art itself is
  left-right symmetric (arrow/spike shapes at both ends, confirmed by
  measuring the opacity envelope of both edges of the source PNG), so
  this was not something a screenshot's shape alone could rule out by
  eye — the position/angle tests above were the real verification.
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
  fires a laser and a debris burst) on whatever tile is under the
  initial touch point, since `bindSelectIntent` fires on raw
  `pointerdown` and is kept unchanged per the brief.
- **Multiple simultaneous lasers are independent by design** — each
  `fireLaser()` call spawns its own sprite/tween with no shared state,
  so rapid tapping produces overlapping beams that each fade and
  self-destroy on their own timer. Confirmed via Playwright: three
  rapid taps on three different tiles produced three simultaneous
  beams at correct, independent angles/lengths in a single screenshot.
- **One persistent debris emitter, not one per hit — this is the
  actual point of using Phaser's `ParticleEmitter` over hand-rolled
  sprites.** `buildDebrisEmitter()` runs once in `create()`; every
  burst reuses the same `this.debrisEmitter` via `.explode()`, which
  Phaser internally pools/batches into very few draw calls against the
  shared atlas. Digger is a clicker — rapid tapping is the normal case,
  not an edge case — so creating a fresh emitter game object per tap
  (as a naive per-hit implementation might) would generate real
  per-frame garbage and defeat the reason for using the built-in
  particle system at all.

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
- The laser's fade now animates both `alpha` and `scaleY` (thickness)
  to 0 over `tune.laserFadeMs`, confirmed via a mid-fade screenshot
  (~220ms into the 300ms default) showing a visibly thinner, fainter
  beam than at t=0. `scaleX` (length) stays fixed at its initial
  `distance / nativeFrameWidth` value for the whole lifetime — no
  perspective or independent length tuning — functional, not polished,
  per "mechanics-first" scope.
- The 14 `debris*` tunables are seeded placeholders (per the task),
  not yet human-tuned — verified functionally correct (bursts fire at
  the right trigger points, particles move/rotate/fade/randomize
  frame), but the actual feel (speed, spread, gravity, lifespan,
  particle counts) hasn't been played with yet.

## Next proposed step

Playtest to tune `tune.json`'s starting values (loot chance/value,
tile HP scaling, upgrade cost curve, `laserFadeMs`, and now the 14
`debris*` values) — they're seeded placeholders, not yet human-tuned.
Beyond that, the currency/loot HUD row (still a plain text line,
"Loot: N") remains the next obvious placeholder-art swap-in candidate
if/when matching art exists.
