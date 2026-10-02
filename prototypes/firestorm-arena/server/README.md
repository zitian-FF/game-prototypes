# Firestorm Arena server scaffold

This folder contains the Worker entry point and Wrangler configuration. It
routes `/ws/{ROOM_CODE}` to one SQLite-backed Durable Object per room using
`idFromName`. Room codes follow the brief's five-character alphabet, which
omits ambiguous characters. `/health` is available for a basic deployment
check.

The Durable Object currently returns HTTP 501. It is intentionally only a
scaffold; the WebSocket protocol, lobby, simulation persistence, alarms, and
fog-filtered broadcasts belong to the next server milestone and should use
the existing `arena-sim` package contract.

## Local development

From the repository root:

```sh
npx --yes wrangler@4.143.0 dev --config prototypes/firestorm-arena/server/wrangler.jsonc
```

Wrangler local development does not require API credentials. A real first
deployment creates the Worker and Durable Object class.

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
assigned to Punchies. The itch.io project must be created by the user. The
Butler deploy workflow is deferred until the user resolves the client UI
approach; when it is added, it will use the `BUTLER_API_KEY` repository
secret and a path filter limited to Firestorm client files.
