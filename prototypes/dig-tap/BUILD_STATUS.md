## Current milestone

Game loop upgraded: splash damage, untappable rocks, gravity, TNT and crystal
chain reactions, and a gem multiplier per chain wave. Ready to playtest. Not yet
tried on a real phone.

## What was implemented

- Splash: a tap damages the block fully and its neighbours for half (rounded up,
  min 1). Splash upgrade (max level 3) grows the pattern: plus, 3x3, diamond
  radius 2, 5x5.
- Rocks: untappable (clink, "SPLASH ONLY"), 2.5x health, damaged only by splash
  and blasts. Never stacked, so a rock always has a tappable neighbour.
- TNT (blasts 3x3 for 6) and crystal (shatters touching crystals) chain in waves
  100 ms apart; each wave after the first adds 25% to the gems it frees. A chain of
  3 or more waves gets a banner, sound and punch zoom.
- Gravity: blocks above a break fall under gravity with a small bounce and a thump;
  the wall surface drops, the tunnel above it grows and the view follows. Blocks
  hold still while a chain plays, then fall.
- Four upgrades (Power, Splash, Gems, Auto pickaxe). Save is now
  `dig-tap:save:v2` (old v1 saves are ignored).
- Checks: a headless run of 60,000 auto taps over 40 seeds, with splash upgrades,
  kept every invariant (consecutive rows per column, no stacked rocks, no broken
  block left behind) and the auto pickaxe never got stuck or targeted a rock; save
  and restore matched block for block; taps on rocks are refused. Chains reached
  12 waves at most; the auto pickaxe averaged 0.35 blocks broken per tap and 1.03
  waves per tap.
- Playwright run with real clicks: rocks, TNT and crystals appear, tapping works,
  gems and upgrades saved across a reload, no console errors.

## Key technical decisions

- Blocks are generated per original row from the seed, so a save stores only the
  removed rows per column and damaged blocks. Board row = removed count + index in
  the column, so falling is just re-indexing.
- Tap targeting uses where blocks are drawn (they can still be falling), then the
  rules use the block's real row.
- Terrain rendering is still local to this prototype (candidate for dig-kit 0.2.0).
- Worked on branch `ccr-1e26354f-01jcy9`, restarted from `main` after PR #387 was
  merged.

## Open questions

- Feel and pacing: splash half damage, TNT 6 damage, crystal chance 7%, rock chance
  12% and upgrade costs are all placeholders in tune.json.
- Do rocks need a small tap damage so they never feel like a dead end?
- BRIEF.md was updated from a discussion and may need changes after playtest.

## Known issues

- No gem cap, milestone chest or combo meter for rapid taps yet.
- Frame rate only measured in a software-rendered test browser.
- Chains are rare with the default chances; raise TNT or crystal chance to see more.

## Next proposed step

Playtest, then tune the placeholder numbers and decide on the combo meter,
milestone chest and gem cap.
