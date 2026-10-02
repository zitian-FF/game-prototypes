## Current milestone

Milestone 1 of the build: the pure rules engine, `packages/arena-sim` 0.1.0,
with headless tests. No server, client, bots or UI exist yet. BRIEF.md is
current with every decision made in the design chat. Codex has scaffolded the Worker/Durable Object and
the two deploy workflows; no deployment has run yet (secrets and the itch.io
project are not set up).

## What was implemented

- `packages/arena-sim` (new shared workspace package, 0.1.0, no Phaser/DOM/
  Cloudflare code, `types: []` enforces it):
  - Seeded RNG, roster rolls (rank to power band, 1-3 squads, finite reserve
    pools, balanced teams), point-symmetric map generator, combat engine.
  - `ArenaGame`: event-queue engine with `advanceTo`, `command`,
    `nextEventAt`. Commands: march, cancel, teleport, scout, setDefend.
  - Rules in: counter as 1.2x power before the exponent, last-in-first-fought
    stacks capped at 10, defeated squads walking home at 50% speed and
    refilling from the pool, ungarrisoned nodes flipping on touch, HQ attack
    with 4 HP and forced return to the safe zone, stranded HQs after a node
    flip, teleport with cooldown and slot rules plus dodge, scouts (3 per HQ,
    3x speed, commander/type/troop-adjusted power, 60s), turret pulses, node
    boosts, points accrual, win and tie-break, combat logs.
  - `viewFor(game, team)`: shared-vision filtered view (masked enemy marches,
    reveals only while a scout reveal is live, last-known node owners,
    enemy HQs only in vision).
- `prototypes/firestorm-arena/tune.json`: every number, none hardcoded.
- 64 headless tests, all passing, including the brief's acceptance targets
  (45m into 60m = 0% vs ~91%; a 50m counter vs 60m is an even fight) and a
  full 40 player, 30 minute fuzz match (invariants checked after every step,
  replay from the same seed is identical, about 100ms per match).
- STACK.md gained an arena-sim entry. `package-lock.json` updated with only
  the new workspace (npm ci dry run passes).

## Key technical decisions

- Authoritative server on a Cloudflare Durable Object over WebSockets, free
  plan. Codex verified current limits: 100,000 DO requests/day (counts HTTP,
  WebSocket messages, RPC and alarm invocations; incoming WebSocket messages
  billed 20:1), 13,000 GB-s/day, SQLite 100K rows written/day. Each setAlarm
  counts as a row write. A fuzz match runs about 1,500 queue events, so an
  alarm-per-event design is roughly 60 matches/day on the free tier.
- The sim is one pure module shared by the Durable Object, Node bot tests and
  the client. Time moves only through `advanceTo`.
- A fight ends when either side is under half a troop, because damage scales
  with the attacker's own troops and an even fight would otherwise never
  reach exactly 0.
- Counter multiplier is applied to power before the exponent (6), which makes
  counters worth up to 20% power instead of about 3.7% as a plain damage cut.
- Squad ids are opaque (`s12`), HQ ids are opaque (`h3`), so the fog view
  cannot leak who owns what.
- Tests run through Vite's SSR loader like `scripts/run-simulate.mjs`, so no
  new test dependency was added.
- Codex recommends a separate itch.io project (`zitian-ff/firestorm-arena:html5`)
  and leaving the Current WIP slot on punchies.

## Open questions

- UI approach is decided: in-canvas Phaser UI, no React/Tailwind/DOM overlay.
  BRIEF.md has been updated. CLAUDE.md and STACK.md still describe the
  React + Tailwind overlay and need a separate cleanup.
- All node numbers in tune.json are placeholders I chose (point rates, boost
  percentages, vision radii, turret pulse/percent/radius, 62 nodes, third
  squad chance 10%, troop variance 10%, power variance 3.5%). None are
  user decisions.
- Defaults still in force from the brief and untested by a human: all nodes
  start neutral, ranks are equal power slices, instant HQ refill, additive
  node stacking, tie-break by who reached the total first, reconnect in
  scope, disconnected players' squads stay and defend.
- BRIEF.md covers the base slot ring only as 8 positions; the visual layout is
  not specified and does not affect the sim.

## Known issues

- Teleporting returns every squad to the HQ at once, and refill is instant on
  reaching an HQ, so teleport doubles as a free full heal for the whole
  player. This follows the brief's rules literally and is the first thing to
  watch in playtesting. `hq.refillSeconds` is the lever.
- HQ defenders that lose a fight are refilled immediately too (same rule), so
  an HQ with checked defenders effectively fights every attacker at full
  strength until the pool runs dry.
- `viewFor` is a snapshot. Streaming enemy marches to clients exactly when they
  cross vision circles is not built.
- Speed boosts are read when a march starts, not continuously.
- No client, so the Playwright screenshot and browser-console checks from
  CLAUDE.md do not apply yet. Typecheck and build pass at the repo root.
- Nothing in the Durable Object, protocol, lobby or bots is implemented or
  tested against real Cloudflare.

## Next proposed step

1. Codex scaffolded the Worker, Durable Object stub and both deploy
   workflows, all verified (typecheck, build, wrangler dry run). Codex has
   been asked to do the manual setup (itch.io project, secrets) with keys kept
   in gitignored local env files only.
3. Milestone 2: wire arena-sim into the Durable Object (WebSocket protocol,
   lobby with host Start and 3 second cancel, bot fill, per-team filtered
   broadcasts, alarms from `nextEventAt`) plus intelligent bots that capture,
   defend and attack through the same commands.
4. Milestone 3: Phaser client, all UI in canvas: lobby, map, node and march
   rendering, fog, command UI, scout review and combat log buttons.
