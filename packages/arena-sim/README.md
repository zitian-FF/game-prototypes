# arena-sim

Version: **0.2.0**

The pure rules engine for firestorm-arena (20 vs 20 node-capture arena). No
Phaser, no DOM, no Cloudflare APIs (`"types": []` in the build tsconfig
enforces this), so the same code runs in the Durable Object, in Node bot
tests, and in the client for deriving march positions.

Rules source of truth: `prototypes/firestorm-arena/BRIEF.md`. Numbers source
of truth: `prototypes/firestorm-arena/tune.json`. The package takes a `Tune`
object and holds no balance numbers of its own.

## Use

```ts
import { ArenaGame, generateMap, rollPlayers, Rng, viewFor } from 'arena-sim';

const map = generateMap(new Rng(seed), tune);
const players = rollPlayers(new Rng(seed + 1), tune, playerIds);
const game = new ArenaGame({ seed, tune, map, players });

game.advanceTo(nowMs); // run scheduled events up to this time
const res = game.command({ type: 'march', playerId, squadId, target: { kind: 'node', nodeId } });
if (res.ok) broadcast(res.events);

game.nextEventAt(); // when the server should wake next (Durable Object alarm)
viewFor(game, team); // the only thing that team may be told (fog of war)
```

- **Time only moves through `advanceTo`.** Commands apply at the current sim
  time, so advance to "now" first, then command.
- **Deterministic.** All randomness is a seeded `Rng`; a match is reproducible
  from its seed plus its command log.
- **Event driven.** No tick. `nextEventAt()` is the next arrival, refill, scout
  landing, turret pulse or match end.

## What is in it

| File | Provides |
|---|---|
| `combat.ts` | `resolveFight`: auto-resolved rounds, counter as a power multiplier, node boosts |
| `roster.ts` | Power bands per rank, squad/pool rolls, balanced teams |
| `map.ts` | Grid map: point-symmetric ring layout (tiers 1-4), the 8-cell HQ slot block, safe zone blocks, march speed |
| `game.ts` | `ArenaGame`: state, commands, event queue, points, invariants |
| `fog.ts` | `viewFor(game, team)`: shared-vision filtered view, masked enemy marches |

## Behaviours worth knowing

- **The world is a grid.** Nodes and HQs sit on cell centres, and HQ slots are
  the 8 cells around a node (E, SE, S, SW, W, NW, N, NE). Marches are still
  straight lines between positions, not cell-by-cell.
- **Tiers.** Every node has a tier 1-4. Tier sets score per second
  (`scoring.tierPointsPerSecond`), and a power node's effect is its base value
  times its tier. Tiers 3 and 4 are pure points in the default layout.
- **Scoring.** A controlled node earns its tier score even with no garrison,
  plus `scoring.garrisonPointsPerSecond` for each *commander* garrisoned there
  (once per commander per node). Teleport sends every squad home, so it stops
  the garrison bonus.
- **Views.** `viewFor` gives a team its own nodes' exact `garrisonCount`; for
  anyone else's it is present only while a scout report on the node is live
  and is the count at scout time. Defeated squads and damaged HQs carry
  `burning` flags for the client's fire effects. `teleported` events carry
  `from` and `to`.
- A squad at 0 troops is **defeated**, not deleted: it walks home at 50% speed
  and refills from its player's finite pool.
- Refill is instant on reaching an HQ (`hq.refillSeconds` = 0). Teleporting
  puts every squad at the HQ at once, so it also refills them. That is a
  consequence of the brief's rules, and the main balance lever to watch.
- A fight ends when either side is under half a troop. Damage scales with the
  attacker's own troops, so an exactly even fight decays geometrically and
  would never hit 0 otherwise.
- Marches to an enemy HQ record the HQ's `epoch`. If it teleported meanwhile,
  the attacker "whiffs" and returns home at full speed.
- Node speed boosts are read when a march starts, not continuously.
- Scouts are not affected by speed boost nodes.
- `viewFor` gives a snapshot. Streaming enemy marches to clients as they cross
  vision circles (so they appear exactly when they enter vision) is a server
  concern and not done here.

## Tests

```
npm test -w arena-sim          # all
node packages/arena-sim/scripts/run-tests.mjs combat   # filter by name
npm run typecheck -w arena-sim # src + tests
```

Tests are loaded through Vite's SSR loader (same trick as
`scripts/run-simulate.mjs`), so there is no test framework dependency.

## Versioning

0.2.0 changed node kinds (`pointMedium`/`pointLarge` became `points` plus a
tier) and replaced the circular map with a grid, so it is not compatible with
0.1.0. The only consumer is firestorm-arena, which had not adopted it yet.

Opt-in, pinned by version. Same rule as mp-core (see STACK.md): ship changes
additively, and when this package's version moves, bump every consumer's
declared `arena-sim` pin in the same change, otherwise npm may stop linking the
workspace folder.
