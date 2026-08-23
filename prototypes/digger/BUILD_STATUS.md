## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, a scrollable
board camera, and localStorage persistence (including offline energy
regen). A Tweakpane debug panel exposing all 17 tunables (old + new)
is wired up. This session fixed a correctness bug in the energy-cap
regen logic (see below) — no feature/scope changes.

## What was implemented

- `prototypes/digger/BRIEF.md`: idle-clicker mining spec — core loop,
  grid/board generation, energy, currency/upgrades, persistence,
  reuse-existing-code constraints, tuning seed values, house-rule
  restatements, out-of-scope list.
- `CLAUDE.md`: a `## Persistence` house-rule section (localStorage-
  only, versioned single-key JSON blob, save on every state-changing
  action, timestamp-based offline-progress pattern), inserted between
  `## Networking` and `## Placeholder-first`. Also since updated so
  CI-pass-gated PR auto-merge is the repo-wide default, not just
  mp-base/mp-net.
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
  catch-up. **Fixed this session**: previously, whenever energy was
  already at the cap, the function early-returned without advancing
  `timestamp`, leaving it frozen while real elapsed time kept building
  up behind it unboundedly. The moment energy next dropped below the
  cap (by spending it), the next regen check computed elapsed time
  against that stale, now-huge gap and granted enough points to refill
  straight back to max — silently defeating the energy cap entirely.
  Fix: whenever the resulting energy is at or above the cap, the
  timestamp now snaps to `now` instead of staying frozen, so no
  backlog can accumulate past full. Time spent sitting at the cap is
  discarded, not banked — matching the intent of the cap actually
  holding.
- `src/state/persistence.ts`: `loadState`/`saveState` against
  `localStorage['digger:save:v1']`, single JSON blob, fresh-state
  fallback (depth 0, full energy) when no save exists or it fails to
  parse.
- `src/input/intents.ts`: `bindSelectIntent` byte-identical to before
  (untouched, per the brief). Added `bindVerticalDragIntent` (new,
  reports raw pointermove delta while the pointer is down) for the
  board-pan gesture — this keeps all pointer/touch reads inside the
  intent layer rather than scene code reading events directly.
- `src/debug/debugPanel.ts`: Tweakpane panel (mirrors mp-net's
  `mountDebugPanelIfRequested` pattern), gated on `?debug=1`, exposing
  all 17 `tune.json` values with per-key slider ranges and a
  "Copy JSON" clipboard button. Edits a local copy for inspection/
  export only, same as the existing mp-net/suits-mp panels — it does
  not feed live back into gameplay.
- `src/main.ts` (`DiggerScene`): loads/regen-catches-up state on
  `create()`; two-camera split — `cameras.main` stays the fixed
  logical-pixel camera (build tag, ship, all HUD, used for
  select-intent hit-testing, exactly like every other prototype's main
  camera) and a `boardCamera` (via `cameras.add`) renders only the
  tile grid, clipped to a fixed-height viewport near the top and
  scrollable vertically, ignoring/ignored-by the other camera's
  objects — the same UI-camera-ignoring-game-world split the build tag
  already used, now applied symmetrically in both directions. Tap
  hit-testing (both HUD buttons and board tiles) is done with plain
  screen-space arithmetic against `cameras.main`'s coordinates (which,
  at `zoom = PIXEL_RATIO` centered on the logical center, are
  numerically identical to logical screen pixels) rather than juggling
  two different `getWorldPoint` results, since `bindSelectIntent`
  only ever exposes one camera's world point.
  - Board generation, energy no-op-on-empty, loot-on-clear, descend-
    when-fully-revealed, and ship-upgrade-cost/damage all match the
    brief.
  - Ship kept as decorative HUD-adjacent art below the board viewport,
    object-scaled by `artZoom` (rather than camera-zoomed) so it still
    renders at its original apparent size while living in the
    fixed camera; bob tween amplitude is used directly in logical
    pixels (no zoom-conversion needed, since the fixed camera's world
    units already equal logical pixels).
  - `tile_grass`/`tile_hole` swap kept as-is.

## Key technical decisions

- **Energy-cap regen fix (this session)**: snapping `timestamp` to
  `now` specifically when `newEnergy >= energyMax`, rather than
  whenever `pointsApplied <= 0`. This distinction matters: a call that
  computes 0 applicable points because elapsed time simply hasn't
  reached even one interval yet (energy below cap, still mid-interval)
  must NOT reset the timestamp, or partial progress toward the next
  point would be lost every time. Only the "already at/reaching cap"
  case discards the backlog. Verified logically by hand-tracing the
  function at/near max, and empirically via Playwright: seeded a save
  at cap with a timestamp 15 regen-intervals stale, reloaded, spent 1
  energy (dropping to 31/32), and confirmed the saved timestamp's age
  was ~0ms (not ~15 intervals) and that energy did not jump back to
  32 on a subsequent check — the exact regression this bug caused.
- **Hit-testing decoupled from the board camera's transform.** Rather
  than calling `getWorldPoint` against whichever camera currently owns
  the tap, tile taps are resolved with manual row/col arithmetic
  (screen Y -> board-native world Y via the tracked pan offset and
  `artZoom`) against `cameras.main`'s already-fixed logical
  coordinates. This was necessary because `bindSelectIntent` (kept
  unchanged per the brief) always reads `scene.cameras.main`, and
  `cameras.main` needed to stay the fixed/HUD camera so HUD button
  hit-testing could stay simple.
- **Persistence writes only on the three listed state-changing
  actions** (tap, upgrade, descend), not on every 1-second regen tick.
  Because `applyEnergyRegen` is timestamp-anchored, an unsaved live
  regen tick is never lost data — the next load (however much later)
  recomputes correctly from whatever `(energy, timestamp)` pair was
  last actually saved.
- **Tile HP jitter** reuses the original code's absolute +/-1 spread
  (`Phaser.Math.Between(-1, 1)` added to the rounded depth-scaled
  base) rather than inventing a new percentage-based jitter, per
  "randomized... the same way the current 1-3 randomization works."
- **Known crude-input tradeoff**: since `bindSelectIntent` fires on
  raw `pointerdown` (unchanged, per the brief) and the drag-pan intent
  also starts from a `pointerdown`, starting a pan gesture over the
  board always also registers as a tap on whatever tile is under the
  initial touch point. This is a real but minor rough edge (costs at
  most 1 energy/1 tap-worth of damage per drag start), and
  disambiguating tap-vs-drag would require changing
  `bindSelectIntent`'s trigger event, which the brief explicitly says
  to keep unchanged. Left as-is, consistent with the house rule that
  "crude touch bindings are acceptable."

## Open questions

- The brief doesn't specify exact HUD layout/spacing (energy bar
  style, button sizing, "Loot" label placement) — designed freely
  within "functional clarity," matching the existing suits
  prototype's text/button visual conventions (monospace, dark
  rectangles, white stroke). Flagging in case BRIEF.md should be
  amended with more specific HUD guidance for consistency across
  future prototypes with similar HUDs.
- The brief specifies the board viewport as "a fixed-height viewport
  region near the top of the canvas" without an exact pixel height.
  340px was chosen (leaving room below for the ship + HUD stack within
  the 844px canvas) — this is a layout guess, not a tuned value, so it
  isn't in `tune.json`. Worth confirming during playtesting whether
  more or less board is wanted on-screen at once.

## Known issues

- See "Known crude-input tradeoff" above — a drag-to-pan gesture also
  costs 1 tap at its start point.
- No automated tests are checked into the repo — verification this
  session (and the original implementation session) relied on manual
  Playwright interaction scripts run locally, per the prototype's
  placeholder-first/disposable nature and the absence of any existing
  test infra in this repo.
- Board viewport height (340px) and margin values are layout constants
  in `src/main.ts`, not `tune.json` — they're screen-layout decisions
  rather than "game feel" values per the house Tuning rule's own
  definition (speeds, gravity, friction, durations, easing, cooldowns).

## Next proposed step

Playtest to tune `tune.json`'s starting values (loot chance/value,
tile HP scaling, upgrade cost curve) — they're seeded placeholders per
the brief, not yet human-tuned. After that, the most natural next
scope (if wanted — not requested by this brief) would be surfacing
depth/progress more prominently in the HUD, since currently depth is
only visible via the "Descend to depth N" button label.
