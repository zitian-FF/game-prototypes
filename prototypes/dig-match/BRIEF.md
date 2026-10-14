# Dig Match (DRAFT, awaiting approval)

A casual, skill-based, endless match-3 digging game with incremental
progression. The luck-based sibling is `prototypes/dice-dig`. Mobile-first,
portrait, one-thumb play. Reuses the pastel pillow-block look and feel from
`packages/dig-kit` (pinned to an exact version).

## Core loop

1. Swap two neighbouring blocks to make a line of 3 or more of the same colour.
2. Matched blocks break. Blocks above fall, new blocks fill in from the top.
   Chains (cascades) score more.
3. Breaking blocks chips neighbouring hardened blocks and frees gems.
4. Tap each freed gem to collect it.
5. Spend gems on permanent upgrades. Play never ends: there is no fail state.

## Board

- 7 columns by 9 rows (tune.json), 5 block colours to start. Cells stay at
  least 44 px wide on a 390 px logical canvas.
- Each block is a pillow. A normal block is one slab. A hardened block is a
  stack of 2 to 3 grey slabs; the stack height is its health.
- Hardened blocks cannot be swapped or matched. A match next to one removes a
  slab. They fall like other blocks. Weak-point blocks give an extra chip to
  their neighbours when matched.
- Some blocks hold a gem. Matching the block frees the gem.
- Endless: new blocks come from the top, with the colour band and the share of
  hardened blocks and gems changing slowly with depth. Depth is the number of
  rows' worth of blocks cleared. The board always has a valid move; if none is
  left it reshuffles. New blocks never start as a ready-made match.

## Special pieces

- 4 in a line makes a Hammer block: clears its whole row or column when matched
  or tapped.
- 5 in a line, or an L or T shape, makes a C4 block: clears a 3x3 area.
- The old tool names map to match size (3 = Pickaxe, 4 = Hammer, 5 or L/T = C4).
  Upgrades raise their reach and how often they appear.

## Input

- Drag a block toward a neighbour, or tap one block then a neighbour, to swap.
  A swap that makes no match slides back.
- Keyboard (desktop): arrows move a cursor, Space selects and swaps.
- All input goes through the intent layer (swap, collect).

## Economy and incremental layer (later steps)

- Gems are the currency. Gem value grows with combo length and depth.
- Permanent upgrades: gem value, Hammer and C4 power and frequency, a magnet that
  collects gems automatically, a helper that breaks blocks by itself every few
  seconds (also while the tab is closed, computed from a saved timestamp).
- A cap on stored gems that can be raised, as the spend sink.
- Saves to `localStorage`, key `dig-match:save:v1`, on every state change.

## Tuning

Everything affecting feel or pace lives in `tune.json` and the `?debug=1`
Tweakpane panel: swap and fall times, cascade delay, colour count, hardened
share, gem share, special-piece rules, shake and particles.

## Scope order

1. Swap-and-match board, falling, refills, cascades, reshuffle, and the feel pass
   (juice, sounds, screen shake on big chains)
2. Hardened blocks chipped by neighbours, weak points
3. Gems, tap to collect, depth counter
4. Special pieces from 4- and 5-matches
5. Gem economy and persistent upgrades
6. Helper and offline progress, gem cap

Playtest after steps 1 and 2 before building more.

## Out of scope

Dice, luck mechanics, pity score, energy or refresh tokens, levels, move limits,
fail states, raids, guild base view, relics, monetization, social features,
backend.

## Success test

A swap, the break, the fall and the cascade feel good enough that the player
wants one more swap.

## Open questions

- Gravity direction. I propose blocks fall down, as in every match-3 players
  already know. The "digging" feel then comes from the strata colour bands and
  the depth counter scrolling by. Upward gravity (blocks rise as you descend)
  is possible but less familiar for a casual audience.
- Tap-to-collect for gems (as in dice-dig) or auto-collect from the start.
  Proposed: tap first, with a magnet upgrade.
