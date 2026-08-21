## Current milestone

BRIEF.md now exists and digger implements it in full: a working idle-
clicker mining loop with energy, currency, ship upgrades, depth
descent, a scrollable board camera, and localStorage persistence
(including offline energy regen). A Tweakpane debug panel exposing all
17 tunables (old + new) is wired up for the first time. This replaces
the previous bootstrap/placeholder-only state (a static 5x6 grid with
random durability and no game loop).

## What was implemented

- `prototypes/digger/BRIEF.md`: written per the task (idle-clicker
  mining spec — core loop, grid/board generation, energy, currency/
  upgrades, persistence, reuse-existing-code constraints, tuning
  seed values, house-rule restatements, out-of-scope list).
- `CLAUDE.md`: added a new `## Persistence` house-rule section
  (localStorage-only, versioned single-key JSON blob, save on every
  state-changing action, timestamp-based offline-progress pattern),
  inserted between `## Networking` and `## Placeholder-first`.
- `src/state/types.ts`: `TileState` (`hp`, `loot`, `revealed`) and
  `GameState` (energy/timestamp, currency, shipLevel, depth, grid
  dimensions, tiles array) — the full save shape.
- `src/state/board.ts`: `generateBoard(depth)` (per-tile HP =
  `baseTileHp * tileHpDepthMultiplier^depth` with the same +/-1 jitter
  spread as the original `Phaser.Math.Between(1,3)` placeholder; loot
  rolled independently per tile at `lootChance`, valued in a range
  that scales by `lootValueDepthMultiplier^depth`), `rowsForDepth`,
  `shipDamage`, `upgradeCost`.
- `src/state/energy.ts`: `applyEnergyRegen` — timestamp-anchored,
  idempotent regen catch-up. Only advances the saved timestamp by
  whole intervals actually applied toward the cap, so time spent
  capped is never lost; safe to call on every load and on a live
  1s ticker without needing to be the sole source of truth for
  correctness.
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
- `src/main.ts` (`DiggerScene`, rewritten): loads/regen-catches-up
  state on `create()`; two-camera split — `cameras.main` stays the
  fixed logical-pixel camera (build tag, ship, all HUD, used for
  select-intent hit-testing, exactly like every other prototype's main
  camera) and a new `boardCamera` (via `cameras.add`) renders only the
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
    fixed camera; bob tween amplitude is now used directly in logical
    pixels (no zoom-conversion needed, since the fixed camera's world
    units already equal logical pixels).
  - `tile_grass`/`tile_hole` swap kept as-is.

## Key technical decisions

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
  Because `applyEnergyRegen` is timestamp-anchored and idempotent, an
  unsaved live regen tick is never lost data — the next load (however
  much later) recomputes correctly from whatever `(energy, timestamp)`
  pair was last actually saved. Verified via Playwright: seeding a
  save 5.5 regen-intervals in the past produced the expected in-memory
  `10 -> 15` energy catch-up on load.
- **Tile HP jitter** reuses the original code's absolute +/-1 spread
  (`Phaser.Math.Between(-1, 1)` added to the rounded depth-scaled
  base) rather than inventing a new percentage-based jitter, per
  "randomized... the same way the current 1-3 randomization works."
- **Known crude-input tradeoff**: since `bindSelectIntent` fires on
  raw `pointerdown` (unchanged, per the brief) and the new drag-pan
  intent also starts from a `pointerdown`, starting a pan gesture over
  the board always also registers as a tap on whatever tile is under
  the initial touch point. This is a real but minor rough edge (costs
  at most 1 energy/1 tap-worth of damage per drag start), and
  disambiguating tap-vs-drag would require changing
  `bindSelectIntent`'s trigger event, which the brief explicitly says
  to keep unchanged. Left as-is, consistent with the house rule that
  "crude touch bindings are acceptable."

## Open questions

- The brief doesn't specify exact HUD layout/spacing (energy bar
  style, button sizing, "Loot" label placement) — I designed this
  freely within "functional clarity," matching the existing suits
  prototype's text/button visual conventions (monospace, dark
  rectangles, white stroke). Flagging in case BRIEF.md should be
  amended with more specific HUD guidance for consistency across
  future prototypes with similar HUDs.
- The brief specifies the board viewport as "a fixed-height viewport
  region near the top of the canvas" without an exact pixel height. I
  chose 340px (leaving room below for the ship + HUD stack within the
  844px canvas) — this is a layout guess, not a tuned value, so it
  isn't in `tune.json`. Worth confirming during playtesting whether
  more or less board is wanted on-screen at once.

## Known issues

- See "Known crude-input tradeoff" above — a drag-to-pan gesture also
  costs 1 tap at its start point.
- No automated tests beyond manual Playwright interaction scripts run
  this session (tap/clear/loot, drag-pan pixel-diff, offline energy
  regen, descend, upgrade, debug panel) — none of these are checked
  into the repo, per the prototype's placeholder-first/disposable
  nature and the absence of any existing test infra in this repo.
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
