## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, and localStorage
persistence (including offline energy regen), with placeholder-to-real
art already swapped in for tiles, ship, ammo, laser hit-effect, and
debris. **This session** replaced the board's scrollable-camera
rendering with generic scale-to-fit rendering: the board is always
fully visible (zoomed to fit its viewport, letterboxed on whichever
axis has slack), no scrolling at any board size. Board size itself
stays fixed at `gridCols=5`/`gridRowsBase=6` for every board including
every post-descend board — the earlier per-depth row-growth mechanism
(`gridRowsGrowthPerDepth`, `rowsForDepth`) has been removed entirely.
The scale-to-fit geometry is written generically against `state.gridCols`/
`state.gridRows` (not hardcoded to 5x6), and is verified against a
declared max future bound of 7 columns x 9 rows — see "Key technical
decisions" for the real measured numbers and a **known-failing check**
that needs a design call before that bound is ever actually used.

CHANGELOG.md was checked before starting: the two current entries (the
mp-console rename and the React/Tailwind addition) both explicitly say
no action is needed for digger — the rename is scoped to
`prototypes/mp-console/`, and React/Tailwind adoption is opt-in per
prototype only when that prototype's next *UI* work begins, which this
board-geometry task isn't. No files were touched as a result of that
check.

## What was implemented

- `tune.json`: removed `gridRowsGrowthPerDepth` (board size no longer
  grows with depth). Added `minTileTapPx: 44`, the minimum comfortable
  tap target used to sanity-check the declared max board bound (see
  below). `gridCols`/`gridRowsBase` unchanged (5/6).
- `src/state/board.ts`: removed `rowsForDepth`. `generateBoard(depth)`
  now sizes every board at a fixed `tune.gridCols * tune.gridRowsBase`
  tiles regardless of `depth` — `depth` is still used for HP/loot
  scaling (`rollTileHp`, `rollLoot`), untouched.
- `src/state/persistence.ts`: `freshState()`'s `gridRows` is now
  `tune.gridRowsBase` directly (no `rowsForDepth` call).
- `src/input/intents.ts`: removed `bindVerticalDragIntent` entirely —
  with no scrolling at any board size, it had zero remaining callers
  after this session's `main.ts` changes. `bindSelectIntent` is
  unchanged.
- `src/debug/debugPanel.ts`: `RANGE` map's `gridRowsGrowthPerDepth`
  entry replaced with `minTileTapPx: { min: 20, max: 80, step: 1 }`
  (the map is directly typed against `tune.json`'s keys, so this was a
  required fix, not optional cleanup — removing the tune key without
  updating this map fails typecheck).
- `src/main.ts` (`DiggerScene`), the core of this session's work:
  - **`this.boardViewportHeight`** (new instance field) replaces the
    old hardcoded `BOARD_VIEWPORT_HEIGHT = 340` constant. Computed once
    in `create()` via `computeBoardViewportHeight()`, right after
    `artZoom` is known and before cameras/board are built, from real
    measured texture dimensions: ship sprite height (scaled by
    `artZoom`) and `ui_ammo` sprite height (scaled by its own
    width-derived scale), summed with the same fixed HUD-layout
    offsets `renderHud()`/`buildShip()` already used (spacing, text row
    heights, button heights, margins). Every remaining reference to the
    old constant (`setUpCameras()`'s camera height, `buildHud()`'s
    border rectangle, `buildShip()`'s ship-Y placement) now reads this
    field instead.
  - **Per-board scale-to-fit zoom**, computed fresh in `buildBoard()`
    from the board's *actual current* `state.gridCols`/`state.gridRows`
    (not a hardcoded 5x6), stored in the new `this.boardZoom` field:
    `zoom = min(widthConstraintZoom, heightConstraintZoom)`, exactly as
    specified. `boardCamera.setZoom()` moved here from `setUpCameras()`
    (which now only creates the camera at a fixed pixel size, sized
    from `boardViewportHeight`). `boardCamera.centerOn(gridWorldWidth/2,
    gridWorldHeight/2)` auto-centers the board within the fixed-size
    viewport on whichever axis the zoom didn't bind on — no separate
    pan/clamp/slack logic needed, since the camera's own viewport stays
    a constant size independent of the board's world size.
  - **Removed entirely**: `onDrag`, `clampPanCenterY`, `applyPan`,
    `viewportWorldHeight`, the `panCenterY` field, and the
    `bindVerticalDragIntent` wiring in `create()`. No scrolling at any
    board size, per the task brief.
  - **New `screenToBoardWorld`/`boardWorldToScreen` helper pair**
    (in a new "board <-> screen conversion" section) replaces the old
    scroll-aware inline math in `onTapBoard`. Both share the same
    viewport-center point (`WIDTH/2`, `BOARD_VIEWPORT_TOP +
    boardViewportHeight/2`) and board-world-center point
    (`gridWorldWidth/2`, `gridWorldHeight/2`) that `buildBoard()` used
    to zoom/center the camera, and are exact inverses of each other —
    so together they stay correct for any board size up to the
    declared max bound with no further rework, satisfying the "already
    supports up to 7x9" requirement even though nothing currently
    produces a board that size.
  - **`onTapBoard()` hit-test** rewritten to call `screenToBoardWorld`
    and derive `col`/`row` from the result, reading `state.gridCols`/
    `state.gridRows` for bounds (already was, unchanged there). The
    outer viewport-bounds guard now checks the full camera viewport
    (`0..WIDTH`, `BOARD_VIEWPORT_TOP..+boardViewportHeight`) rather
    than the old margin-based bounds, since the board's rendered
    footprint no longer necessarily fills those margins exactly (it
    can be letterboxed on either axis depending on which board size is
    active) — a tap landing in the letterboxed slack space converts to
    a board-world point outside the board's own extent, which the
    existing `col`/`row` range check already rejects, so no separate
    letterbox-bounds check was needed.
  - **Laser tile-to-screen conversion** (right after the
    `tile.hp -= shipDamage(...)` line) now calls `boardWorldToScreen`
    with the same `tileWorldX`/`tileWorldYCenter` used for the debris
    burst, mirroring the hit-test conversion exactly as required,
    instead of re-deriving screen coordinates inline.
  - **`onDescend()`** no longer calls `rowsForDepth` — `state.gridRows`
    is never reassigned, since board size is fixed.
  - **New `verifyMaxBoundFits()`**, called once in `create()` right
    after `computeBoardViewportHeight()`: computes both max-bound
    checks from the task brief against the real
    `this.boardViewportHeight` and `tune.minTileTapPx`, and
    `console.log`s the actual numbers (`console.warn`s additionally if
    either fails) so a future regression here is visible at boot rather
    than silently shipped. This is what produced the real numbers
    reported below — no code was changed to force either check to
    pass, per the task's explicit instruction.

## Key technical decisions

- **Real measured numbers for the two max-bound checks (task
  requirement, reported here as instructed):**
  - `this.boardViewportHeight` = **367.01px** (measured at runtime from
    the loaded ship/ammo textures, via Playwright against a real
    build).
  - **Height path**: `boardViewportHeight / 9` = **40.78px**, vs.
    `tune.minTileTapPx = 44` → **FAIL** (the brief's own estimate of
    "≥396" for this path does not hold against the real number; 367.01
    is below that estimate to begin with).
  - **Width path**: `(WIDTH - GRID_MARGIN_X*2) / 7` = `(390-48)/7` =
    **48.86px**, vs. `44` → **OK**, consistent with the brief's ≈48.9px
    estimate.
  - **This means the declared 7x9 max bound, as currently specified,
    would NOT meet `minTileTapPx` on the height axis if a 9-row board
    were ever actually built** — a 9-row board would need
    `boardViewportHeight >= 396px`, but real HUD content only leaves
    367.01px below the board at the current layout. Per the task's
    explicit instruction, `tune.json`'s `minTileTapPx` and the layout
    were **not** silently adjusted to force a pass — this is flagged
    here (and via `console.warn` at runtime) as a design tradeoff for a
    human to resolve before a 9-row board is ever generated: either
    shrink/compact the fixed HUD content below the board, relax
    `minTileTapPx`, or lower the declared max row bound. See "Open
    questions."
  - The scale-to-fit *formulas* themselves are still correct and
    generic at 7x9 — this failure is a real geometry/content-budget
    constraint, not an implementation bug.
- **Scale-to-fit replaces scroll-to-fit; centering on the board's own
  world-center is what produces "auto-center on whichever axis has
  slack" for free.** Since `boardCamera`'s viewport is a fixed pixel
  size (`WIDTH x boardViewportHeight`) independent of the board's world
  size, and zoom is picked as `min(widthConstraint, heightConstraint)`,
  whichever axis *didn't* bind ends up with rendered content smaller
  than the viewport on that axis — `centerOn(gridWorldWidth/2,
  gridWorldHeight/2)` then centers that smaller content within the
  fixed viewport automatically, showing the camera's own background
  color (`0x0a0a0a`) as letterbox padding. No explicit
  letterbox/pan/clamp math was needed, unlike the removed scroll-based
  approach.
- **`artZoom` (ship/HUD reference scale) and `boardZoom` (per-board
  tile scale) are deliberately two separate fields now.** `artZoom` is
  still derived once from `tune.gridCols` (a fixed reference, used only
  for ship/laser/ammo art sizing) so ship/HUD art doesn't resize itself
  just because a future board has different dimensions than the
  current fixed 5x6. `boardZoom` is recomputed every `buildBoard()`
  call from the board's actual current size and used only for the
  board camera and the hit-test/laser conversion helpers.
- **`computeBoardViewportHeight()` must run after `artZoom` is known
  but before cameras/board/HUD are built**, since it both depends on
  `artZoom` (for the ship's scaled height) and is itself a dependency
  of `setUpCameras()` (camera pixel size) and `buildBoard()` (zoom
  calc) — reordered `create()` accordingly.
- **Board Z-order fix (prior session, unchanged/still correct):**
  explicit `BOARD_DEPTH = 0` / `EFFECTS_DEPTH = 10` constants keep tile
  sprites and `debrisEmitter` stacked correctly regardless of creation
  order, since `buildBoard()` destroys/recreates tile sprites on every
  descend. Untouched by this session.
- **Camera render order (`cameras.main` last in `this.cameras.cameras`)
  is still required** for the laser/HUD to render above the board
  viewport — unaffected by the scroll removal, since it's about camera
  draw order, not board positioning.
- **Why `energyMax = 31`, not 32**: the `ui_ammo` sprite has exactly 32
  frames, one per possible energy value; 0-31 inclusive is 32 distinct
  values, a clean 1:1 mapping.
- **`ui_ammo` frame index = `state.energy` directly, ascending, no
  reversal** — confirmed by explicit instruction in a prior session;
  still flagged in "Open questions" as worth a human playtest look,
  since it renders inverted from conventional meter reading.
- **Hit-testing stays decoupled from the board camera's transform** —
  taps are resolved via the new `screenToBoardWorld` helper against
  `cameras.main`'s fixed logical coordinates (unchanged principle from
  before this session, just a different formula).
- **Persistence writes only on state-changing actions** (tap, upgrade,
  descend), not on every 1-second regen tick.
- **Known crude-input tradeoff, now narrower in scope**: a tap still
  costs energy/fires effects immediately on `pointerdown` with no drag
  distinction — but since board dragging no longer exists at all
  (removed this session), the specific old caveat about "a pan-drag
  gesture also counting as a tap" no longer applies. What remains is
  just the ordinary single-tap-fires-immediately behavior, which was
  already true of every tap and isn't board-camera-specific.

## Open questions

- **The 7x9 max-bound height-path check currently fails** (see "Key
  technical decisions" for real numbers) — this needs a human design
  decision (compact the fixed HUD content below the board, relax
  `minTileTapPx`, or lower the declared max row bound) before any
  future task actually implements board-size-per-depth generation up
  toward 9 rows. Flagging per house rule since this surfaced mid-task
  as a real constraint, not something BRIEF.md anticipated.
- **How board dimensions actually get chosen at generation time is
  intentionally deferred**, not forgotten — this task explicitly
  superseded the earlier per-depth row-growth brief and scoped board
  sizing itself out. `state.gridCols`/`state.gridRows` remain plain
  fields the renderer reads (not hardcoded), ready for a future task to
  drive however it chooses, up to the 7x9 bound verified above (pending
  the open question directly above).
- The brief doesn't specify exact HUD layout/spacing — still designed
  freely within "functional clarity," per a prior session.
- **Ammo frame-order semantics** (energy 0 = full-looking, energy 31 =
  empty-looking) — still a deliberate departure from convention worth a
  second look during a human playtest, not something to silently "fix."
- **Camera render-order is a blanket "HUD renders on top of board"
  rule** — still true, still nothing in the codebase currently wants
  the opposite.

## Known issues

- **7x9 max-bound height-path check fails at current real geometry**
  (40.78px vs. 44px minimum) — see "Key technical decisions" and "Open
  questions." Not fixed here, per the task's explicit instruction not
  to silently adjust `tune.json` or layout to force a pass.
- No automated tests are checked into the repo — verification relies on
  manual Playwright interaction scripts run locally each session, per
  the prototype's placeholder-first/disposable nature.
- The ammo badge text is small (8px font) to fit the circular badge's
  limited diameter — worth a human eye check on an actual phone screen.
- The laser's fade animates `alpha`/`scaleY` to 0 over `tune.laserFadeMs`;
  `scaleX` (length) stays fixed for the whole lifetime — functional,
  not polished, per "mechanics-first" scope.
- Most of the 14 `debris*` tunables are still seeded placeholders, not
  yet human-tuned.
- **Verification note**: the full-repo `npm run build` and
  `npm run typecheck` currently fail for reasons entirely unrelated to
  digger — `prototypes/mp-net`, `prototypes/mp-console`, and
  `prototypes/suits-mp` all fail to resolve the `mp-core` workspace
  package (confirmed via `git stash` that this fails identically with
  none of this session's changes applied). This is a pre-existing,
  out-of-scope repo issue. Digger itself was verified clean via a
  scoped, temporary Vite config (not committed) that builds only
  `prototypes/digger/index.html`, plus `tsc --noEmit`'s digger-specific
  output filtered from the full (also pre-existing-broken) run.

## Next proposed step

Resolve the open 7x9 height-path design tradeoff above before any
future task implements board-size-per-depth generation. Separately:
playtest to tune the remaining un-tuned `debris*` values and other
seeded placeholders in `tune.json`.
