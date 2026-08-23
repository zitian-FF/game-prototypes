## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, a scrollable
board camera, and localStorage persistence (including offline energy
regen). The prior session swapped the placeholder rectangle energy bar
for the real `ui_ammo` sprite (32-frame belt art) and lowered
`energyMax` from 32 to 31 so energy's 32 possible values (0-31
inclusive) map 1:1 onto the sprite's 32 frames. This session corrected
the frame-index mapping per an explicit follow-up instruction — see
"Key technical decisions" for the frame-order finding and the
unresolved visual-semantics flag this raised.

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
- `tune.json`: **`energyMax` changed from 32 to 31 this session** —
  see "Key technical decisions" for why 31 is intentional, not an
  off-by-one.
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
  catch-up. Fixed in a prior session: whenever the resulting energy is
  at or above the cap, the timestamp snaps to `now` instead of staying
  frozen, so no unbounded backlog can accumulate past full. Untouched
  this session.
- `src/state/persistence.ts`: `loadState`/`saveState` against
  `localStorage['digger:save:v1']`, single JSON blob, fresh-state
  fallback (depth 0, full energy) when no save exists or it fails to
  parse. **This session**: `loadState()` now clamps a loaded save's
  `energy` to `Math.min(energy, tune.energyMax)` — a safety net for
  any pre-existing save with `energy: 32` from before the cap change,
  so it can't sit permanently above the new cap (which would otherwise
  never regenerate further, and would also index the ammo sprite's
  frame array out of bounds — see below). Not a save-shape version
  bump, per the task's own instruction.
- `src/input/intents.ts`: `bindSelectIntent` byte-identical to before
  (untouched, per the brief). `bindVerticalDragIntent` for the
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
  objects. Tap hit-testing (both HUD buttons and board tiles) is done
  with plain screen-space arithmetic against `cameras.main`'s
  coordinates rather than juggling two different `getWorldPoint`
  results.
  - Board generation, energy no-op-on-empty, loot-on-clear, descend-
    when-fully-revealed, and ship-upgrade-cost/damage all match the
    brief.
  - Ship kept as decorative HUD-adjacent art below the board viewport,
    object-scaled by `artZoom`; bob tween amplitude used directly in
    logical pixels.
  - `tile_grass`/`tile_hole` swap kept as-is.
  - **This session**: `renderHud()`'s placeholder energy bar (two
    rectangles + a plain `Energy: X/Y` text line) replaced with the
    `ui_ammo` sprite, loaded the same way `buildShip()` loads
    `player_ship` (`this.animations.ui_ammo.frames`,
    `this.textures.get('atlas').get(...)` for native frame size).
    Uniform-scaled so the sprite's width equals `WIDTH * 0.6`, centered
    horizontally, positioned at the old bar's top-edge `y`. The
    `${energy}/${energyMax}` count is now rendered inside the sprite's
    circular badge (see coordinates below) instead of as a separate
    line; the "Next in Ns" / "Energy full" countdown moved to its own
    centered line below the sprite. `hudText()` gained a `'center'`
    alignment option (`setOrigin(0.5, 0)`) to support this.

## Key technical decisions

- **Why `energyMax = 31`, not 32**: the `ui_ammo` sprite
  (`assets-src/packed/ui_ammo/`) has exactly 32 frames, one per
  possible energy value. With `energyMax = 31`, energy ranges over
  0-31 inclusive — exactly 32 distinct values, a clean 1:1 mapping to
  the 32 frames. This was specified by the task, not derived.
- **`ui_ammo` frame index = `state.energy` directly, ascending, no
  reversal** — `energy 0 -> frames[0]` (`ui_ammo0001`), `energy 31 ->
  frames[31]` (`ui_ammo0032`). This is the mapping a follow-up
  instruction explicitly confirmed as correct-as-written, overriding
  what the prior session had shipped.
  - **Flag carried over from the prior session, now sharper**: direct
    pixel measurement of all 32 source PNGs (decoding raw RGBA data)
    found the belt's loaded/dark-vs-empty/light fill boundary moving
    monotonically from 2.5% of belt width at frame 1 to 95.4% at frame
    32 — i.e. frame `ui_ammo0001` renders nearly-fully **loaded/dark**
    and frame `ui_ammo0032` renders nearly-fully **empty/light**. With
    the ascending mapping now in place, this means **energy = 0
    displays as a nearly-full-looking belt, and energy = 31 (max)
    displays as a nearly-empty-looking belt** — confirmed via
    Playwright screenshots at both extremes. That's inverted from
    every conventional meter/gauge reading (fuller = more resource),
    and from what the prior session's `energyMax - energy` indexing
    produced (which matched conventional reading: full energy visually
    full, empty energy visually empty). This was surfaced explicitly
    and the ascending mapping was reconfirmed as wanted before
    shipping it, so it's implemented as instructed — but it's flagged
    here in case that confirmation was made without seeing these
    screenshots, since reverting is a one-line change
    (`ammoFrameIndex = tune.energyMax - this.state.energy`).
- **Ammo badge text coordinates**: the sprite's circular badge center
  (where the `X/energyMax` count is drawn) was measured directly from
  `ui_ammo0001.png`'s raw pixel data (the badge's white interior blob
  bounding box, isolated from the adjacent "AMMO" text bubble by
  restricting the scan to the left ~20% of the frame) rather than
  eyeballed. Result, as a fraction of the native (345x70) frame:
  **`AMMO_BADGE_CX_FRAC = 0.099`** (from the sprite's left edge),
  **`AMMO_BADGE_CY_FRAC = 0.5`** (dead center vertically). These are
  applied against the sprite's *scaled* width/height at render time
  (`badgeX = spriteLeft + CX_FRAC * scaledWidth`, etc.), so they stay
  correct regardless of `WIDTH * 0.6`'s actual pixel value. Confirmed
  visually via Playwright screenshots at 0/31, 1/31, 15/31, and 31/31
  — text sits centered and legible inside the badge at every digit
  count tested (font size 8px, black on the badge's white interior).
  If the `ui_ammo` art is ever re-exported, re-derive these two
  fractions rather than assuming they still hold.
- **Old-save energy clamp on load**: without
  `Math.min(state.energy, tune.energyMax)` in `loadState()`, a save
  written under the previous `energyMax = 32` (with `energy: 32`)
  would load with `energy` one above the new cap, which would both
  never regenerate further (the regen logic never grants points once
  `energy >= energyMax`) and immediately index
  `ammoFrames[energyMax - energy]` at `-1` — an invalid frame lookup.
  Verified via Playwright: seeded a save with `energy: 32`, reloaded,
  confirmed it displays and behaves as 31/31 with no console errors.
- **Energy-cap regen fix (prior session)**: `applyEnergyRegen` snaps
  `timestamp` to `now` specifically when `newEnergy >= energyMax`,
  discarding (not banking) time spent sitting at the cap. Untouched
  this session; still holds with the new `energyMax = 31`.
- **Hit-testing decoupled from the board camera's transform.** Tile
  taps are resolved with manual row/col arithmetic against
  `cameras.main`'s fixed logical coordinates rather than calling
  `getWorldPoint` against whichever camera currently owns the tap,
  since `bindSelectIntent` (kept unchanged) always reads
  `scene.cameras.main`.
- **Persistence writes only on state-changing actions** (tap, upgrade,
  descend), not on every 1-second regen tick — `applyEnergyRegen` is
  timestamp-anchored, so an unsaved live regen tick is never lost
  data.
- **Tile HP jitter** reuses the original code's absolute +/-1 spread
  rather than a percentage-based jitter, per "randomized... the same
  way the current 1-3 randomization works."
- **Known crude-input tradeoff**: starting a pan-drag gesture over the
  board also registers as a tap (costs at most 1 energy) on whatever
  tile is under the initial touch point, since `bindSelectIntent`
  fires on raw `pointerdown` and is kept unchanged per the brief.

## Open questions

- The brief doesn't specify exact HUD layout/spacing — designed freely
  within "functional clarity," matching the existing suits
  prototype's text/button visual conventions.
- The board viewport's fixed pixel height (340px) was chosen freely,
  not specified by the brief; not in `tune.json` since it's a layout
  constant, not a "game feel" value.
- **Ammo frame-order semantics** (see "Key technical decisions"): the
  ascending mapping now shipped makes energy = 0 look full and energy
  = 31 look empty, the reverse of conventional meter reading and of
  what direct pixel measurement of the source art would suggest for a
  "fuller = more" convention. This was explicitly confirmed as wanted
  after being flagged with screenshots, so it's implemented as
  instructed rather than left unresolved — but flagging again here per
  the house rule, since it's a real, deliberate departure from the
  usual convention and worth double-checking during a human playtest.

## Known issues

- See "Known crude-input tradeoff" above — a drag-to-pan gesture also
  costs 1 tap at its start point.
- No automated tests are checked into the repo — verification relies
  on manual Playwright interaction scripts run locally each session,
  per the prototype's placeholder-first/disposable nature and the
  absence of any existing test infra in this repo.
- Board viewport height (340px) and margin values are layout constants
  in `src/main.ts`, not `tune.json`.
- The ammo badge text is small (8px font) to fit the circular badge's
  limited diameter (~26px scaled at `WIDTH * 0.6` sprite width) —
  legible in testing at up to 2 digits per side (`"31/31"`), but worth
  a human eye check on an actual phone screen, not just a desktop
  screenshot.

## Next proposed step

Playtest to tune `tune.json`'s starting values (loot chance/value,
tile HP scaling, upgrade cost curve) — they're seeded placeholders,
not yet human-tuned. Beyond that, the currency/loot HUD row (still a
plain text line, "Loot: N") is the next obvious placeholder-art
swap-in candidate if/when matching art exists, following the same
pattern used for the ammo sprite this session.
