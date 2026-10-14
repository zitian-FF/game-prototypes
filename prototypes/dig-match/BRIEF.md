# Dig Match

A casual, skill-based, endless match-3 digging game with incremental
progression. The luck-based sibling is `prototypes/dice-dig`. Mobile-first,
portrait, one-thumb play. Reuses the pastel pillow-block look and feel from
`packages/dig-kit` (pinned to an exact version).

## Core loop

1. Swap two neighbouring blocks to make a line of 3 or more of the same colour.
2. Matched blocks break. Blocks below rise to fill the gap (upward gravity, as
   if the player is descending) and new blocks enter from the bottom edge.
   Chains (cascades) score more.
3. Breaking blocks chips neighbouring hardened blocks and frees gems.
4. Freed gems are collected automatically with a flashy effect (gems fly to
   the gem counter in a trail).
5. Spend gems on permanent upgrades. Play never ends: there is no fail state.

## Board

- 7 columns by 9 rows (tune.json), 5 block colours to start. Cells stay at
  least 44 px wide on a 390 px logical canvas.
- Each block is a pillow. A normal block is one slab. A hardened block is a
  stack of 2 to 3 grey slabs; the stack height is its health.
- Hardened blocks cannot be swapped or matched. A match next to one removes a
  slab. They rise like other blocks. Weak-point blocks give an extra chip to
  their neighbours when matched.
- Some blocks hold a gem. Matching the block frees the gem.
- Endless: new blocks come from the bottom, with the colour band and the share of
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

## Decisions

- Gravity is upward (blocks rise toward the top row), to be novel. Easy to flip
  later: it is one setting in the board rules and the spawn side.
- Gems collect automatically with a fancy effect (no tap-to-collect).

## Open questions

- Whether upward gravity reads clearly to casual players; judged in playtest.
