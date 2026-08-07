# mp-net

Peer-to-peer multiplayer base for players connecting over the internet,
not just the same room. Same underlying stack and networking patterns as
mp-base (Trystero, Nostr strategy, identity handshake, hostUI/input/
analogInput/inputDelta actions), adapted for remote-specific UX: host/join
landing screen, shared invite links, TURN fallback, distinguishable
connection failures, and a "game already in progress" rejection for
strangers joining a running session. No art assets, placeholder
rectangles/text only.

## Stack

Phaser 3 + TypeScript + Vite, same as the other prototypes, plus:

- `trystero` (`trystero/nostr` strategy) for serverless WebRTC
  peer-to-peer connections.
- `tweakpane` for the debug tuning panel (`?debug=1`).

## TURN relay

A Cloudflare Worker at `https://mp-net-turn-relay.tianz-88.workers.dev`
mints short-lived TURN credentials, gated to this project's own origins.
Before joining any room, the client fetches this Worker (see
`src/turn/turnConfig.ts`), parses the returned `iceServers` array, and
passes it into Trystero's `turnConfig` (additive to Trystero's own default
STUN servers). If the fetch fails or times out for any reason, the client
falls back to joining without it - direct/STUN-only connections still work
for peers that don't need TURN.

## Flow

1. Visiting the URL with no params shows a landing screen: **Host** or
   **Join**.
2. Visiting with `?lobby=XXXXX` (a shared invite link) skips the landing
   screen entirely and goes straight into the join-attempt flow for that
   code.

### Hosting

**Host** generates a 5-character room code (alphabet excludes 0/O/1/I/L).
It joins the Trystero room under that code and waits a short window
(`tune.json`'s `hostOccupancyCheckMs`) for any peer to appear - if one
does, someone else is already hosting that code, so the code is silently
discarded and regenerated (capped at a few attempts as a safety net, not
expected to matter in practice with a 32^5 code space).

Once settled, the host lands in the lobby: room code, a "copy code"
button, a "copy invite link" button (current page URL + `?lobby=<code>`),
and a live player list. The host counts as a participant, so **Start
Game** is available immediately, even with nobody else in the room yet.

### Joining

**Join** shows a text input (forced uppercase, whitespace stripped as
typed, exactly 5 valid characters required before the connect button
enables). Manual entry and an invite link both feed the same
`ConnectingScene` attempt flow.

Connecting has a timeout (`tune.json`'s `connectionTimeoutMs`) and
distinguishes three failure states plus one host-side rejection:

- **Room not found** - the timeout elapsed and no peer of any kind was
  ever seen on that code (nobody's announcing there).
- **Connection failed even after TURN fallback** - Trystero's
  `onJoinError` fired (peers exchanged SDP but WebRTC still couldn't
  connect).
- **Generic timeout** - the timeout elapsed after a peer *was* seen but
  the host never sent back a recognized response.
- **Game already in progress** - the host responded, but rejected this
  client ID because the game has started and it has no roster slot.

### Lobby behaviour

Presence alone counts as ready; there's no separate ready toggle. A
player leaving pre-game is a clean roster removal, no held slot. Peer-leave
detection is debounced by `tune.json`'s `disconnectDebounceMs` before
anything is removed from the visible list, so a mobile connection blip
doesn't cause flicker - if the same client ID reappears before the debounce
timer fires, the pending removal is simply cancelled.

The host leaving pre-game (or mid-game) ends the session for everyone else;
no host migration.

### Start Game + inputDelta counter test

End-to-end test of the networking layer, with the host included as a full
participant.

**Host screen** (landscape): every participant including the host (host's
row suffixed "(Host)"), each with a counter starting at 0, plus the host's
own big button.

**Player screens** (portrait): a single big button, nothing else.

Uses the `inputDelta` action rather than the bitmask `input` action:

- Every device accumulates a local `pendingDelta` counter on each press -
  a local event, always reliable regardless of network conditions.
- Send-when-idle: if no send is in flight, the current `pendingDelta` is
  sent and reset to 0; presses keep accumulating while a send is in
  flight; when it resolves, a nonzero `pendingDelta` triggers another send
  immediately. This naturally batches rapid clicking (see
  `src/net/deltaSender.ts`).
- The host adds each received delta directly to that participant's
  counter (keyed by persistent client ID, no edge detection needed) and
  re-broadcasts the updated total via `hostUI` to all peers.
- No row - including the host's own, for the host's own presses - updates
  its displayed number anywhere except from inside the same
  apply-then-broadcast function. This is intentional: the visible delay is
  what proves the round trip is actually working over a real connection,
  not a local optimistic update pretending to.

### Reconnect (mid-game only)

Same identity-handshake pattern as mp-base: a persistent client ID in
`localStorage`, sent on join. If the game has already started, the host
matches an incoming identity to an existing roster slot (a reconnect) and
sends them straight to the button screen with their counter preserved
host-side. An identity with no matching slot gets the "already in
progress" rejection instead. The room stays open indefinitely for
reconnects once started - no session timeout.

## Out of scope

Any actual game logic beyond the counter test, visual polish beyond
placeholders, player cap enforcement, host migration on host disconnect
(still ends the session, same as mp-base).
