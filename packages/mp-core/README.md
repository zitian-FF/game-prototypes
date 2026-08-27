# mp-core

Version: **0.1.0**

Shared Trystero-based networking primitives for this repo's multiplayer
prototypes. Extracted from mp-net and suits-mp, which had each grown their
own copy of the same identity/reconnect logic.

## What it provides

- **`getOrCreateClientId(storageKey)`** - a stable per-browser client ID
  (independent of Trystero's transient `peerId`), used to match a
  reload/reconnect back to the same host-side roster slot.
- **Generic Trystero action creators** - `createIdentityAction`,
  `createHostUIAction<T>`, `createInputAction`, `createAnalogInputAction`,
  `createInputDeltaAction`. Each prototype composes its own
  `createNetworkActions(room)` from whichever of these it needs, plus its
  own game-specific channels (e.g. suits-mp's `gameAction`/`state`). Not
  every prototype needs the full set - suits-mp only uses `identity` and
  `hostUI`, since its turn-based `gameAction`/`state` channels replace the
  generic `input`/`analogInput`/`inputDelta` bitmask/delta channels that
  mp-net's test mechanic uses.
- **The identity-matched reconnect handshake** - `createReconnectDebouncer`
  (debounces roster removal on disconnect, cancelled if the same client ID
  reappears before the timer fires), `matchOrCreateRosterEntry` (lobby-side:
  reconnect an existing roster entry or create a new one), and
  `matchRosterEntryForReconnect` (mid-game: reconnect an existing entry only
  - a client ID with no roster slot once the game has started is a
  stranger, not a reconnect, and is rejected by the caller).
- **Shared types** - `BaseRosterEntry` (`clientId`/`peerId`, which every
  prototype's own richer `RosterEntry` extends) and `SharedNetData<TActions>`
  (the room/actions/clientId/lobbyCode bundle threaded through player-side
  scenes).

## What it deliberately excludes

These differ between prototypes by design (host-device assumptions, not
generic networking) and stay local to each one:

- The join UI - QR code (mp-console) vs typed room code / invite link
  (mp-net, suits-mp).
- Orientation handling - landscape-only host (mp-console, mp-net's
  host) vs portrait-everywhere (suits-mp).
- TURN Worker fetch/wiring - mp-net and suits-mp fetch ICE servers from a
  Cloudflare Worker for internet play; mp-console has no such concern
  (all peers are physically nearby, no NAT traversal needed).
- `createNetworkRoom` (Trystero `joinRoom` call, relay pinning, per-prototype
  `appId`) - close to identical between mp-net and suits-mp today, but its
  signature already diverges from mp-console's (no TURN options), and it
  wasn't part of this extraction's scope.
- The debounced reconnect grace period (`createReconnectDebouncer`) - mp-net
  and suits-mp both use it; mp-console never had one (its peer-leave
  handling deletes the roster entry immediately, no debounce), so it stays
  on the plain `matchOrCreateRosterEntry` helper without a debouncer wrapped
  around it. Introducing one would be a networking-behavior change, not a
  wiring change.
- Any game-specific action payload, roster field, or UI/scene code.

## Consumers

- **mp-net** and **suits-mp** depend on this package (pinned version, see
  each prototype's own `package.json`), and use the mid-game
  `matchRosterEntryForReconnect` helper (reject a stranger once the game
  has started) plus `createReconnectDebouncer`.
- **mp-console** also depends on this package (pinned version). It differs
  from the other two consumers in shape: it uses `matchOrCreateRosterEntry`
  in *both* its lobby and mid-game scenes (it always accepts a new client
  ID, even mid-game - there is no "already in progress" rejection here),
  has no `inputDelta` channel, and does not use `createReconnectDebouncer`
  (see "What it deliberately excludes" above). See its own
  `BUILD_STATUS.md` for the full detail on this divergence.
