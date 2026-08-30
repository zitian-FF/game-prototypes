## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, a fixed-size
scale-to-fit board (5x6, no scrolling), a top-right Reset button, and
localStorage persistence, with placeholder-to-real art swapped in for
tiles, ship, ammo, laser hit-effect, and debris. **This session**
replaced the old flat per-tile loot system with multi-tile treasures
(2-4 cell footprints, partial reveal as covering tiles clear, one
lump-sum payout only on full clear) and added Minesweeper-style
8-directional adjacency-hint numbers on cleared non-treasure tiles,
reusing the existing per-tile label system built for HP numbers.

CHANGELOG.md was checked before starting: no entries newer than
digger's last touch. No files were touched as a result of that check.

## What was implemented

- **`tune.json`**: removed `lootChance`/`lootValueBaseMin`/
  `lootValueBaseMax`/`lootValueDepthMultiplier`. Added a nested
  `"treasure"` group (`countMin: 1`, `countMax: 3`, `valuePerCellBase:
  6`, `valueDepthMultiplier: 1.1`) — starting placeholders per the
  task, structured as a group since these four values conceptually
  belong together, a deliberate one-off departure from this file's
  otherwise-flat convention per the task's explicit instruction.
- **`src/state/types.ts`**: `TileState` dropped `loot`, gained
  `adjacent: number` (precomputed 8-neighbor treasure count) and
  `treasureIndex: number | null` (O(1) back-reference into
  `GameState.treasures`, rather than a tile-membership `Set` that
  would need to be threaded around separately). New `Treasure`
  interface: `cells` (tile indices), `value` (lump sum), `clearedCount`
  (the task's data-model section describes this loosely as "which
  cells have been cleared", but the Payout section is explicit about
  tracking a *count* — a scalar count is sufficient since each cell's
  own clear state already lives on that tile's own `revealed` flag;
  a duplicate per-cell list on the treasure would just be redundant,
  desyncable state). `GameState` gained `treasures: Treasure[]`.
- **`src/state/board.ts`**: `rollLoot` removed. New treasure shape
  constants (`TREASURE_SHAPES`, a code constant per the task, not
  `tune.json`, since these are structural, not sliders): 2x1
  horizontal, 2x1 vertical, 2x2 square, and an L-tromino base shape.
  `rotateShape()` rotates a shape 90deg N times via `(col,row) ->
  (-row,col)` then re-normalizes to non-negative offsets — used only
  for the L-tromino (a random 0-3 rotation), since the other three
  shapes are already listed in whichever orientations matter (both
  2x1 directions explicitly; the square is rotation-symmetric).
  `placeTreasures()`: picks a count in
  `[treasure.countMin, treasure.countMax]`, and for each treasure
  tries up to 20 random shape/rotation/anchor combinations, checking
  every resulting cell is in-bounds and unclaimed; a treasure that
  never finds a valid spot is simply skipped (fewer treasures than
  requested), never an infinite loop. Value = `round(valuePerCellBase
  * cellCount * valueDepthMultiplier^depth)`, mirroring the old
  per-tile loot's depth-scaling shape but applied once per treasure.
  `computeAdjacency()`: for every cell, counts how many of its up-to-8
  neighbors belong to any treasure's footprint — computed once from
  the fixed layout (Minesweeper's mine-count convention), independent
  of clear state. `generateBoard()` now returns `{ tiles, treasures }`
  and assigns each tile's `treasureIndex` from the placements.
- **`src/state/persistence.ts`**: save key bumped from
  `digger:save:v1` to `digger:save:v2` — `TileState`/`GameState`'s
  shape changed in a breaking way (see house Persistence rule: bump
  the version rather than migrate). `freshState()` destructures
  `generateBoard()`'s new return shape.
- **`src/debug/debugPanel.ts`**: removed the four `loot*` `RANGE`
  entries. The nested `treasure` group needed real handling, not just
  a dropped binding — Tweakpane's `addBinding` needs a mutable scalar
  property per binding, so the panel now special-cases the `treasure`
  key: skips it in the main scalar loop, deep-copies
  `tune.treasure` (a shallow `{ ...tune }` would keep the *same*
  nested object reference, since ES module imports of one JSON file
  are shared/cached — binding to it directly would have broken the
  "edits a local copy, doesn't feed back into the running game"
  invariant every other key already has for free via copy-by-value),
  and binds its four keys inside a `pane.addFolder({ title: 'treasure'
  })`.
- **`src/main.ts` (`DiggerScene`)**, the bulk of this session's work:
  - New `TREASURE_DEPTH = -1` extends the depth convention below
    `BOARD_DEPTH = 0`. New `TREASURE_PLACEHOLDER_COLOR` (gold) for the
    plain rectangle placeholder — no new art pipeline work, per
    placeholder-first.
  - `tileSprites` is now `(Image | null)[]` — `null` once a *treasure*
    cell clears (see the tile_hole transparency finding below).
    `treasureSprites: Rectangle[]`, one per `state.treasures` entry,
    rebuilt in `buildBoard()` alongside tile sprites/labels.
  - New `treasureWorldRect(treasure)`: computes a treasure's footprint
    bounding box in world units from its cell indices — shared by the
    placeholder rectangle's size/position and the completion debris
    burst's center point, so both agree on where "the treasure" is.
  - `buildBoard()`: builds `treasureSprites` first (destroy-old then
    rebuild, same respawn-on-descend pattern as tiles), each at
    `TREASURE_DEPTH`. Per-tile: a cleared treasure cell gets no sprite
    at all (`null`, not a `tile_hole` swap); everything else is
    unchanged from before. Label logic generalized via new
    `tileLabelForState(tile)`: HP while unrevealed, nothing for a
    revealed treasure cell, the adjacency count for a revealed
    non-treasure cell (blank if 0).
  - `createTileHpText` renamed to `createTileLabelText(col, row,
    value: string)` — same position/font/stroke, now takes an
    arbitrary string so it serves both HP and adjacency numbers.
    **Bug caught and fixed during this rename**: the label's
    `cameras.main.ignore(...)` call was previously batched once in
    `buildBoard()` over the initial set of texts — that batching
    silently wouldn't have covered the *new* adjacency-number texts
    this session creates mid-game in `onTapBoard()` (well after
    `buildBoard()`'s one-time batch already ran), which would have
    made them incorrectly visible through `cameras.main` too, doubled
    up with the correct copy through `boardCamera`. Fixed by having
    `createTileLabelText()` call `this.cameras.main.ignore(text)` on
    itself, making every call site correct regardless of when it runs,
    and removing the now-redundant batched call.
  - `onTapBoard()`'s clear block: branches on `tile.treasureIndex`.
    Non-treasure: unchanged `tile_hole` swap, plus (new) shows the
    adjacency label if `tile.adjacent > 0`. Treasure: destroys the
    tile sprite outright (see below), increments the treasure's
    `clearedCount`, and — only once `clearedCount` reaches the
    footprint size — adds the treasure's `value` to `currency` and
    fires the existing "strong" debris burst at the treasure's center
    (`treasureWorldRect`) as completion feedback, *in addition to* the
    per-tile-clear strong burst that already fires at every clear
    regardless of treasure membership (so completing a treasure
    produces two bursts: the ordinary per-tile one at the just-cleared
    cell, and a second one at the treasure's center) — matches the
    task's "trigger the existing strong burst... as the completion
    moment's feedback" instruction read as additive, not a replacement.
  - `onDescend()`: destructures `generateBoard()`'s `{ tiles,
    treasures }` into `state.tiles`/`state.treasures`.

## Key technical decisions

- **`tile_hole` is confirmed fully opaque — the destroy-sprite
  workaround was needed, not the simple depth-ordering-alone path.**
  The task explicitly asked this be checked against the real asset
  rather than assumed, since network access to re-fetch from R2 wasn't
  available this session — the asset was already present locally
  (fetched by a prior session), so it could still be inspected
  directly: decoded `tile_hole.png`'s alpha channel by hand (no image
  library needed, minimal PNG/zlib decode script) and rendered a
  coarse alpha map. Result: the entire tile silhouette is opaque
  (only the sprite's own soft outer edge is transparent, same as any
  normal sprite) — there is no punched-through transparent "hole" in
  the middle. So for treasure-footprint cells specifically, the tile
  sprite is destroyed outright on clear (`tileSprites[index] = null`)
  rather than texture-swapped, exactly as the task's fallback
  instructed. Non-treasure cells are unaffected and keep the ordinary
  `tile_hole` swap.
- **New finding beyond what the task anticipated: `tile_grass` (the
  *unrevealed* tile art) also has anti-aliased, partially-transparent
  edge pixels** (confirmed the same way: ~300 of its ~10,200 pixels
  are partially transparent, concentrated at the sprite's soft outer
  edge/shadow). This lets a faint sliver of a treasure's gold
  placeholder color bleed through at the seams between *still-covered,
  unrevealed* tiles that happen to sit within a treasure's footprint —
  visible as a thin gold outline tracing the treasure's shape even
  before any of its cells have been tapped. Caught by inspecting a
  descend-flow screenshot closely, not anticipated by the task (which
  only asked about `tile_hole`'s transparency for the *reveal*
  workaround). This is a genuine placeholder-art limitation, not a
  logic bug: real, non-anti-aliased or edge-padded treasure/tile art
  would eliminate it, as would insetting the placeholder rectangle by
  a pixel or two — deliberately not "fixed" here since that's a visual
  polish call and the rectangle is explicitly a placeholder,
  consistent with the task's own instruction not to over-solve a
  known-temporary asset gap. Flagged in "Open questions."
- **Payout timing verified at the data level, not just visually**: a
  deterministic seeded save (one 2x2 treasure, one cell pre-revealed)
  was used to tap the remaining three cells one at a time, reading
  `localStorage` after each tap — `currency` stayed exactly 0 through
  the 2nd and 3rd cell clears and jumped to exactly the treasure's
  `value` (999 in the test) only on the 4th (last) cell, with
  `clearedCount` reaching `4` at the same moment. Confirms no
  early/partial/double payout.
  - **Test tile-tap coordinates for a 5x6 board are height-bound
    (letterboxed horizontally)** — carried-over gotcha from a prior
    session's notes, re-derived correctly this time from the start:
    per-tile screen width ~58.8px starting at screen x=48, not the
    naive `(WIDTH-48)/5=68.4px` from x=24.
- **Natural (non-seeded) random generation stress-tested across 15
  fresh boots**: treasure counts landed within the configured
  `[1,3]` range every time, footprint sizes covered 2/3/4-cell shapes
  (confirming the L-tromino's 3-cell shape and its rotation logic
  actually get exercised, not just the fixed-size shapes), every run's
  `treasureIndex` back-references summed to exactly the total treasure
  cell count (no placement/bookkeeping desync), and zero console
  errors across all 15 runs.
- **Descend correctly regenerates both `tiles` and `treasures` for the
  new depth** — verified explicitly (a seeded fully-cleared depth-0
  board, tapped Descend, confirmed depth incremented, board stayed
  5x6, a fresh treasure set was generated, every tile came back
  unrevealed, and `treasureIndex` references stayed internally
  consistent on the new board).
- **Two debris bursts on treasure completion, by design, not a bug**:
  the ordinary per-tile-clear strong burst (existing behavior, fires
  at the just-cleared cell for every clear) plus a treasure-completion
  burst at the footprint's center (new, this session) both fire when a
  treasure's last cell clears — read as intentional "extra feedback"
  from the task's wording, not a duplicate to suppress.

## Open questions

- **Should the `tile_grass` anti-aliasing bleed-through (see "Key
  technical decisions") be addressed now, or left for when real
  treasure/tile art replaces the placeholder rectangle?** Currently
  left alone as a placeholder-art limitation, but flagging since it's
  a new finding the task didn't explicitly anticipate.
- **The 7x9 max-bound height-path check still fails** (carried over,
  untouched by this session, unrelated to the board's actual current
  fixed 5x6 size): at the real measured `boardViewportHeight` (~367px),
  a future 9-row board's tile height would fall under `minTileTapPx`.
  Still needs a human design decision before any future task grows a
  board toward 9 rows.
- **Confirming the Phaser-HUD (not React/Tailwind) implementation
  choice from an earlier session** — still open; this session's work
  is board-world rendering (treasures, labels), not new HUD chrome, so
  it doesn't newly bear on that question either way.
- **Treasure value tuning is untested against the rest of the
  economy** — `valuePerCellBase: 6` was picked as a starting
  placeholder mirroring the old loot system's rough scale, not
  balanced against `upgradeCostBase`/`upgradeCostGrowth` or playtested
  at all; worth a deliberate pass once the mechanic itself is
  confirmed fun.
- The brief doesn't specify exact HUD layout/spacing — still designed
  freely within "functional clarity."
- **Ammo frame-order semantics** (energy 0 = full-looking, energy 31 =
  empty-looking) — still a deliberate departure from convention worth a
  second look during a human playtest.

## Known issues

- **`tile_grass` anti-aliased edges let a faint treasure-color outline
  bleed through even on still-unrevealed treasure-footprint tiles**
  (see "Key technical decisions") — cosmetic only, a placeholder-art
  artifact, not a logic bug.
- No automated tests are checked into the repo — verification relies on
  manual Playwright interaction scripts run locally each session; for
  this session, several deterministic seeded-state scripts plus a
  15-run natural-generation stress check, given the size of this
  system.
- Treasure placeholder art is a single flat-colored rectangle —
  correctly placeholder-first per the task, but has no visual
  distinction between different treasures on the same board beyond
  position (e.g. two treasures both render the identical gold color).
- 7x9 max-bound height-path check still fails at current real geometry
  (carried over, see "Open questions").
- Most of the 14 `debris*` tunables and the new `treasure.*` values
  are still seeded placeholders, not yet human-tuned.
- **Verification note**: the full-repo `npm run build` and
  `npm run typecheck` still fail for reasons entirely unrelated to
  digger (`prototypes/mp-net`/`mp-console`/`suits-mp` can't resolve the
  `mp-core` workspace package) — same pre-existing, out-of-scope issue
  noted in prior sessions, still unresolved, still confirmed unrelated
  to any digger change. Digger itself was verified clean via a scoped,
  temporary Vite config (not committed) that builds only
  `prototypes/digger/index.html`.

## Next proposed step

Playtest the treasure economy (value scaling, treasure density) and
decide on the `tile_grass` bleed-through question above. Separately:
resolve the carried-over open items (Phaser-vs-React UI placement
reading, and the 7x9 height-path bound) when convenient.
