## Current milestone

Fixed: "Refresh Code" no longer kicks connected lobby players. Root cause
was `room.leave()` (destroys all peer connections), used to work around a
Trystero re-announce lapse that, on investigation, doesn't actually
happen. Also investigated (separate, not fixed) a real relay-propagation
race behind reported "Room Not Found" failures.

## What was implemented

- `HostLobbyScene.refreshRoomCode()`: rewritten from an async leave+rejoin
  (+occupancy-check+fallback) sequence to a single synchronous
  `this.pushLobbyState()` call. No `room`/`actions`/`roster` mutation at
  all - no peer is ever touched.
- Removed the now-dead `refreshCodeError` state end-to-end
  (`lobbyUiStore.ts`'s `LobbyUiState` field + `showHostLobbyRefreshError`/
  `clearHostLobbyRefreshError`, `LobbyFlow.tsx`'s prop + error-toast
  branch, `DomRoot.tsx`'s pass-through) - there's no longer a failure mode
  to report, since the refresh button does no networking.
- `LobbyFlow.tsx`: refresh button now shows a local "Room re-announced."
  toast (reusing the existing copy-toast mechanism) so the tap still gives
  visible feedback.
- `BRIEF.md`'s "Room code refresh" section corrected: the "announcement
  can lapse" premise this feature was built on is wrong (see
  investigation below); documented suits-mp as fixed and mp-net as
  needing the identical fix (separate prototype, out of scope here). Also
  added a new section documenting the relay-propagation race investigated
  per this task's second ask.

## Investigation (why this fix, not a same-code rejoin)

Read `@trystero-p2p/core`'s actual implementation before picking an
approach, per this task's instruction:

- **A non-passive room's announce never lapses.** `strategy.mjs`'s
  internal loop re-publishes presence forever for any open room that
  isn't `passive` (this app never sets that option): warmup at
  233ms/533ms/1333ms after joining, then every ~5.3s, indefinitely, for
  as long as the room stays open. `room.leave()` was never actually
  necessary to keep the room discoverable - there is no scenario where an
  open room's own announcement lapses.
- **A same-code occupancy re-check is impossible without leaving first.**
  Trystero caches one `Room` object per `(appId, roomId)` for the life of
  the page (`occupiedRooms`, cleared only by `leave()`). Calling
  `joinRoom()` again for the current code while the real room is still
  open just returns that exact same room instance - there is no way to
  probe "did someone else grab my code" via a second, disposable room
  object without releasing the real one first. This is a genuine Trystero
  constraint (reported per the task's instruction), not routed around.
- Given both, a refresh under the still-current code has nothing left to
  do at the network level - hence the fix being a pure UI no-op.
- **Not handled**: a different host independently generating the exact
  same 5-character code (32-char alphabet, ~33.5M combinations - see
  `lobbyCode.ts`) while this lobby is idle. Astronomically rare, and per
  the finding above no longer even detectable without the one action this
  fix exists to avoid. If it ever needs handling, it requires either (a)
  running two Trystero rooms in parallel (old one alive for existing
  peers, new one for new joiners) - real added complexity since
  `HostLobbyScene`/`HostGameScene` currently assume one room/actions pair
  - or (b) broadcasting the new code to connected peers and having them
  auto-rejoin (peer-side has no existing auto-reconnect trigger to reuse;
  `PlayerLobbyScene` only reacts to peer-leave with a manual "Return to
  Main Menu", it doesn't retry). Neither was built - not worth the
  complexity for a case this unlikely, and out of scope for "stop kicking
  players on a normal refresh."

## Verification

`npm run typecheck`: pass
`npm run build`: pass

**Real multi-client test** (this sandbox's egress proxy blocks the real
public Nostr relays outright - `connect_rejected: organization policy` -
so this ran against a small scratch local relay implementing just the
REQ/EVENT subset `trystero/nostr` sends, standing in for the blocked
public ones; not committed, reverted after use):

1. Host creates a room (real code, e.g. `3XB5Z`).
2. Two separate real browser contexts join as peers - both reach the real
   in-lobby waiting screen (full WebRTC handshake + identity exchange
   completes for both).
3. Host taps Refresh.
4. Polled both peers' UI state at 50ms resolution for 5s after the tap:
   **neither ever showed a host-disconnected state**, seat count stayed
   at 3/4 throughout, and the displayed code never changed.

Sanity-checked the test itself isn't a false positive by temporarily
reverting to the old `room.leave()`-based implementation and re-running:
the peer's UI immediately (within ~1.4s) flips to a *permanent*
host-disconnected state (there's no code path that clears it back once
set) - confirming the test detects the real bug, and that the fix
removes it.

**Redistribution/other game systems**: untouched - this task only changed
lobby (pre-game) code.

## Open questions

None required asking the user mid-session - investigating the actual
library behavior before implementing (as instructed) made the right fix
unambiguous.

## Known issues

- **mp-net has the identical bug** (documented in `BRIEF.md`) - separate
  prototype, out of scope for this task, needs the same fix.
- **Relay-propagation race** (investigated per this task's second ask,
  not fixed): a joiner's subscription only receives announces published
  *after* it subscribes (`REQ ... since: now()`), so it can miss an
  announce published moments earlier and must wait for the next one - up
  to ~5.3s once past the host's warmup window. This eats into
  `connectionTimeoutMs`'s 8s budget before WebRTC handshaking even
  starts, and is a plausible real contributor to reported "Room Not
  Found" failures on genuinely fresh rooms. Compounding factor:
  `makeSocket`'s `client.send` silently no-ops (no error) if a relay's
  socket isn't OPEN at send time, so an announce due during a relay
  reconnect is silently dropped for that relay with no targeted retry.
  Not fixed here per this task's own scope note ("a fix... may be a
  separate follow-up task, not blocking this one") - candidate fix would
  be a retry-with-backoff on the joiner's own connection attempt.
- The astronomically-rare same-code-collision-during-refresh case is
  intentionally left unhandled (see Investigation above).

## Next proposed step

Either: (a) port this identical fix to mp-net's `HostLobbyScene`, or (b)
address the relay-propagation race as its own task (retry-with-backoff on
join, most likely).
