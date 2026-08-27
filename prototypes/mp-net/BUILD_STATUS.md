## Current milestone

Complete and stable. mp-net extends mp-base's networking pattern for
players connecting over the internet (not just the same room): landing
screen with Host/Join, shared invite links, TURN fallback, distinguishable
connection failure states, and a "game already in progress" rejection.
It's the networking foundation suits-mp was later built on top of. No
open work in flight. Version stamp counter is at 6 (`version.json`).

This session's change is infrastructure-only: mp-net's client ID
generation, generic Trystero action-channel creation (`identity`/
`hostUI`/`input`/`analogInput`/`inputDelta`), and identity-matched
reconnect handshake (debounced disconnect + roster match-or-create /
match-for-reconnect) now come from the new shared `packages/mp-core`
workspace package instead of a locally duplicated copy also present in
suits-mp. No gameplay, UI, or wire-protocol behavior changed - see "Key
technical decisions" below.

## What was implemented

- Landing screen: **Host** or **Join**; `?lobby=XXXXX` invite links skip
  straight to the join-attempt flow.
- TURN relay integration (`src/turn/turnConfig.ts`): fetches short-lived
  ICE credentials from a Cloudflare Worker
  (`https://mp-net-turn-relay.tianz-88.workers.dev`) before joining any
  room, additive to Trystero's default STUN. Fails open - if the fetch
  fails or times out, joins without TURN (direct/STUN-only still works
  for peers that don't need it).
- Hosting: 5-char room code (excludes 0/O/1/I/L), occupancy-checked
  (`tune.json`'s `hostOccupancyCheckMs`) with capped regeneration retries
  on collision. Host counts as a participant, so Start Game is available
  immediately even solo.
- Manual "Refresh code" button (pre-game only, no background timer):
  leaves and rejoins the Trystero room under the same code to
  re-announce presence (the closest equivalent the public Trystero API
  allows to a lapsed Nostr room announcement), falling back to a new
  code on collision. Real peer roster entries are dropped on refresh
  (host's own slot survives).
- Join flow: 5-char forced-uppercase input, `ConnectingScene` timeout
  (`tune.json`'s `connectionTimeoutMs`) distinguishing four outcomes -
  room not found, connection failed after TURN fallback, generic
  timeout, and game-already-in-progress rejection.
- Lobby: presence-only readiness (no ready toggle), peer-leave debounced
  by `tune.json`'s `disconnectDebounceMs` to avoid mobile-blip flicker.
  Host leaving pre- or mid-game ends the session for everyone; no host
  migration.
- Start Game + `inputDelta` counter test: host screen (landscape) lists
  every participant including the host's own row; every device
  accumulates presses locally and sends via a send-when-idle batching
  sender (`src/net/deltaSender.ts`); host adds deltas to that
  participant's total and re-broadcasts via `hostUI`. No row updates
  itself outside the host's apply-then-broadcast function, by design -
  the round-trip delay is the proof the network path actually works.
- Reconnect (mid-game only): same identity-handshake pattern as
  mp-base; a matched identity is sent straight to the button screen with
  its counter preserved. Room stays open indefinitely for reconnects,
  no session timeout. Unmatched identity gets the "already in progress"
  rejection.
- Root CLAUDE.md's Networking section: pinned Nostr relay list
  (`relay.damus.io`, `nos.lol`, `relay.mostr.pub`, `purplerelay.com`,
  `nostr.data.haus`) instead of Trystero's `appId`-derived default -
  this is the fix documented there (see PR #14) that mp-net specifically
  needed to avoid landing on unreachable hobbyist relays.
- Debug panel (`src/debug/debugPanel.ts`) exposing `tune.json` via
  Tweakpane under `?debug=1`.

## Key technical decisions

- TURN fetch fails open rather than blocking join, so a Worker outage
  degrades to STUN-only rather than breaking hosting/joining entirely.
- Refresh-code is deliberately manual-only, pre-game-only, no passive
  timer - matches the specific failure mode it exists for (idle empty
  lobby), not a general connectivity-monitoring feature.
- `inputDelta` (accumulate-locally, send-when-idle, host adds and
  rebroadcasts) replaces mp-base's simpler bitmask `input` for this
  prototype's test mechanic, specifically to prove round-trip delivery
  under real network latency rather than a local optimistic update.
- mp-core extraction (this session): `packages/mp-core` was scoped down
  from the repo brief's initial assumption. suits-mp turned out *not* to
  share the generic `input`/`analogInput`/`inputDelta` bitmask channels
  at all (it uses its own `gameAction`/`state` channels instead) - only
  `identity`/`hostUI` channel creation and the identity-matched
  reconnect handshake (debounce + roster match) are genuinely shared
  between mp-net and suits-mp, so that's what actually moved into the
  package. mp-net still composes the full generic channel set locally
  via mp-core's per-channel creators. mp-base is intentionally *not*
  wired to mp-core yet (separate later brief, alongside its rename to
  mp-console) - it keeps its own local copy of the same logic for now.

## Open questions

None outstanding.

## Known issues

None tracked beyond BRIEF.md's explicit "Out of scope": no game logic
beyond the counter test, no player cap enforcement, no host migration
(same as mp-base).

## Next proposed step

No further work planned on mp-net itself. It now mainly serves as the
networking/TURN/room-code-refresh reference that suits-mp ported from -
see suits-mp's own BUILD_STATUS.md for what diverged (masking
architecture) and what's still shared verbatim (TURN relay, room code
refresh, identity/reconnect pattern - the latter two now literally
shared via `packages/mp-core`, not just parallel copies). mp-base is a
candidate to also wire onto `packages/mp-core` in a future brief
(alongside its planned rename to mp-console), but that's explicitly out
of scope for this session.
