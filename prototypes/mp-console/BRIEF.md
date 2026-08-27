# mp-console

Peer-to-peer multiplayer session base. This is infrastructure, not a game:
it establishes host/player connection, lobby, and a generic messaging layer
that future game prototypes will build on top of, then proves it end to end
with a minimal test mechanic. No art assets, placeholder rectangles/text
only (same approach as suits).

## Stack

Phaser 3 + TypeScript + Vite, same as the other prototypes, plus:

- `trystero` (`trystero/nostr` strategy) for serverless WebRTC
  peer-to-peer connections. No relay config or credentials needed.
- `qrcode` for client-side QR code generation.

## Flow

1. Visiting the URL with no query params = HOST.
   - Host generates a 5-character alphanumeric lobby code.
   - Enters lobby scene: shows lobby code, a QR code encoding the current
     page URL + `?lobby=<code>`, and a live list of joined players.
   - Host calls `joinRoom({appId: 'mp-console'}, lobbyCode)` from trystero.

2. Visiting with `?lobby=XXXXX` = PLAYER.
   - Immediately joins that room via the lobby code.
   - Shows a simple "connecting / waiting for host to start" screen.

## Networking layer (`src/net/`)

The reusable part future prototypes will build on:

- `input`: single integer bitmask, for discrete button states. Only sent
  on change, not every frame.
- `analogInput`: small `{x, y}` pair, for continuous input, separate from
  the bitmask channel. Defined here for future prototypes; unused by
  mp-console's own test mechanic.
- `hostUI`: plain object, host -> player(s), for pushing UI/state updates
  to a specific player's device.
- `identity`: handshake action. On join, player sends a persistent client
  ID (generated once, stored in localStorage). Host keeps its player
  roster keyed by this ID rather than trystero's peerId.

### Reconnect handling

If a player's connection drops and they rejoin via the same lobby
code/QR, the `identity` handshake lets host match them to their existing
roster slot instead of creating a new one. Actual game-state resync
beyond the roster/counter is a hook (`onPlayerReconnect`-shaped: the host
re-sends `hostUI: {type: 'gameStarted'}` targeted at the reconnecting
peer once identified) that future game layers extend; mp-console only wires
up the counter state described below.

If the peer that leaves is the host, players detect this specifically
(by tracking the first peer they ever saw in the room, which is always
the host, since the host is already in the room when a player joins) and
show a "host disconnected, session ended" screen. No host migration.

No hard-coded max player count.

### Orientation handling

No hard orientation lock. Each scene is laid out for its expected
orientation (host = landscape, player = portrait). Actual device
orientation is detected via `matchMedia('(orientation: portrait)')`, and
a "please rotate your device" overlay covers the scene content when it
doesn't match.

## Start Game flow + test counter mechanic

End-to-end test of the networking layer.

**Host flow**: Lobby scene gets a "Start Game" button, enabled once at
least one player has joined. Pressing it broadcasts `hostUI: {type:
'gameStarted'}` to all connected players and transitions the host to a
landscape scene listing all joined players (keyed by persistent client
ID), each with a counter starting at 0.

**Player flow**: On `gameStarted`, player transitions to a portrait scene
with one big button, nothing else. Each press sends the `input` bitmask
action, bit 0 for this button.

**Counter logic**: Host tracks each player's counter, keyed by client ID
(not trystero's transient peerId). Host is authoritative. Increments on
the 0->1 transition of bit 0 only (press edge), not while the bit stays
1. Host scene re-renders the affected player's counter live.

**Reconnect**: If a player reconnects mid-game (same lobby code/QR),
their counter value persists host-side keyed by client ID. They land
back in the one-button screen, not the lobby.

## Out of scope

Any visual polish beyond placeholder rectangles/text, host disconnect
handling beyond what's specified above, persistence across a host
reload (host reload is still "host disconnect ends session"), TURN
server config.
