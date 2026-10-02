## Current milestone

Milestone 1.5: the rules engine (`packages/arena-sim` 0.2.0) now models the
grid map, four node tiers, the new scoring and the view rules the client
needs. Still no server logic, bots, or client. Infrastructure is set up but
nothing has deployed: Codex created the private itch.io draft project and
the GitHub Actions secrets, and scaffolded the Worker and both workflows.

## What was implemented

- Grid world (75 x 51 cells of 40 units). Nodes and HQs sit on cell centres,
  HQ slots are the 8 cells around a node, safe zones are 5 x 4 cell blocks,
  marches are still straight lines centre to centre.
- Ring map generator: 35 nodes, point-symmetric, tier 4 alone in the centre,
  tiers 3, 2, 1 outward; power nodes only at tiers 1 and 2 (effect = base x
  tier). Counts and ring edges are in `tune.json` (`map.rings`).
- Scoring: node score per second by tier 10/30/50/80, plus 10 per second per
  commander garrisoned per node. Teleport sends every squad home so it stops
  the garrison bonus.
- Garrison limits (user correction): a node holds at most 20 squads and one
  per commander (`garrison.*` in `tune.json`). The march order is refused
  (`nodeFull`, `commanderAlreadyThere`, also counting squads already marching
  there). A squad that arrives at a full node turns back at normal speed
  with a `garrisonRejected` event. Attackers still fight through at most 10.
- View additions for the client: `garrisonCount` (own exact, others only via a
  live scout report, snapshot at scout time), `burning` on defeated squads
  and damaged HQs (exact HP hidden from enemies), own `hqs` and `scouts`
  lists, `teleported` events carry `from` and `to`.
- 89 headless tests, all passing (map rings/symmetry/grid/spacing, scoring
  rules, tier scaling, view rules, plus everything from milestone 1 and the
  full 40 player fuzz match). Repo typecheck and build pass; `npm ci` accepts
  the lockfile.
- BRIEF.md rewritten for the grid, tiers, scoring, visibility and a full art
  direction section.
- Codex: Worker scaffold (`prototypes/firestorm-arena/server/`), Worker deploy
  workflow, itch workflow, private itch draft project, Cloudflare token
  (Workers Admin, 30 day expiry) and repo secrets `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID` saved; `BUTLER_API_KEY` already existed.

## Key technical decisions

- All UI is drawn in the Phaser canvas, all art is vector drawn by code. No
  React, Tailwind, DOM overlay or image files (user decision; overrides the
  repo's artwork rule for this prototype).
- Garrison bonus set to option C (10 per second) after showing that a flat
  30 would have been about four times the node income and made safe back-line
  farming the best play.
- Node effects scale as base value x tier, so tier 2 is twice tier 1.
- Isometric view with a volcanic setting, lava patches and eruptions are
  cosmetic client randomness, never the sim's seeded RNG.
- The sim resolves fights instantly. The client will play the 2-3 second
  combat animation and show the ownership flip when it ends.
- Authoritative Cloudflare Durable Object over WebSockets, free plan. Codex
  verified limits: 100,000 DO requests/day, 13,000 GB-s/day, 100K SQLite rows
  written/day, each setAlarm counts as a row write.

## Open questions

- Power nodes: I read "powered nodes give tier 1 and 2" as power nodes
  existing only at tiers 1 and 2, scoring at those tiers' rates, with tiers 3
  and 4 pure points. Needs the user's confirmation.
- Enemy command lines are red (user only said "colour coded").
- All node numbers in `tune.json` other than the tier scores and garrison bonus
  are placeholders I chose: effect bases (5% attack/defense, 10% speed, 15s
  teleport), vision radii, turret values, third squad chance, troop variance,
  power variance, ring counts and edges.
- Does a 3 minute cross-map march still feel right with 35 nodes on a 75 x 51
  grid?
- A full ring of stranded HQs blocks the capturing team from teleporting in
  (default, unconfirmed).
- CLAUDE.md and STACK.md still describe the React + Tailwind overlay and need a
  separate cleanup.

## Known issues

- Teleporting returns every squad home and refill is instant on reaching an
  HQ, so teleport is also a free full heal. The garrison bonus loss is the new
  cost. `hq.refillSeconds` is the lever.
- HQ defenders that lose a fight are refilled immediately (same rule).
- `viewFor` is a snapshot. Streaming enemy marches to clients exactly when
  they cross vision circles is not built.
- Speed boosts are read when a march starts, not continuously.
- Showing enemy command lines reveals the enemy march's origin and destination
  while it is visible (the view already carried the route).
- The Cloudflare token is account-wide Workers Admin with a 30 day expiry:
  narrow it to Editor on this Worker after the first deploy.
- Codex could not create the local `.env` (it has no checkout on the user's
  PC), so keys exist only as GitHub secrets. Local `wrangler dev` needs none.
- No client, so the Playwright screenshot and console checks do not apply yet.
  Nothing in the Durable Object, protocol, lobby or bots exists or has run on
  real Cloudflare. Nothing has deployed (workflows only run on push to main).

## Next proposed step

1. User answers the open questions above (power node tiers is the main one).
2. Milestone 2: wire arena-sim into the Durable Object: WebSocket protocol,
   lobby (host Start with a 3 second cancel, bot fill), per-team filtered
   broadcasts, alarms from `nextEventAt`, and bots that capture, defend and
   attack through the same commands. Keep the client entry at
   `prototypes/firestorm-arena/index.html` with source under `src/` for the
   itch workflow.
3. Milestone 3: Phaser isometric client: grid, units, node cubes, fog,
   commands, command lines, scout review and combat log buttons, lobby.
4. Milestone 4: polish effects (lava, eruptions, combat sprays and
   explosions, fire, teleport extract and landing).
5. User approval before the first real deploy (merge to main, then dispatch).
