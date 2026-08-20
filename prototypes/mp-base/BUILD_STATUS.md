## Current milestone

Complete and stable. mp-base is the peer-to-peer networking foundation
(host/player lobby, identity handshake, reconnect, the `input`/
`analogInput`/`hostUI`/`identity` action layer) that mp-net and
suits-mp both built on top of. No open work is in flight on mp-base
itself; it now mainly serves as the reference implementation new
networked prototypes copy from. Version stamp counter is at 5
(`version.json`).

## What was implemented

- Host/player flow via Trystero's Nostr strategy: no query params =
  host (generates a 5-char lobby code, shows a QR code + live player
  list); `?lobby=XXXXX` = player, joins directly.
- Networking layer under `src/net/`: `input` (bitmask, sent on change
  only), `analogInput` (defined for future prototypes, unused by
  mp-base's own mechanic), `hostUI` (host -> player pushes), and
  `identity` (persistent client-ID handshake stored in localStorage,
  so host keys its roster by client ID rather than Trystero's
  transient peerId).
- Reconnect handling: a rejoining player with a matching identity is
  slotted back into their existing roster entry (counter value
  persisted host-side) rather than treated as new. Host-leaves-session
  is detected via "first peer ever seen in the room" and shown as a
  terminal "host disconnected" screen; no host migration.
- Orientation guard via `matchMedia('(orientation: portrait)')` per
  scene (host expects landscape, player expects portrait), overlay
  shown on mismatch rather than a hard lock.
- End-to-end test mechanic: host's Start Game broadcasts `hostUI:
  {type: 'gameStarted'}`; player screen is one big button sending the
  `input` bitmask; host increments each player's counter on the 0->1
  press edge only (host-authoritative), re-rendering live.
- Root CLAUDE.md's Networking section rule (pinned Nostr relay list
  instead of Trystero's `appId`-derived default) applies to mp-base;
  see PR #14 referenced there for the original fix.

## Key technical decisions

- Roster keyed by persistent client ID, not Trystero's peerId, so
  reconnects can be matched deterministically.
- No hard-coded max player count.
- No host migration on host disconnect - by design, out of scope per
  BRIEF.md.
- `input`/`analogInput`/`hostUI`/`identity` action shapes were
  designed to be reused as-is by future networked prototypes (mp-net
  did; suits-mp diverged only on masking, see suits-mp's own
  BUILD_STATUS.md).

## Open questions

None outstanding.

## Known issues

None tracked. BRIEF.md's "Out of scope" explicitly excludes visual
polish beyond placeholders, host-disconnect handling beyond the
"session ends" behavior, persistence across a host reload, and TURN
server config (added later in mp-net, not mp-base).

## Next proposed step

No further work planned on mp-base itself. Any new networking need
should be evaluated against mp-net (which already supersedes mp-base
for internet-scale/TURN scenarios) before touching this prototype
again.
