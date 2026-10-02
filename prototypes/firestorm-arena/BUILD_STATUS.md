## Current milestone

Milestone 2 done: the match server. `packages/firestorm-net` 0.1.0 holds the
wire protocol, the lobby and match room, fog-filtered per-team updates and the
bots; the Durable Object in `prototypes/firestorm-arena/server/src/index.ts` is
now a real thin adapter instead of Codex's 501 stub. Verified end to end against
Cloudflare's local runtime with real WebSocket clients. There is still no
client, and nothing has been deployed to real Cloudflare.

## What was implemented

- `firestorm-net` (new package, no Cloudflare or DOM code, runs in Node too):
  - Protocol: hello/start/cancelStart/cmd/ping in, welcome/lobby/matchStart/
    state/cmdResult/pong/error out. Every client message is size-limited,
    schema-checked and rate-limited, and the sender can never choose who a
    command is from.
  - Room: first connector with `create` is host; join-nonexistent, code-taken,
    room-full and match-in-progress are refused; host Start opens a 3 second
    cancellable countdown, with or without bot fill to 20 v 20; humans are split
    across teams; reconnect by client id with a full view; lobby host grace 60s;
    abandonment after 10 minutes with nobody connected; room closes 15 minutes
    after the end.
  - Updates: one patch per team per pulse (1 second) plus the events that team
    may see (fights it only watches arrive as bare `combatFx`). Marching units
    carry no position, clients derive it. The server sends its own `tune` at
    match start.
  - Persistence: a replay log (seed, roster, accepted commands with sim times).
    An evicted Durable Object rebuilds the match exactly. Bot orders are logged.
  - Bots: act only on their team's filtered view. They spread out, scout before
    attacking, attack scouted targets they can clearly beat, cover threatened
    nodes, teleport forward, to refill, or to dodge. In bot-only matches they win
    roughly half the attacks they start, hold 12 to 15 of 35 nodes per side, and
    finish within 2x of each other on score.
- Durable Object adapter: hibernatable sockets, replay log flushed to storage,
  one alarm kept set, room rebuilt from storage, sockets re-bound after a restart.
  `cloudflare.d.ts` declares the few runtime types so no new dependency was added.
- Worker deploy workflow also triggers on `packages/firestorm-net/**` and
  `tune.json`. Worker bundle is 88 KiB (22.75 gzipped).
- 42 server tests (protocol hostile input, wire patches, lobby, commands, rate
  limiting, full 40 player matches through the room, fog leak check over a whole
  match, reconnect consistency, replay rebuild equality, abandonment, cost) plus
  `npm run e2e -w firestorm-net`, which starts `wrangler dev`, plays a whole match
  at 60x with two humans and 38 bots over real sockets, kills the runtime in the
  middle and restarts it with the same storage. All pass. Repo typecheck and
  build pass; `arena-sim` still passes its 89 tests.

## Key technical decisions

- Persistence is a replay log, not a state snapshot: the sim is deterministic,
  so seed + roster + accepted commands rebuild it exactly (a 30 minute match
  replays in well under a second).
- The room wakes once per broadcast pulse (1 second), not at every sim event.
  Events carry their own timestamps so a late batch gives the identical match;
  it only delays when players hear of it, by at most a pulse. This cut a match
  from about 3,700 alarms to 1,800.
- Cost of a full 40 player match: about 1,800 alarms and 2,500 storage row
  writes, so roughly 40 matches a day on the Workers Free plan (limits verified by
  Codex: 100,000 requests/day, 100,000 row writes/day, each setAlarm is a write).
  A test fails if a match gets more expensive than that.
- A bug found and fixed by the tests: wake times computed as `start + t/scale`
  could round to just before an event was due, so the sim never processed it and
  the same wake repeated forever (an alarm loop). Wake times are now rounded up
  to whole milliseconds and wall-to-sim conversion has a sliver of slack. A
  regression test runs at awkward time scales.
- Bots use claims shared within a decision round so teammates do not all pick
  the same node or teleport target.
- Codex's scaffold stayed as the base: same Worker routes, same wrangler config.

## Open questions

- Bot strength and style are a first pass. Whether they feel right needs a human
  playtest, and whether fills should have difficulty levels is unasked.
- A stranger cannot join once a match has started (default, unconfirmed).
- Power nodes at tiers 1 and 2 only, enemy command lines red, and all the
  placeholder numbers in `tune.json` are still unconfirmed (see earlier notes).
- Does a 3 minute cross-map march still feel right on 75 x 51 cells with 35 nodes?
- CLAUDE.md and STACK.md still describe the React + Tailwind overlay.

## Known issues

- Nothing is deployed. The Worker workflow runs on push to main when server,
  arena-sim, firestorm-net or tune.json change, so merging this branch to main
  will deploy the Worker to the real Cloudflare account (secrets exist). That
  needs the user's go-ahead first. The token is account-wide Workers Admin with a
  30 day expiry: narrow it after the first deploy.
- Bots rarely attack HQs, do not model node boosts in fight estimates, and never
  move a garrisoned squad.
- Teleport is still a free full heal (instant refill, all squads home); the lost
  garrison bonus is its only cost.
- `viewFor` is a snapshot per pulse, so an enemy march crossing into vision shows
  up within one pulse, not exactly when it crosses.
- Showing enemy command lines reveals an enemy march's origin and destination
  while it is visible (the view carries the route).
- If a player's socket drops, their squads stay and defend but they cannot give
  orders until they return; there is no AI takeover.
- No client yet, so the Playwright screenshot and console checks do not apply.
- Codex could not create a local `.env` (no checkout on the user's PC), so keys
  exist only as GitHub secrets. Local `wrangler dev` needs none.

## Next proposed step

1. User decides when to merge and deploy the Worker (Codex can then run a manual
   dispatch), and answers the open questions above.
2. Milestone 3: the Phaser isometric client at `prototypes/firestorm-arena/
   index.html` with source under `src/`: connect and lobby (code entry, roster,
   host Start/Cancel, bot fill), grid map and node cubes, units drawn as vector
   outlines, fog, command UI, dotted command lines (self green, allies muted,
   enemies red), scout review and combat log buttons, defender counts, version
   stamp, `?debug=1` Tweakpane. All UI in canvas.
3. Milestone 4: polish effects (lava, eruptions, combat sprays and explosions,
   fire, teleport extract and landing).
