## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, a scrollable
board camera, and localStorage persistence (including offline energy
regen). Placeholder-art swap-ins are underway: the energy bar uses the
real `ui_ammo` sprite, a projectile-laser hit effect fires from the
ship to the tapped tile, and a pooled debris particle burst (weak on
every damaging hit, strong additionally on the hit that clears a tile)
uses Phaser's built-in `ParticleEmitter`. This session fixed a Z-order
bug: debris rendered *underneath* the tile grid on every board after
the first (i.e. after any descend), since `buildBoard()` destroys and
recreates tile sprites on every respawn, and Phaser stacks same-depth
siblings by insertion order — the recreated tiles were re-inserted
after (on top of) `debrisEmitter`, which is only ever created once.
Fixed with explicit persistent depths (`BOARD_DEPTH` / `EFFECTS_DEPTH`)
instead of relying on creation order — see "Key technical decisions."

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
  laser's fade-out duration. 14 `debris*` tunables (scale/lifespan/
  cone-angle/speed/gravity/rotation-speed ranges, plus separate weak/
  strong particle-count ranges), all Tweakpane-exposed.
  `debrisLifespanMaxMs` (500-1500, was 500-1000) and
  `debrisSpeedMin`/`debrisSpeedMax` (240/480, was 80/160, tripled) got
  a first deliberate tuning pass in a prior session; the rest are still
  seeded placeholders. `debrisConeHalfAngleDeg` and `debrisGravityY`
  are deliberately untouched — the stronger launch speed now reads as
  a bit under-gravitied (particles fly higher/further before falling),
  an expected consequence of the speed change alone, left for
  deliberate retuning later rather than guessed at.
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
  no unbounded backlog can accumulate past full.
- `src/state/persistence.ts`: `loadState`/`saveState` against
  `localStorage['digger:save:v1']`, single JSON blob, fresh-state
  fallback (depth 0, full energy) when no save exists or it fails to
  parse, and clamps a loaded save's `energy` to `Math.min(energy,
  tune.energyMax)` as a safety net for pre-cap-change saves.
- `src/input/intents.ts`: `bindSelectIntent` byte-identical to the
  original placeholder version (untouched, per the original brief).
  `bindVerticalDragIntent` for the board-pan gesture.
- `src/debug/debugPanel.ts`: Tweakpane panel gated on `?debug=1`,
  exposing all `tune.json` values with per-key slider ranges and a
  "Copy JSON" clipboard button, including all 14 `debris*` tunables.
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
    its looped animation, tweened to `alpha: 0` and `scaleY: 0` over
    `tune.laserFadeMs` and destroyed on completion. Called from
    `onTapBoard()` immediately after the `tile.hp -= shipDamage(...)`
    line, so it fires on every successful damage tap (not just kills),
    passing `this.ship.x/y` and the tapped tile's screen position
    (computed by mirroring the existing hit-test math in reverse,
    using the same `col`/`row`, `tileScreenWidth`, and
    `scrollTopWorldY` already in scope rather than rederiving them).
  - `create()`'s generic per-key animation loop (`frameRate: 20` for
    every key found in `animations.json`) excludes `projectile_laser`,
    which gets its own `anims.create` call right after the loop with
    `frameRate: 15` instead — Phaser's `AnimationManager.create()`
    refuses to replace an existing key (just warns and keeps the
    original), so this can't be done as an "override after the fact."
  - `buildDebrisEmitter()` (called once from `create()`, not per-hit)
    creates a single persistent `this.debrisEmitter` via
    `this.add.particles(0, 0, 'atlas', {...})` using `fx_debris`'s 5
    frames, ignored by `cameras.main` the same way `tileSprites` are
    (board-world space, not `hudLayer` — debris never needs to leave
    the board, unlike the laser). `onTapBoard()` calls
    `this.debrisEmitter.explode(count, tileWorldX, tileWorldY)` twice:
    a weak burst (`debrisWeakCountMin`-`Max` particles) on every
    successful damage hit, right after the `fireLaser` call, using the
    tile's board-world center (same formula `buildBoard` uses to place
    `tileSprites`, reusing the already-computed `col`/`row`); and,
    additionally, a strong burst (`debrisStrongCountMin`-`Max`) inside
    the `tile.hp <= 0` block, so a killing hit fires both. Continuous
    per-particle rotation (both direction and speed randomized,
    animating over the whole lifespan rather than a single static
    angle) uses the emitter's `rotate` onEmit/onUpdate custom-op pair
    — see "Key technical decisions."
  - **This session**: `BOARD_DEPTH = 0` / `EFFECTS_DEPTH = 10`
    constants near the top of the file. `buildBoard()` calls
    `sprite.setDepth(BOARD_DEPTH)` on every tile sprite as it's
    created. `buildDebrisEmitter()` calls
    `this.debrisEmitter.setDepth(EFFECTS_DEPTH)` right after creating
    it. See "Key technical decisions" for why and for the convention
    future board-space effects should follow.

## Key technical decisions

- **Board Z-order fix: explicit persistent depths, not creation
  order.** Tile sprites (`this.add.image` in `buildBoard()`) and
  `debrisEmitter` (`this.add.particles` in `buildDebrisEmitter()`) both
  render via `boardCamera` with no explicit depth set on either — so
  Phaser fell back to stacking them by insertion order into the scene's
  display list. `debrisEmitter` is created exactly once, in `create()`,
  early. `buildBoard()` runs again on every descend, destroying and
  recreating every tile sprite, which re-inserts them at the *end* of
  the display list — after, i.e. visually on top of, `debrisEmitter`.
  So the very first board (built before `debrisEmitter` existed)
  correctly showed debris on top of tiles, but every board after a
  descend showed debris hidden underneath the freshly-rebuilt tiles.
  Fix: two named constants, `BOARD_DEPTH = 0` and `EFFECTS_DEPTH = 10`,
  with tile sprites calling `.setDepth(BOARD_DEPTH)` in `buildBoard()`
  and `debrisEmitter` calling `.setDepth(EFFECTS_DEPTH)` once in
  `buildDebrisEmitter()`. Explicit depth makes the stacking independent
  of when either was created or how many times the board's been
  rebuilt. **Convention for future board-camera-space effects**: default
  to `EFFECTS_DEPTH` (or higher), never `BOARD_DEPTH` — that constant
  is reserved for the board's own tile sprites, so anything meant to
  render above the board should use `EFFECTS_DEPTH` or introduce a
  higher one if layering among multiple effect types is ever needed.
  Verified via Playwright, specifically provoking the bug's actual
  trigger: seeded a fully-cleared depth-0 board, tapped Descend, then
  tapped a tile on the *new* (post-descend) board and screenshotted
  immediately — before the fix this would have shown nothing (debris
  hidden under the tiles); after the fix, a zoomed crop clearly shows
  multiple debris chunks rendered on top of the new board's tiles, one
  even bleeding across the tile boundary into the row above. Also
  re-verified the original (pre-descend) board and a plain no-tap boot
  screenshot both still render correctly — no regression.
- **Debris lifespan/speed tuning tweak confirmed already live-wired,
  not hardcoded.** `buildDebrisEmitter()`'s `lifespan` and `speed`
  configs read `tune.debrisLifespanMinMs`/`MaxMs` and
  `tune.debrisSpeedMin`/`Max` directly — confirmed before a prior
  session's tuning task touched anything, so that task really was just
  two `tune.json` number edits, no code changes. Verified the new
  values render correctly via Playwright: a screenshot at ~315ms after
  a tile-clearing tap showed debris already flown far outside the
  origin tile (impossible at the old 80-160 speed range in that short
  a window), and a screenshot at ~1.3s showed faint particles still
  alive/fading (impossible under the old 1000ms lifespan max, only
  possible at 1500ms).
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
  Playwright screenshots rather than blindly applying the suggested
  `setOrigin(1, 0.5)` swap: a straight-up shot (tile directly above the
  ship) and a diagonal shot to the top-left corner tile both showed the
  beam correctly spanning from the ship's position to the tapped tile,
  angled correctly toward off-center targets, with no reversal in
  either test. `setOrigin(0, 0.5)` was left unchanged — the
  `setOrigin(1, 0.5)` fallback would have actively introduced a
  reversal, not fixed one. The `projectile_laser` art itself is
  left-right symmetric (arrow/spike shapes at both ends, confirmed by
  measuring the opacity envelope of both edges of the source PNG), so
  this was not something a screenshot's shape alone could rule out by
  eye — the position/angle tests above were the real verification.
- **Camera render order had to be fixed for the laser to be visible at
  all.** `boardCamera` is created via `this.cameras.add()` after
  `cameras.main` already exists, and Phaser renders cameras in
  `this.cameras.cameras` array order — so `boardCamera` was drawing
  *after*, i.e. on top of, `cameras.main`. Combined with
  `boardCamera.setBackgroundColor(0x0a0a0a)` (an opaque fill covering
  its entire viewport before it draws tiles), this meant *anything* in
  `hudLayer` — the laser, in particular its endpoint, which by design
  lands on a tile — was fully hidden wherever it crossed into the
  board viewport's screen region (y 56-396), even though the laser was
  correctly positioned and unclipped in Phaser's logical/update sense.
  Fixed by reordering `cameras.main` to the end of
  `this.cameras.cameras` (`setUpCameras()`), which is a *different*
  mechanism from the board Z-order fix above: this reorders whole
  *cameras* (main vs. board), while the board fix sets *depth* among
  siblings within a single camera's render (board tiles vs. debris,
  both drawn only by `boardCamera`). **If a future effect needs to
  render *behind* the board instead, this camera order will need to be
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
  `scene.cameras.main`.
- **Persistence writes only on state-changing actions** (tap, upgrade,
  descend), not on every 1-second regen tick — the laser/debris are
  purely visual side effects and don't affect this.
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
  self-destroy on their own timer.
- **One persistent debris emitter, not one per hit — this is the
  actual point of using Phaser's `ParticleEmitter` over hand-rolled
  sprites.** `buildDebrisEmitter()` runs once in `create()`; every
  burst reuses the same `this.debrisEmitter` via `.explode()`, which
  Phaser internally pools/batches into very few draw calls against the
  shared atlas. Digger is a clicker — rapid tapping is the normal case,
  not an edge case — so creating a fresh emitter game object per tap
  would generate real per-frame garbage and defeat the reason for
  using the built-in particle system at all.

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
- **Camera render-order is a blanket "HUD renders on top of board"
  rule** (see "Key technical decisions"). This was the correct fix for
  the laser, but nothing in the codebase currently *wants* HUD content
  to render behind the board — if that's ever needed (e.g. a future
  effect meant to appear "under" the tiles), this ordering will need
  to become conditional rather than a one-time global reorder.

## Known issues

- See "Known crude-input tradeoff" above — a drag-to-pan gesture also
  costs 1 tap (and now fires a laser and a debris burst) at its start
  point.
- No automated tests are checked into the repo — verification relies
  on manual Playwright interaction scripts run locally each session,
  per the prototype's placeholder-first/disposable nature and the
  absence of any existing test infra in this repo.
- Board viewport height (340px) and margin values are layout constants
  in `src/main.ts`, not `tune.json`.
- The ammo badge text is small (8px font) to fit the circular badge's
  limited diameter — legible in testing at up to 2 digits per side,
  but worth a human eye check on an actual phone screen.
- The laser's fade animates both `alpha` and `scaleY` (thickness) to 0
  over `tune.laserFadeMs`; `scaleX` (length) stays fixed at its initial
  `distance / nativeFrameWidth` value for the whole lifetime — no
  perspective or independent length tuning — functional, not polished,
  per "mechanics-first" scope.
- Most of the 14 `debris*` tunables are still seeded placeholders, not
  yet human-tuned — `debrisLifespanMaxMs` and the `debrisSpeed*` pair
  got a first tuning pass, but `debrisConeHalfAngleDeg`,
  `debrisGravityY`, and the rotation/count ranges have not. The
  stronger launch speed reads as under-gravitied relative to the
  original `debrisGravityY: 300` — expected from the speed change
  alone, left as-is rather than guessed at.
- `EFFECTS_DEPTH = 10` currently has only one occupant (`debrisEmitter`)
  — if/when a second board-space effect is added, it'll need its own
  thought about whether it belongs at the same depth as debris (draw
  order between the two would then again fall back to insertion order,
  same underlying issue as this session's bug) or a distinct depth
  above it.

## Next proposed step

Playtest to tune `tune.json`'s starting values (loot chance/value,
tile HP scaling, upgrade cost curve, `laserFadeMs`, and the remaining
un-tuned `debris*` values) — they're seeded placeholders, not yet
human-tuned. Beyond that, the currency/loot HUD row (still a plain
text line, "Loot: N") remains the next obvious placeholder-art swap-in
candidate if/when matching art exists.
