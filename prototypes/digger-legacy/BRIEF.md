# Digger

An idle-clicker mining prototype. The player taps tiles on a grid to
damage them; cleared tiles reveal loot used to upgrade the ship, which
increases damage per tap. Clearing a full board lets the player descend
to a harder, more rewarding board. Energy limits how many taps are
available at once and regenerates over real time, including while the
tab is closed.

This brief supersedes the current ad-hoc tile/durability code as the
source of truth. The current 5x6 grid, tap-to-deplete visuals, and
ship sprite/bob are being kept and rewired, not thrown out — see
"Reuse existing code" below.

## Core loop

1. Player taps a tile. This costs 1 energy and deals damage equal to
   the ship's current damage stat to that tile's HP.
2. If the tile's HP reaches 0, it becomes a hole (existing `tile_hole`
   swap). If that tile had loot, the loot amount is added to the
   player's currency total immediately.
3. Currency can be spent to raise ship level, which raises damage per
   tap. No cap on ship level.
4. Once every tile on the board is at 0 HP, a "Descend" button
   appears. Tapping it generates the next board: one row taller, higher
   tile HP, better loot odds/value. The previous board is discarded.
5. Energy caps at 32, regenerates 1/min, and keeps regenerating while
   the tab is closed (computed from elapsed real time on load, not a
   running timer that only counts while open). The cap itself never
   increases.

## Grid & board generation

- Columns fixed at `GRID_COLS = 5` forever. Rows start at
  `GRID_ROWS_BASE` (tune.json) and increase by `GRID_ROWS_GROWTH_PER_DEPTH`
  each time the player descends. This keeps tile width, and therefore
  tap-target size, constant regardless of depth.
- Because rows grow, the board will eventually exceed the fixed 844px
  logical canvas height. Render the grid in a fixed-height viewport
  region near the top of the canvas, using a dedicated camera that can
  be panned vertically by vertical drag, clamped so it never scrolls
  past the board's top or bottom edge. Do not let panning affect the
  fixed HUD elements below (energy bar, currency, ship level/upgrade
  button, descend button) — those live outside the scrollable camera's
  viewport, similar in spirit to the existing UI-camera-ignoring-game-
  world pattern already used for the build-tag text.
- Ship sprite: keep it as decorative HUD-adjacent art (bob animation
  unchanged), positioned in the fixed (non-scrolling) area below the
  board viewport, not inside the scrollable grid.
- Tile HP for a newly generated board: each tile gets
  `BASE_TILE_HP * (TILE_HP_DEPTH_MULTIPLIER ^ depth)`, randomized per
  tile within a small range the same way the current 1-3 randomization
  works, rather than every tile on a board sharing identical HP.
- Loot placement per new board: each tile independently has a
  `LOOT_CHANCE` probability of holding loot (rest are empty, no visual
  difference before the tile is cleared — loot is hidden until
  revealed). Loot value for a tile that has loot is randomized within a
  range that scales by `LOOT_VALUE_DEPTH_MULTIPLIER ^ depth`.
- Depth counter starts at 0 for the first board and increments by 1
  each descend.

## Energy system

- `ENERGY_MAX = 32`, `ENERGY_REGEN_MS = 60000` (1 per minute), both in
  tune.json.
- On load, compute elapsed time since the last saved timestamp,
  convert to whole energy points gained (`floor(elapsedMs / ENERGY_REGEN_MS)`),
  add to saved energy capped at `ENERGY_MAX`, and advance the saved
  timestamp by however many whole regen intervals were consumed (don't
  discard partial progress toward the next point).
- A tap that would cost energy the player doesn't have should be a
  no-op (tile takes no damage, no energy spent) rather than blocked at
  the input layer, so the intent-layer pattern stays simple.
- Display current/max energy and a visible indicator of time remaining
  until the next point regenerates.

## Currency & ship upgrades

- Currency name for the UI: "Loot" (placeholder label, trivially
  renamed later — flag this as an easy find/replace if a different name
  is wanted).
- Ship level starts at 1. Damage per tap =
  `BASE_DAMAGE + (shipLevel - 1) * DAMAGE_PER_LEVEL` (linear starting
  curve, tune.json).
- Upgrade cost for the next level =
  `UPGRADE_COST_BASE * (UPGRADE_COST_GROWTH ^ (shipLevel - 1))`
  (exponential cost growth, tune.json). Upgrade button shows current
  level, current damage, and the cost of the next level; disabled/greyed
  when currency is insufficient.

## Persistence

- Full state persists to `localStorage` under a single key
  (`digger:save:v1`), as one JSON blob, on every state-changing action
  (tap, upgrade, descend) rather than only on unload, since mobile tab
  discards can happen without a clean unload event.
- Saved state: energy, energy timestamp, currency, ship level, depth,
  current grid dimensions, and per-tile state (HP remaining, loot
  value if any, whether already revealed) for the in-progress board.
- On load with no existing save, initialize a fresh depth-0 board and
  full energy.
- No cross-device sync, no export/import — single-browser localStorage
  only, matching the scope of a prototype.

## Reuse existing code

- Keep `bindSelectIntent` from `src/input/intents.ts` unchanged.
- Keep the existing DPR handling, dual-camera pattern (gameplay camera
  + UI camera), and `zoom`/`toWorldX`/`toWorldY` screen-to-world math —
  extend it for the new scrollable board camera rather than replacing
  it.
- Keep `tile_grass` / `tile_hole` texture swap on clear.
- Replace: the `Tile` interface's `durability` field and the
  hardcoded `Phaser.Math.Between(1, 3)` assignment, and the flat
  damage-of-1-per-tap logic in the current `bindSelectIntent` callback.

## Tuning (tune.json)

Seed with these starting values. These are placeholders for you to
adjust after playing it, per the house rule that tuned values are set
by a human playtesting, not guessed upfront:

```json
{
  "shipBobAmplitudePx": 14,
  "shipBobDurationMs": 3000,
  "energyMax": 32,
  "energyRegenMs": 60000,
  "gridCols": 5,
  "gridRowsBase": 6,
  "gridRowsGrowthPerDepth": 1,
  "baseTileHp": 3,
  "tileHpDepthMultiplier": 1.15,
  "baseDamage": 1,
  "damagePerLevel": 1,
  "upgradeCostBase": 10,
  "upgradeCostGrowth": 1.5,
  "lootChance": 0.3,
  "lootValueBaseMin": 2,
  "lootValueBaseMax": 5,
  "lootValueDepthMultiplier": 1.1
}
```

## House rules (restated)

- All input through the existing intent layer only — no direct
  pointer/touch reads outside `bindSelectIntent`.
- Placeholder-first art stays as-is (coloured rectangles / existing
  tile textures); no new art needed for this brief.
- Every tunable above must be Tweakpane-exposed, available in
  production via `?debug=1`, with a "copy as JSON" button — digger
  currently has no Tweakpane panel at all, so this brief adds it for
  the first time, covering both the old and new tunables.
- No version stamp — digger predates that house rule and is explicitly
  not being retrofitted, per CLAUDE.md.
- Follow the new `## Persistence` house rule added to CLAUDE.md in
  step 1 above (versioned localStorage key, save on every
  state-changing action, timestamp-based offline progress).
- One branch for this task (`proto/digger/idle-mining-loop`), single
  purpose, small PR.
- Verification before reporting done: `npm run typecheck`,
  `npm run build`, Playwright screenshot inspected, no console errors
  on boot — actually run all four, don't describe untested behaviour
  as working.
- At the end of the session, overwrite
  `prototypes/digger/BUILD_STATUS.md` in full (not appended) using the
  standard six-section structure. If anything here was ambiguous and
  you had to guess, say so under "Open questions" rather than resolving
  it silently.

## Out of scope

- Energy cap upgrades (cap is fixed at 32 forever).
- Any UI/animation polish beyond functional clarity — this is a
  mechanics-first pass.
- Sound.
- Any board-size cap or "final" board — depth scaling is open-ended for
  now.
- Cross-device save sync.
