## Current milestone

Bootstrap/placeholder stage only. Digger has a working R2 asset
pipeline, a DPR-aware mobile-portrait canvas, and one interactive
mechanic: tap a grid tile to deplete its durability until it becomes a
hole. There is no BRIEF.md for this prototype (see Open questions) and
no game loop beyond that single tap interaction — no scoring, no depth
progression, no win/lose condition, no ship movement or control. This
reads as very early placeholder-mechanic work, consistent with the
house "placeholder-first" rule.

## What was implemented

- `src/main.ts` (`DiggerScene`, the entire prototype so far):
  - Loads `assets/manifest.json` (from `pack-assets.js`), then
    generically loads every `loose/` entry by filename-minus-extension
    as a texture key, and one shared atlas (`assets/atlas/atlas.png` +
    `.json`) plus `assets/atlas/animations.json`. Animation configs are
    derived from atlas folder names/frame counts read out of
    `animations.json`, never hand-maintained, per the house art-pipeline
    rule.
  - A 5x6 tile grid (`GRID_COLS`/`GRID_ROWS`) of `tile_grass` sprites,
    each given a random durability of 1-3 (`Phaser.Math.Between(1, 3)`).
    Tapping a tile (via the shared select-intent pattern) decrements its
    durability; at 0 it swaps texture to `tile_hole` and stops
    responding to further taps.
  - A `player_ship` sprite positioned below the grid, playing its atlas
    animation and bobbing vertically via a tween. Bob amplitude/duration
    are read from `tune.json` (`shipBobAmplitudePx`, `shipBobDurationMs`)
    and the pixel amplitude is converted into world units by dividing by
    the art-scale zoom so it reads the same regardless of zoom level.
  - Two-camera setup: a gameplay camera zoomed to fit the tile art into
    the 390x844 logical canvas, plus a second UI camera (ignoring the
    game world, ignored by the game world) so the `build <sha>` debug
    text in the top-left stays sharp and unaffected by the gameplay
    camera's art-scale zoom.
  - Device-pixel-ratio handling: canvas backing store sized at
    `WIDTH/HEIGHT * PIXEL_RATIO` (capped at 2x), both cameras additionally
    zoomed by `PIXEL_RATIO` and re-centered on the logical world center,
    so all existing logical-pixel layout math is unaffected (added in
    the DPR retrofit pass applied repo-wide to pre-existing prototypes).
- `src/input/intents.ts`: a single `select` intent
  (`bindSelectIntent` — pointerdown -> world coordinates -> callback).
  Byte-identical to `prototypes/suits`'s copy, intentionally not shared
  per the house "no shared code library, copy until the third instance"
  rule.
- `tune.json`: exactly two tuned values, `shipBobAmplitudePx` (14) and
  `shipBobDurationMs` (3000). Both are read by `main.ts`; neither is
  exposed through a Tweakpane panel (see Known issues).
- Asset pipeline (shared, not digger-specific, but digger is the only
  prototype currently exercising it): `scripts/fetch-assets.js`
  downloads and caches `digger_assets.zip` from R2 keyed on response
  ETag; `scripts/pack-assets.js` atlas-packs `assets-src/packed/*`
  with free-tex-packer-cli (one folder = one animation key), copies
  `assets-src/loose/*` through untouched, and writes a
  hash-and-timestamp manifest — all matching the house art-pipeline
  rules (never keyed on filename, never hand-maintained animation
  lists, loose files never packed).
- CI: `.github/workflows/deploy-digger-itch.yml` fetches+packs digger
  art, typechecks, builds with a relative base, prunes the build down
  to digger's own output, and pushes to itch.io (`zitian-ff/digger`)
  via Butler on any push to `main` touching digger or the shared build
  pipeline. `deploy.yml` (GitHub Pages) also fetches/packs digger's art
  and ships digger as part of the full multi-prototype Pages build
  (hub `index.html` links to `prototypes/digger/`).

## Key technical decisions

- Tile world size is the art's native pixel size; a computed `zoom`
  (screen tile width / native tile width) shrinks the grid to fit the
  390-wide portrait canvas, and PIXEL_RATIO stacks on top of that same
  zoom rather than being a separate transform.
- Screen-to-world conversion accounts for Phaser's camera zoom pivoting
  around the viewport center, not the origin (`toWorldX`/`toWorldY`
  helpers), rather than assuming a naive linear mapping.
- Tile durability is randomized per tile at grid-build time (1-3),
  not read from `tune.json` or any level data — there is no level
  data/config source at all yet, everything is generated in `create()`.

## Open questions

- **No `BRIEF.md` exists for this prototype at all** — not an
  unresolved ambiguity inside an existing brief, but a total absence of
  the source-of-truth spec the house rules say every prototype must
  have ("Each prototype is specified by its own BRIEF.md. The brief is
  the source of truth."). Every design decision above (grid size,
  durability range, what "digging" ultimately means, whether the ship
  moves/controls anything, win condition, scope) was inferred from the
  current code, not verified against any written spec. Flagging this
  as the single most important open item: a `BRIEF.md` should be
  written (or recovered, if one existed outside the repo) before
  further feature work, so scope discipline has something to check
  against.

## Known issues

- **No Tweakpane panel**, despite `tune.json` existing with tunable
  values — the house Tuning rule requires "every prototype ships a
  Tweakpane panel exposing these values, available in production
  builds via `?debug=1`". Digger currently has no `?debug=1` handling,
  no Tweakpane import, and no way to inspect/copy the two tuned values
  at runtime. (Unlike `suits`, which has an explicit BRIEF.md line
  marking Tweakpane/tune.json out of scope, digger has no brief to
  grant this exemption — see Open questions.)
- No version stamp (`version.json` / `version.generated.ts`) — this is
  expected and correct per the house rule ("do not retrofit prototypes
  that predate this rule"), not a bug, but noted here so it isn't
  mistaken for an oversight in a future session.
- The ship sprite is purely decorative: it bobs on a tween but is not
  wired to any input or game state. There is no movement, digging
  depth, resource collection, scoring, or end condition — tapping a
  tile down to a hole has no further consequence.
- Not verified in a real browser/Playwright this session (this session
  was docs-only per its task scope; no code was touched). `npm run
  typecheck` and `npm run build` both pass cleanly as of this snapshot,
  but visual/behavioral correctness on-device was not re-checked here.

## Next proposed step

Write `prototypes/digger/BRIEF.md` first — the prototype currently has
no written spec to build against. Once scope is defined, likely next
implementation steps (pending that brief) are: give the ship an actual
digging/movement mechanic tied to the tile grid, decide what "durability
1-3" should mean for the player (visual feedback, sound cue placeholder,
progress bar?), and add the Tweakpane debug panel the house Tuning rule
requires.
