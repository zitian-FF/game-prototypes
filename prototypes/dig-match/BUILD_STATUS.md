## Current milestone

Scope steps 1 and 2 built (swap-and-match board with upward gravity, hardened
blocks, weak points) plus the feel pass. Ready to playtest. Not yet tried on a
real phone.

## What was implemented

- 7x9 board of pillow blocks in 5 colours. Drag a block toward a neighbour, or
  tap one then a neighbour, to swap. Arrow keys and Space work on desktop. A swap
  that makes no match slides back.
- Upward gravity: matched blocks break, survivors rise toward the top row, new
  blocks rise in from below the board. Chains (cascades) are animated step by
  step with a rising pitch. New blocks avoid making free matches. If no valid
  move exists the board reshuffles.
- Hardened blocks (stacks of 2 to 3 grey slabs): cannot be swapped, chipped by
  any match next to them, tapered cracks appear as they are chipped. Weak points
  (coral X) give neighbouring rocks an extra chip when matched.
- Endless: depth in metres from blocks cleared, rock share grows slowly with
  depth, and the backdrop changes colour every 10 m. No fail state.
- Feel: pop and particles in the block colour, floating "+N" / "CHAIN xN",
  hitstop-free but with camera shake, punch zoom and a rising-pitch sound on big
  clears or chains, a shuffle banner.
- Logic is pure and separate from the scene (`src/game/`). A headless run of
  60,000 random valid moves over 200 boards kept every invariant: no empty cell,
  no leftover match, always a valid move, unique block ids. About 0.36 chain
  reactions per move, 2.2% of moves trigger a reshuffle, 5 blocks cleared per
  move on average.

## Key technical decisions

- Uses `dig-kit` pinned to 0.1.0 (sounds, button helpers, tune panel, pillow
  baking, cracks, RNG). Pillows are baked into textures once and drawn as sprites.
- The whole cascade is computed instantly by the rules, then the scene animates
  the recorded steps; input is ignored while it plays.
- `?test=1` exposes a small hook for the Playwright script (a valid move, busy
  flag). `?debug=1` shows the Tweakpane panel (it covers the top right).
- Worked on branch `ccr-1e26354f-01jcy9`, not `proto/dig-match/...`, because the
  session was assigned that branch.

## Open questions

- Does upward gravity read clearly? It was a user choice to be novel.
- With a random bot, hardened blocks pile up at the bottom; real players who
  chip them may see a different balance. Needs playtest.
- The lower 40% of the screen is empty on purpose (room for the upgrade shelf in
  step 5). Confirm the layout, or make the board taller.
- BRIEF.md was written from a discussion and may need updating after playtest.

## Known issues

- No gems, collection effect, special pieces, economy, saves or sounds beyond the
  placeholders yet (later scope steps).
- No hint when the player is stuck (not in the brief).
- Frame rate is only measured in a software-rendered test browser.

## Next proposed step

Playtest, then scope step 3: gems inside blocks, collected automatically with a
fancy fly-to-counter effect, and the gem counter.
