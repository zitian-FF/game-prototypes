# Dig Tap

A casual, skill-free, endless tap-to-mine incremental game. Tap blocks to crack
them; cracks build up until the block gives way and reveals the tunnel and any
buried gem. Mobile-first, portrait, one-thumb play. No luck, no energy, no fail
state. Siblings: `prototypes/dice-dig` (luck-based dice) and
`prototypes/dig-match` (match-3 digging). Uses `packages/dig-kit` pinned to an
exact version.

## Core loop

1. Tap a block. It takes tap damage; its neighbours take splash damage (half,
   rounded up, at least 1). The splash pattern grows with the Splash upgrade.
2. Cracks add up on every damaged block (more arms, thicker grooves, darker
   surface). At 0 hp the block gives way.
3. Special blocks chain (see below). A chain plays out in waves about 100 ms
   apart; later waves multiply the gems.
4. When blocks break, everything above them falls to fill the gaps (gravity).
   The wall surface drops, the tunnel above it grows, and the view slides down.
5. Buried gems fly to the gem counter automatically. Spend gems on permanent
   upgrades. Play never ends.

## Block types

- Dirt: the normal block. Strata colour by depth (grass, dirt, clay, sand, stone,
  slate, crystal, 8 rows each). About a fifth hide a gem (glint through the block).
- Rock (untappable): grey with rivets and an X. Taps do nothing ("SPLASH ONLY").
  It takes damage only from splash and blasts, and has 2.5x the health. A rock is
  never stacked on another rock, so every rock always has a tappable neighbour.
- TNT: red. On breaking it blasts the 3x3 around it for 6 damage, rocks included.
- Crystal: purple. On breaking, every touching crystal shatters too, so crystal
  veins chain. About half hide a gem.

## Screen

- Top: depth in metres, gem counter, and a line with damage, splash level, gem
  multiplier, auto pickaxe rate and blocks dug.
- Middle: the shaft, 5 columns wide, 9 rows visible, with a dark tunnel above the
  wall surface.
- Bottom: four upgrade buttons showing level and cost.

## Rules

- Any visible tappable block can be tapped. Falling blocks are tappable too.
- Block health starts at 4 and rises with depth (tune.json). Tap damage starts at 2.
- Gem multiplier per chain wave: +25% for each wave after the first.
- Backdrop colour changes every 10 m.

## Upgrades (gems)

- Power: +1 tap damage per level (splash follows: half, rounded up).
- Splash: level 0 hits the 4 touching blocks, 1 the 8 around, 2 the diamond of
  radius 2, 3 the full 5x5. Max level 3.
- Gems: +25% gem value per level.
- Auto pickaxe: taps the top tappable block of the shallowest column, 0.5 taps per
  second per level, also while the tab is closed (up to 2 hours, at half rate).
- Costs grow by a factor per level. All numbers are in tune.json.

## Persistence

`localStorage` key `dig-tap:save:v2`: gems, upgrade levels, terrain seed, which
blocks were removed in each column and every damaged block, saved on every state change (throttled) and when
the page is hidden. The wall is generated from the seed, so only removals and damage are stored.

## Input

Pointer and touch: a press on a block emits a tapBlock intent. Game logic never
reads the pointer directly.

## Tuning

Everything affecting feel or pace is in `tune.json` and the `?debug=1` panel
(terrain health, gem chance, tap damage, upgrade curves, shake, particles, gem
fly time and arc, sound pitch).

## Out of scope for now

Gem cap (spend sink), a daily or depth milestone chest, upgrade choices beyond the four above, relics, raids, guild base view,
monetization, social features, backend, energy, luck mechanics, levels.

## Success test

Tapping and breaking blocks feels good enough that the player wants one more
tap, and the upgrades make the next stretch of digging feel noticeably faster.

## Open questions

- Pacing of health, gem chance and upgrade costs (placeholders).
- How strong splash, TNT and chains should feel (placeholders in tune.json).
- Whether rocks should ever be tappable at a small damage.
