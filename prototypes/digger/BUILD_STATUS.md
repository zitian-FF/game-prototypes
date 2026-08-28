## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, a fixed-size
scale-to-fit board (5x6, no scrolling), a top-right Reset button with
same-button two-step confirmation, and localStorage persistence
(including offline energy regen), with placeholder-to-real art already
swapped in for tiles, ship, ammo, laser hit-effect, and debris.
**This session** added a per-tile HP number, shown in each unrevealed
tile's top-right corner, updating live as the tile takes damage and
disappearing when the tile clears.

CHANGELOG.md was checked before starting: no entries newer than
digger's last touch. No files were touched as a result of that check.

## What was implemented

- `src/main.ts` (`DiggerScene`), the only file touched this session:
  - New constants alongside the existing `BOARD_DEPTH`/`EFFECTS_DEPTH`
    pair: `TILE_LABEL_DEPTH = 1` (sits between the two, per the task's
    own instruction — above tile art, doesn't need to be above effects)
    and `TILE_HP_LABEL_PADDING = 6` / `TILE_HP_LABEL_FONT_SIZE = 16`,
    both board-world (native tile pixel) layout constants, plain
    top-level consts like `GRID_MARGIN_X` rather than `tune.json`
    entries, since this is layout, not game feel.
  - New field `tileHpTexts: (Phaser.GameObjects.Text | null)[]`,
    parallel to `tileSprites`/`state.tiles` with identical indexing —
    `null` for a revealed tile (no number on cleared tiles).
  - New `createTileHpText(col, row, hp)` helper: creates one
    `Phaser.GameObjects.Text` per unrevealed tile at that tile's
    board-world top-right corner, inset by `TILE_HP_LABEL_PADDING`
    (`setOrigin(1, 0)` anchors the text's own top-right corner to that
    point). Monospace, `TILE_HP_LABEL_FONT_SIZE`, black
    (`#000000`, matching the existing ammo badge text style),
    `resolution: PIXEL_RATIO` set explicitly per the house DPR rule
    (new Phaser Text objects don't get sharpened by camera zoom alone).
    Depth set to `TILE_LABEL_DEPTH`.
  - `buildBoard()`: destroys the previous `tileHpTexts` alongside
    `tileSprites` at the top (same respawn-on-every-descend pattern),
    then for each tile pushes either `null` (if already `revealed`,
    e.g. a partially-cleared board loaded from a save) or a freshly
    created label via `createTileHpText`. The label text lives in
    board-world space added directly to the scene (not `hudLayer`), so
    it scrolls/scales with the board's current scale-to-fit zoom
    automatically — folded into the same `this.cameras.main.ignore(...)`
    call tile sprites already use (filtered to the non-null texts).
  - `onTapBoard()`: right after `tile.hp -= shipDamage(...)`, calls
    `this.tileHpTexts[index]?.setText(`${tile.hp}`)` — updates on every
    damaging tap, per the task's exact placement instruction. Inside
    the existing `if (tile.hp <= 0)` clear block, alongside the
    `tile_hole` texture swap, the label is destroyed and its slot in
    `tileHpTexts` set back to `null` — no number remains on a cleared
    tile (the text is only ever visible with a stale sub-zero/zero
    value for the duration of one synchronous function call, before
    the very next line destroys it — never actually paints a frame).

## Key technical decisions

- **Padding/font-size values picked empirically against the real tile
  art, not guessed blind**: `tile_grass.png`'s native size is 99x103px
  (confirmed by reading the PNG header directly), so a 6px inset and
  16px native font size were chosen as proportionate to that, then
  confirmed legible via Playwright screenshots rather than just trusted
  by calculation — both survived unchanged after visual review.
- **HP labels are correctly per-current-board-state, not
  per-fresh-board** — `buildBoard()` reads each tile's *actual* current
  `revealed`/`hp` from `state.tiles` (not "always unrevealed"), so a
  save loaded mid-game with some tiles already cleared correctly shows
  no label on those from the very first render, not just after a live
  clear. Verified explicitly: seeded a board with `tiles[0]` pre-
  revealed before boot, confirmed no label ever appeared on it.
  - **Tile screen-position coordinates for verification had to be
    recomputed, not reused from a prior session's script** — the fixed
    5x6 board at the current `boardViewportHeight` (~367px) is
    *height*-bound (`heightConstraintZoom` < `widthConstraintZoom`),
    so the board is letterboxed *horizontally*: actual per-tile screen
    width is ~58.8px, not the naively-expected `(WIDTH-48)/5=68.4px`,
    and tile columns start at screen x=48, not x=24
    (`GRID_MARGIN_X`). A first verification pass tapped the wrong
    column as a result (landed on the already-revealed tile[0] instead
    of tile[1]) before this was caught and the coordinates corrected —
    a reminder that any future test script must derive tap coordinates
    from the real `boardZoom`/letterbox offset rather than assuming
    the board fills its full nominal width.
- **Depth ordering**: `TILE_LABEL_DEPTH = 1` sits between `BOARD_DEPTH
  = 0` and `EFFECTS_DEPTH = 10`, per the task's own instruction — the
  label needs to render above the tile art it sits on, but has no
  requirement to render above debris/laser effects. Extends, doesn't
  change, the existing depth convention from the prior Z-order fix.
- **This is a pure visual addition to the existing tile lifecycle** —
  no changes to energy, upgrade, descend, laser, or debris logic, per
  the task's explicit scope. The only file touched is `main.ts`.

## Open questions

- **The 7x9 max-bound height-path check still fails** (carried over,
  untouched by this session): at the real measured
  `boardViewportHeight` (~367px), a future 9-row board's tile height
  would fall under `minTileTapPx`. Still needs a human design decision
  before any future task grows a board toward 9 rows.
- **Confirming the Phaser-HUD (not React/Tailwind) implementation
  choice from the prior (reset-button) session** — still open, still
  unaffected by this session, which is board-world (not HUD-layer)
  rendering anyway and so doesn't newly bear on that question.
- The brief doesn't specify exact HUD layout/spacing — still designed
  freely within "functional clarity."
- **Ammo frame-order semantics** (energy 0 = full-looking, energy 31 =
  empty-looking) — still a deliberate departure from convention worth a
  second look during a human playtest.

## Known issues

- No automated tests are checked into the repo — verification relies on
  manual Playwright interaction scripts run locally each session.
- HP label color is fixed black (`#000000`) regardless of the
  underlying tile art's actual local contrast at that corner — reads
  fine against the current placeholder `tile_grass` art (light gray),
  but worth a second look once real (non-placeholder) tile art exists,
  since a busier/darker tile texture could reduce legibility.
- 7x9 max-bound height-path check still fails at current real geometry
  (carried over, see "Open questions").
- Most of the 14 `debris*` tunables are still seeded placeholders, not
  yet human-tuned.
- **Verification note**: the full-repo `npm run build` and
  `npm run typecheck` still fail for reasons entirely unrelated to
  digger (`prototypes/mp-net`/`mp-console`/`suits-mp` can't resolve the
  `mp-core` workspace package) — same pre-existing, out-of-scope issue
  noted in prior sessions, still unresolved, still confirmed unrelated
  to any digger change. Digger itself was verified clean via a scoped,
  temporary Vite config (not committed) that builds only
  `prototypes/digger/index.html`.

## Next proposed step

Resolve the carried-over open items above (Phaser-vs-React UI
placement reading, and the 7x9 height-path bound) when convenient.
Separately: playtest to tune the remaining un-tuned `debris*` values
and other seeded placeholders in `tune.json`.
