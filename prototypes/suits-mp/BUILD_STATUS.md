## Current milestone

Real display-name entry, wired end to end: a text field on the Lobby's
landing screen feeds the identity handshake's `displayName`, real roster
entries carry it into the Host's seat list (falling back to a seat-
numbered "Player N" when blank), and `PlayerLobbyScene` (the joining
peer's own "waiting for host" screen) is now DOM-driven too instead of
plain Phaser Text - the last piece of the Lobby flow still on the older
canvas-Text UI. Version stamp counter unchanged (`8`), no deploy has run
yet.

## What was implemented

- **Name-entry field** (`LobbyFlow.tsx`'s landing screen, above the Host/
  Join buttons): a single freeform text input, capped at 20 characters via
  `maxLength`, local component state (like the join-code draft, doesn't
  need to survive a screen switch). Trimmed once at send time (`onHost`/
  `onSubmitJoin` callbacks), not on every keystroke, so a blank/whitespace-
  only entry sends a real empty string rather than a fabricated "Player N"
  - the fallback is computed downstream at render time instead (see
  `lobbySeats.ts`).
- **Threaded through both paths**: `LobbyUiState.onHost`/`onSubmitJoin`
  (`lobbyUiStore.ts`) now take the entered name; `LandingScene` passes it
  into `scene.start('HostLobby', ...)`/`scene.start('Connecting', ...)` as
  a new `displayName` field. `HostLobbyScene.setUpRoom()` uses it for the
  host's own roster entry instead of `''`; `ConnectingScene` sends it in
  the real `identity.send(...)` payload instead of `''`. The one boot path
  that never runs Landing at all - an invite link's `?lobby=` direct-to-
  Connecting boot in `main.ts` - has no UI to collect a name from, so it
  sends `''` like any other blank-name join (same fallback path handles
  it, not a special case).
- **Real roster data replaces `lobbySeats.ts`'s hardcoded `NAMES`**:
  `seatModel()` now takes `SeatInfo[]` (`{ occupancy, displayName }` per
  seat, from `HostLobbyScene`'s `rosterToSeats()`) instead of bare
  `SeatOccupancy[]`. A host/peer seat shows the real `displayName` if
  non-empty (`.trim()`ed defensively at render time too, in case a stray
  value ever reached the roster untrimmed), else `Player ${i + 1}` -
  seat-numbered by the same 1-based row position as the row's own "I"..
  "IV" numeral. Bot seats are unaffected - still the flavor label
  ("Thrall of the Deep"), since bots have no player-entered name.
- **Reconnect preserves the original name unchanged** - verified by
  reading, not by a live test (see "Known issues"): both
  `matchOrCreateRosterEntry` (lobby-phase) and `matchRosterEntryForReconnect`
  (mid-game) only ever update `peerId` on an existing roster entry, never
  `displayName` - the `displayName` field on an incoming `identity` payload
  is only ever read inside the *create-new-entry* factory closure, which
  doesn't run on a match. This is pre-existing mp-core/suits-mp logic, not
  changed by this task; confirmed it still holds after this task's edits.
- **`PlayerLobbyScene` converted to a DOM overlay** (this brief's other
  scene-side ask): all Phaser `Text` objects removed from the scene; it
  now calls `showWaiting()`/`setWaitingHostLeft()`/`hideWaiting()`
  (`lobbyUiStore.ts`) instead, and `LobbyFlow.tsx` gained a new `'waiting'`
  screen rendering the exact same two states the scene already tracked
  (connected-and-waiting / host-disconnected) - see "Key technical
  decisions" for why this stayed a same-behavior conversion rather than
  growing a live seat list for the peer's own view.

## Key technical decisions

- **`'Player N'` fallback numbering matches the Lobby's own seat-row order
  (I/II/III/IV), not `ui/seating.ts`'s egocentric P1-P4 labels.** The
  brief's wording ("matching the existing P1-P4 numbering") could be read
  either way; `ui/seating.ts`'s P1-P4 is deliberately *egocentric* (P3 is
  always "you", computed relative to `yourSlot`) for the in-game view,
  where every player's own screen shows a different labeling of the same
  four seats. The Lobby's seat list is the opposite - one absolute,
  slot-ordered list (`p0`..`p3`, host always row I) that every viewer of
  it should see identically. Reusing the egocentric scheme here would
  actually be wrong (it doesn't apply to a viewer-independent list), so
  "Player N" is 1-indexed against the row's own existing numeral instead.
  Flagging this reading as a judgment call, not a re-ask, since the
  egocentric scheme genuinely doesn't fit this list's shape.
- **`PlayerLobbyScene`'s DOM conversion is a same-behavior swap, not a new
  live-roster feature.** The brief's section 2a asks to "mount `LobbyFlow`
  as a DOM overlay" over both `HostLobbyScene` *and* `PlayerLobbyScene`,
  "the same pattern already used for the in-game DOM overlay." Doing that
  literally for the peer's own waiting screen would tempt adding a live
  seat list there too - but the host currently never broadcasts roster/
  seat state to already-joined peers during the lobby phase (only the
  `lobbyJoined`/`gameStarted`/`roomFull`/`alreadyInProgress` signals), so
  showing one would mean designing and building a new broadcast channel
  and a new "peer's read-only lobby view" screen with no existing
  wireframe to follow - real scope beyond "stop rendering Text, mount
  DOM." Kept the conversion to exactly the two states the scene already
  tracked (waiting / host left), same behavior, different rendering
  layer. Flagging that a real live-roster peer view is a natural next
  step if wanted, not attempted here.
- **Trim happens once, at send time, not per keystroke**: lets someone
  type a trailing space mid-edit without it being silently stripped out
  from under their cursor; the value that actually reaches the network is
  what's trimmed and capped.

## Open questions

- **Confirm the "Player N" numbering call above** (row-numeral-based vs.
  egocentric P1-P4) is what's wanted - reasoned through above, not asked
  up front since it's a very local, easily-reversible rendering choice
  with no networking or data-shape consequences either way.
- **Confirm the `PlayerLobbyScene` scope call above** (same-behavior DOM
  swap vs. a full live-roster peer view) - flagged rather than asked
  since building the fuller version would have meant designing new
  networking surface and new screen content with no wireframe to check
  it against, which felt like it belonged in its own brief rather than
  folded into this one silently.
- Carried over from the prior session's merge, still open: whether
  `JoinEntryScene` (fully unreachable dead code since the DOM's own
  'join' screen replaced its job) should be deleted.

## Known issues

- **Reconnect-preserves-name and real two-device peer join are verified
  by reading the code, not by a live test** - this sandbox's network
  proxy blocks the pinned Nostr relay WebSocket connections outright
  (confirmed via console logs in the prior session and reconfirmed this
  session), so no real second device/browser could actually connect
  through Trystero here. Everything reachable without a real peer
  connection was tested for real: name entry, the real `HostLobbyScene`/
  `ConnectingScene` room-creation and join-attempt flow, the seat-list
  fallback rendering, and the `waiting`/`hostLeft` DOM states (the latter
  via direct store calls, not a real disconnect event, for the same
  reason). A live 2-device test is still needed to verify a real peer's
  name actually reaches the host's seat list and survives a real
  reconnect.
- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); no card-back art yet; Redistribution-log
  content still stubbed (no design handoff yet); Google Fonts fail to load
  in this dev sandbox's network environment (cosmetic fallback only); the
  host's own `'lobby'` screen has no leave/cancel affordance; real
  refresh-in-progress has no loading/disabled visual state on the DOM
  refresh button.

## Next proposed step

A live 2-device pass (outside this sandbox) to confirm real names reach
the host's seat list and survive a real reconnect. Beyond that: a real
peer-visible lobby roster (if wanted, per the open question above),
Redistribution-log content, and card-back art.
