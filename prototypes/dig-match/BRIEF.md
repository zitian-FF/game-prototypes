# Dig Match

A casual, skill-based, endless match-3 digging game with incremental
progression. The luck-based sibling is `prototypes/dice-dig`. Mobile-first,
portrait, one-thumb play. Reuses the pastel pillow-block look and feel from
`packages/dig-kit` (pinned to an exact version).

## Core loop

1. Swap two neighbouring ore chunks on the ore board to make a line of 3 or more
   of the same colour.
2. The match fires bolts into the shaft column with the same colour (the colour
   chips above each column say which). Each hit adds more cracks to the block at
   the face of that column.
3. When the cracks reach the limit the block gives way. It reveals the tunnel
   behind it and any buried gem, which flies to the gem counter automatically.
4. Columns are dug on their own, so the tunnel gets jagged. The view scrolls
   down with the shallowest column. A column may lead the others by at most 3
   rows; extra hits go to the shallowest column.
5. Play never ends: there is no fail state. Spend gems on upgrades later.

## Screen

- Top: the shaft, 5 columns wide, showing 5 rows. Blocks are pillows coloured by
  strata (grass, dirt, clay, sand, stone, slate, crystal, changing every 8 rows).
  Cleared rows show as a dark tunnel. A gem glint on a block means treasure is
  buried under it. HUD above: depth in metres and the gem counter.
- Bottom: the ore board, 7 columns by 6 rows, 5 ore colours. Endless refill,
  upward gravity (blocks rise to the top row, new ones come in from below),
  chains, and a reshuffle when no move is left.

## Digging rules

- Ore colour N digs shaft column N.
- 3-match: 1 hit. 4-match (Hammer): 2 hits on the column and 1 on each neighbour.
  5 or more (C4): 4 hits on the column, 2 on each neighbour, 1 two columns away.
- Each chain step after the first adds 1 hit. A weak-point ore (coral X) in a
  match adds 1 hit.
- Block hp grows with depth (tune.json). Cracks add up as hp falls.
- Gems: some blocks hide a gem; its value grows with depth.

## Special pieces (later)

The 4-match and 5-match already act as Hammer and C4 through the hit rules above. A
special block you can tap later is not built yet.

## Input

- Drag a block toward a neighbour, or tap one block then a neighbour, to swap.
  A swap that makes no match slides back.
- Keyboard (desktop): arrows move a cursor, Space selects and swaps.
- All input goes through the intent layer (swap, collect).

## Economy and incremental layer (later steps)

- Gems are the currency, collected automatically. Gem value grows with combo length and depth.
- Permanent upgrades: gem value, Hammer and C4 power and frequency, a bigger
  collection effect/bonus, a helper that breaks blocks by itself every few
  seconds (also while the tab is closed, computed from a saved timestamp).
- A cap on stored gems that can be raised, as the spend sink.
- Saves to `localStorage`, key `dig-match:save:v1`, on every state change.

## Tuning

Everything affecting feel or pace lives in `tune.json` and the `?debug=1`
Tweakpane panel: swap and fall times, cascade delay, colour count, hardened
share, gem share, special-piece rules, shake and particles.

## Scope order

1. Swap-and-match ore board with upward gravity, chains, reshuffle, feel (done)
2. Shaft with layered terrain, cracks that build up, tunnel, buried gems, auto
   collection with a fly-to-counter effect (done, replaces the old hardened
   chunks step)
3. Gem economy and persistent upgrades (hit power, gem value, bigger splash)
4. Special pieces you can tap or trigger
5. Helper that digs by itself and offline progress, gem cap

Playtest after each step.

## Out of scope

Dice, luck mechanics, pity score, energy or refresh tokens, levels, move limits,
fail states, raids, guild base view, relics, monetization, social features,
backend.

## Success test

A swap, the break, the fall and the cascade feel good enough that the player
wants one more swap.

## Decisions

- Two boards (shaft on top, ore board below), chosen after the single-board
  version felt like a generic jewel-swapping game rather than mining.
- Ore colour picks the shaft column, so targeting is skill, not luck.
- Gravity on the ore board is upward, to be novel.
- Gems collect automatically with a fancy effect (no tap-to-collect).

## Open questions

- Whether upward gravity reads clearly to casual players; judged in playtest.
- Whether having to match each colour to dig its column feels good or limiting.
