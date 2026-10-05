# Firestorm Arena server

This folder contains the Worker entry point and Wrangler configuration. It
routes `/ws/{ROOM_CODE}` to one SQLite-backed Durable Object per room using
`idFromName`. Room codes follow the brief's three-character alphabet, which
omits ambiguous characters. `/health` is available for a basic deployment
check.

The Durable Object (`ArenaMatch`, in `src/index.ts`) is a thin adapter. All the
game logic (lobby, countdown, the running match, bots, fog-filtered per-team
updates) lives in `packages/firestorm-net`, which runs on the pure `arena-sim`
rules. The adapter accepts hibernatable WebSockets, flushes the room's replay
log to storage, keeps a single alarm set for the room's next wake, and rebuilds
the room from storage if the object was evicted. The tuning numbers come from
`prototypes/firestorm-arena/tune.json`, bundled into the Worker and also sent to
each client at match start, so the two can never disagree.

One WebSocket per player connects to `/ws/{ROOM_CODE}`. The first client to say
`hello` with `create: true` creates the room and becomes host. The protocol is in
`packages/firestorm-net/src/protocol.ts`.

A full 40 player match costs about 1,800 alarms and 2,500 storage row writes,
which fits roughly 40 matches a day on the Workers Free plan.

## Player behaviour log

When a match ends (or the host ends it early), the room writes one small record per **human** player to a separate
Durable Object, `GameLogs`. A record holds: the match and when it started, the result and final points, the player's
team, a hash of their browser's random client id, the display name as typed, whether they played on touch or desktop,
how many times they connected (with each connect and drop during the match, in sim seconds, plus total connected
seconds), the squads they were dealt at the start (type, rank, power, percentile in the slot's range, reveal tier),
their commander score and stats, counts of what they did (marches by kind, HQ attacks,
scouts, teleports, Defend toggles, Return orders, refused orders), when they first acted, their longest idle gap,
orders per tenth of the match, and the ordered list of everything they targeted (node id, kind and tier, or HQ or
cache). It is a few KB per player, written once per match. Bots are never logged. Nothing is ever sent to a client.

Rows older than 90 days are dropped, and the table is capped at 20,000 rows (about 2,000 matches of ten humans), oldest
first. The landing page tells players that anonymous play stats are recorded.

Reading it is for the owner only. Set a secret token once (it is stored in Cloudflare, never in the repo):

```sh
npx wrangler secret put LOG_TOKEN --config prototypes/firestorm-arena/server/wrangler.jsonc
```

or add a secret named `LOG_TOKEN` under Workers, firestorm-arena-server, Settings, Variables and Secrets in the
dashboard. Without it `/admin/logs` does not exist (it answers 404, like any unknown path). Then download:

```sh
curl -H "Authorization: Bearer $LOG_TOKEN" \
  "https://firestorm-arena-server.tianz-88.workers.dev/admin/logs?since=2026-10-01&limit=2000&format=ndjson" > logs.ndjson
```

`since` (YYYY-MM-DD) and `limit` (up to 2,000) are optional, and without `format=ndjson` you get one JSON object with
`total`, `returned` and `records`. Each line of the ndjson is one player in one match, easy to load into a sheet or a
notebook. To page past 2,000 rows, call again with a later `since`.

## Local development

From the repository root:

```sh
npx --yes wrangler@4.143.0 dev --config prototypes/firestorm-arena/server/wrangler.jsonc
```

Wrangler local development does not require API credentials. A real first
deployment creates the Worker and Durable Object class.

Two optional variables exist for testing only. Leave them unset in production:
`TIME_SCALE` (sim seconds per real second) and `PULSE_MS` (minimum ms between
state broadcasts, default 1000).

To check the whole thing against the local Cloudflare runtime with real
WebSocket clients, including killing the runtime mid-match and rebuilding from
storage:

```sh
npm run e2e -w firestorm-net
```

## GitHub Actions secrets

The Worker deploy workflow uses these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Creating a new Worker requires Workers Admin at product scope for the first
deployment. After the Worker exists, replace the token with one scoped to this
Worker with the Editor role.

## Browser build hosting

Firestorm should use its own itch.io project and HTML5 channel:
`zitian-ff/firestorm-arena:html5`. The existing Current WIP slot remains
assigned to Punchies. The itch.io project exists as a private draft. The dedicated Butler workflow is
`.github/workflows/deploy-firestorm-arena-itch.yml`, targeting
`zitian-ff/firestorm-arena:html5`. It uploads only the Firestorm build and
skips until the Phaser entry page and the `BUTLER_API_KEY` repository secret
are present. See the workflow for its path filter and version-counter handling.
