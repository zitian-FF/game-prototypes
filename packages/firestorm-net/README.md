# firestorm-net

Version: **0.2.0**

Everything a firestorm-arena match server needs except the Cloudflare glue:
the wire protocol, the match room (lobby, start countdown, the running match),
fog-filtered per-team updates, and the bots. It depends on `arena-sim` for the
rules and has no Cloudflare, DOM or Node code in it (`"types": []`), so the same
room runs in a Durable Object and in plain Node tests.

The Durable Object (`prototypes/firestorm-arena/server/src/index.ts`) is a thin
adapter: it accepts sockets, flushes the room's replay log to storage, keeps one
alarm set, and rebuilds the room from storage after an eviction.

## Pieces

| File | What it is |
|---|---|
| `protocol.ts` | Client and server message types, and `parseClientMsg`: every client message is untrusted and validated before use |
| `wire.ts` | `WireView`, `diffViews` and `applyPatch`: a team's view goes out whole once, then as small patches. Marching units carry no position (clients derive it from the march and the clock) |
| `events.ts` | `projectEvents`: which game events a team may hear about. A fight you only watched arrives as a bare `combatFx` with no unit details |
| `room.ts` | `ArenaRoom`: lobby, countdown, match, bots, per-team broadcasts, replay-log persistence |
| `bot.ts` | `BotBrain`: plays through the same commands from its team's fog-filtered view only |

## How a room works

- **Lobby.** The first socket to connect with `create: true` becomes host. Others
  join with `create: false`; joining a room that does not exist is refused. The
  host presses start (with or without bot fill), which opens a 3 second window the
  host can cancel. Humans are split across the two teams; bots fill the rest to
  20 v 20.
- **Time.** Sim time is wall time since the match started (times `timeScale`, 1 in
  production). The room wakes once per broadcast pulse (1 second by default). Sim
  events carry their own timestamps, so processing a batch a little late gives the
  same match; it only delays when players hear of it. Bots decide on these wakes.
- **Updates.** Each team gets one patch per pulse, sent to all its sockets, plus
  the events it is allowed to see. A joining or returning player first brings their
  teammates to the shared base, then gets the full view.
- **Persistence is a replay log.** A match is fully determined by its seed, its
  roster and its accepted commands with their sim times. The room emits those as
  `PersistOp`s (`drainPersist`), and `ArenaRoom.restore` replays them to rebuild
  the sim exactly. Bot decisions are logged as commands, so they replay too.
- **Nobody watching.** With no human connected the room stops waking for the sim
  and only keeps an abandon deadline (10 minutes); the match catches up when
  someone returns. The room closes 15 minutes after a match ends, and 60 seconds
  after a lobby host disconnects.

## Bots

A bot is a small state machine. Every 8 to 20 sim seconds (random per bot) it picks an
action by weight (attack 75%, teleport 15%, scout 10%), picks a target, and runs it if it
is legal. Otherwise it waits for the next cycle. It sees only what a player on its team
would see, so it attacks and scouts fogged nodes blind.

- Attack: a squad at the HQ goes to a node or visible enemy HQ, leaning toward nearby
  targets, and toward reinforcing its own nodes while it holds fewer than 3 garrisons. With
  nothing at the HQ and two or more garrisons out, it pulls one back so it can go again.
- Teleport (brings every squad home, emptying garrisons): only legal when its HQ is about
  to be hit, it has no healthy squad at the HQ and two or more wounded ones, or it has
  nothing deployed while sitting in the safe zone.
- Out of troops: when all its squads plus its reserve are less than one full squad, it stops
  acting for good (squads already garrisoned keep defending).

In bot-only matches both teams hold 7 to 10 of the 17 nodes at the end and nodes change
hands 35 to 53 times. A match is about 1,150 commands and 3,000 row writes, roughly 33
matches a day on the Workers Free plan.

## Tests

```
npm test -w firestorm-net        # unit tests, a few seconds, includes full 40 player matches
npm run e2e -w firestorm-net     # real Cloudflare runtime (workerd), real sockets
```

`e2e` starts `wrangler dev` itself, plays a whole match at 60x speed with two
humans and 38 bots, and kills and restarts the runtime mid-match to prove the room
rebuilds from storage.

## Versioning

Opt-in and pinned. Same rule as mp-core and arena-sim (see STACK.md): ship changes
additively, and when a version moves bump every consumer's pin in the same change.
