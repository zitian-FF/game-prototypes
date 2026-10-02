# Firestorm Arena server

This folder contains the Worker entry point and Wrangler configuration. It
routes `/ws/{ROOM_CODE}` to one SQLite-backed Durable Object per room using
`idFromName`. Room codes follow the brief's five-character alphabet, which
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
