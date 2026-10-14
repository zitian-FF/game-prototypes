# Dig Tap

A casual, skill-free, endless tap-to-mine incremental game. Tap blocks to crack
them; cracks build up until the block gives way and reveals the tunnel and any
buried gem. Mobile-first, portrait, one-thumb play. No luck, no energy, no fail
state. Siblings: `prototypes/dice-dig` (luck-based dice) and
`prototypes/dig-match` (match-3 digging). Uses `packages/dig-kit` pinned to an
exact version.

## Core loop

1. Tap any visible block. Each tap deals the same damage (tap power).
2. Cracks add up on the block with every tap: more arms, thicker grooves, a
   darker surface.
3. When its health reaches 0 the block gives way. It leaves a dark tunnel, and a
   buried gem (shown as a glint through the block) pops out and flies to the gem
   counter automatically with a sparkling trail.
4. When a whole row is broken, the view slides down (shaft view): the cleared
   rows become tunnel and the depth counter goes up.
5. Spend gems on permanent upgrades. Play never ends.

## Screen

- Top: depth in metres, gem counter, a line with current tap damage, gem
  multiplier, auto pickaxe rate and blocks dug.
- Middle: the shaft, 5 columns wide, 9 rows visible. Blocks are pillows in strata
  colours that change with depth (grass, dirt, clay, sand, stone, slate,
  crystal, 8 rows each). Cleared rows show as a dark tunnel above.
- Bottom: three upgrade buttons showing level and cost.

## Rules

- Any visible block can be tapped. Taps on a tunnel do nothing.
- Block health starts at 2 and rises with depth (tune.json).
- About a quarter of blocks hide a gem. Gem value grows with each strata band.
- Backdrop colour changes every 10 m.

## Upgrades (gems)

- Tap power: +1 damage per tap per level.
- Gem value: +25% gem value per level.
- Auto pickaxe: taps a random visible block, 0.5 taps per second per level,
  also while the tab is closed (up to 2 hours, at half rate), computed from a
  saved timestamp.
- Costs grow by a factor per level. All numbers are in tune.json.

## Persistence

`localStorage` key `dig-tap:save:v1`: gems, upgrade levels, terrain seed and
every damaged or broken block, saved on every state change (throttled) and when
the page is hidden. The wall is generated from the seed, so only damage is stored.

## Input

Pointer and touch: a press on a block emits a tapBlock intent. Game logic never
reads the pointer directly.

## Tuning

Everything affecting feel or pace is in `tune.json` and the `?debug=1` panel
(terrain health, gem chance, tap damage, upgrade curves, shake, particles, gem
fly time and arc, sound pitch).

## Out of scope for now

Gem cap (spend sink), special tools (hammer, C4), relics, raids, guild base view,
monetization, social features, backend, energy, luck mechanics, levels.

## Success test

Tapping and breaking blocks feels good enough that the player wants one more
tap, and the upgrades make the next stretch of digging feel noticeably faster.

## Open questions

- Pacing of health, gem chance and upgrade costs (placeholders).
- Whether "any visible block" needs more structure (e.g. harder blocks behind
  easier ones).
