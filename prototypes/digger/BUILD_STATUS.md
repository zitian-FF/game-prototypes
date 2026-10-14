## Current milestone

Scope steps 1 and 2 plus the first feel pass. Playable on a phone-sized
portrait canvas. Not yet playtested by the user.

## What was implemented

- Replaced the old digger game. The old build is archived untouched as
  `prototypes/digger-legacy` (also tagged `archive/digger-v1`).
- One 6x8 board, 3 layers, tile kinds (soft, normal, hardened), weak points,
  hardness vs tool tier (glancing hits).
- Tap ROLL (or Space) to roll. Three tool buttons (or keys 1 to 3) pick the
  tool; dice count is random within the tool's range.
- All five faces with the targeting rules in BRIEF.md.
- Feel: dice tumble, staggered resolve that speeds up with dice count, tile
  shake, white flash, spring drop when a layer breaks, cracks, particles,
  floating damage numbers, rising hit pitch per combo, ring bursts, hitstop,
  camera shake and punch zoom on Critical, Wild and Lucky, vibration.
  Tapping ROLL while a roll is resolving finishes it instantly and rolls
  again.
- Treasures exist in the data (needed by Lucky) and show as gold gems on the
  floor once uncovered. They cannot be collected yet.
- When the board is cleared the ROLL button becomes NEXT BOARD, which only
  generates a fresh board (no progression yet).
- Four art skins behind a `Skin` interface: pastel (default, soft rounded beveled blocks with pastel mint/peach/periwinkle strata), bevel, flat, iso.
- `?debug=1` Tweakpane panel edits `tune.json` values live, switches skin,
  makes a new board, and copies JSON.
- Version stamp (`version.json`, bumped by the deploy workflow).

## Key technical decisions

- Rules (`src/game/`) are pure and separate from the scene, so they can be
  simulated and later tested without Phaser.
- Rendering is one Phaser Graphics redrawn per frame from `CellView` data via
  the `Skin` interface. A sprite skin (or a later Godot/Blender pipeline)
  only has to implement `Skin`.
- `tune` is a live mutable copy of `tune.json` so the debug panel changes
  feel instantly.
- Sounds are synthesised with the Phaser WebAudio context (no files, no new
  dependency).
- Worked on branch `ccr-1e26354f-01jcy9`, not `proto/digger/dice-dig`, because
  the session was assigned that branch.

## Open questions

- Pacing with the approved placeholder numbers is very slow (simulated over
  200 boards): Pickaxe about 630 rolls to clear a board, Hammer about 148,
  C4 about 48. Random targeting scatters damage, so few tiles break per roll
  (0.2 / 1.0 / 3.0). Needs a tuning decision: lower hp, fewer layers or
  tiles, or higher face damage.
- Which art skin to keep (pastel is the current default).
- "Board endurance" (from BRIEF.md) is not built; it is needed for the
  flooding variant. Confirm it is a separate meter from tile hp.
- BRIEF.md was written from the handoff and the confirmed defaults, so it
  may need updating once those are tuned.

## Known issues

- Iso skin leaves a lot of empty space (14 tiles wide at phone width).
- No save/load, energy, pity, or economy yet (later scope steps).
- Sound and feel are untested on a real phone.

## Next proposed step

Playtest the feel pass, settle the pacing numbers and the art skin, then
build step 3 (treasure reveal and tap-to-collect).
