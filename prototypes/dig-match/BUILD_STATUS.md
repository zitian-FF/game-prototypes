## Current milestone

Two-board version playable: a layered terrain shaft on top, an ore match board
below that digs it. Ready to playtest. Not yet tried on a real phone.

## What was implemented

- Ore board (7x6, 5 colours): swap by drag or tap-tap, upward gravity, endless
  refill that avoids free matches, chains, reshuffle when no move is left.
- Shaft (5 columns, 5 rows visible): endless layered terrain in strata bands
  (grass, dirt, clay, sand, stone, slate, crystal), block hp rising with depth.
  Ore colour N digs column N (coloured chips above the columns). Each hit adds
  more cracks (tapered, with volume) until the block gives way and leaves a dark
  tunnel. Columns dig independently, so the tunnel is jagged; the view scrolls
  down with the shallowest column; a column can lead by at most 3 rows.
- Match sizes: 3 = 1 hit, 4 = 2 hits plus 1 on neighbours (Hammer), 5+ = 4 hits
  plus splash two columns out (C4). Chains and weak-point ore add hits.
- Buried gems: a glint shows through the block; when it breaks the gem pops out,
  hangs, then arcs to the gem counter with a sparkle trail, a ring burst and a
  counter bump.
- Feel: bolts fly from the match to the column, hit shake and flash, dust in the
  strata colour, crack growth, camera shake and punch zoom on big clears, rising
  pitch per hit, backdrop colour changes with depth.
- Logic is pure (`src/game/`): ore board rules and the terrain. A headless run
  of 60,000 random valid moves earlier kept every ore board invariant.

## Key technical decisions

- Uses `dig-kit` pinned to 0.1.0. Terrain rendering lives in this prototype for
  now (not extracted): dice-dig and dig-match both draw pillows from dig-kit but
  their block stacks differ, so extraction waits until the design settles.
- The ore board's grey hardened chunks from the first version are switched off in
  tune.json (chance 0); their code is still in the repo and can be removed.
- `?test=1` exposes a hook for the Playwright script. `?debug=1` shows the
  tune panel.
- Worked on branch `ccr-1e26354f-01jcy9`. The single-board version is in git
  history (commit "Build dig-match scope steps 1 and 2").

## Open questions

- Does upward gravity on the ore board read clearly?
- Is matching a colour to dig its column fun, or too limiting? (Overflow hits go
  to the shallowest column once a column leads by 3.)
- Pacing: hp, hits per match and gem chance are placeholders in tune.json.
- The bottom of the screen is empty on purpose (upgrade shelf later).
- BRIEF.md was written from a discussion and may need updating after playtest.

## Known issues

- No economy, upgrades, saves, offline progress or tap-to-use special pieces yet.
- Frame rate is only measured in a software-rendered test browser.

## Next proposed step

Playtest, then the gem economy and persistent upgrades (hit power, gem value,
splash size).
