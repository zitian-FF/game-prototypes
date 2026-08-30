## Current milestone

Wired the DOM Lobby flow (`LobbyFlow.tsx`) to suits-mp's real networking
layer, replacing 100% local placeholder state (room code, seat occupancy,
join validation) with the already-working `net/room.ts`,
`net/lobbyCode.ts`, `HostLobbyScene`, and `ConnectingScene`. Mixed
human/bot lobbies (any real-peer-count + bot-fill combination up to 4) now
work end to end from the DOM. Version stamp counter unchanged (`8`), no
deploy has run yet.

## What was implemented

- **`lobbyUiStore.ts` rewritten as the real state bridge**: previously
  carried only `visible`/`onSinglePlayer`. Now carries `screen`/`roomCode`/
  `seats` plus every networked action (host, submit-join, fill/release bot,
  start, refresh code, back, retry) - the same bridge-store pattern already
  used by `domUiStore.ts` (Rules) and `gameOverlayStore.ts` (Overlay).
  `LobbyFlow.tsx` is now a fully controlled component with no game/network
  state of its own; the only state it still owns locally is the join
  code-entry draft and the transient copy-to-clipboard toast, neither of
  which needs to survive outside a render pass.
- **`HostLobbyScene` and `ConnectingScene` swapped their Phaser Text
  rendering for pushes into that same store**, keeping every bit of their
  existing real logic unchanged: room creation with 5-attempt collision
  retry, the identity handshake (`matchOrCreateRosterEntry`), the
  reconnect debounce, and `ConnectingScene`'s ICE-fetch/timeout/failure
  handling. `LandingScene` now wires the DOM's Host/Join buttons to real
  scene transitions (`scene.start('HostLobby', ...)` /
  `scene.start('Connecting', { ...data, code })`) instead of a local
  `randomCode()` placeholder.
- **Bot fill/release now mutates the real roster**: `HostLobbyScene` gained
  `fillBot(slot)`/`releaseBot(slot)`, each adding/removing a
  `{ isBot: true, peerId: 'bot' }` roster entry at that `NetPlayerId` slot
  (same shape `LandingScene.startSinglePlayer()` already used for Single
  Player) and re-pushing the derived seat list. A real peer's `identity`
  join (`wireRoomHandlers`) and a bot-fill both write into the same
  `roster: Roster` Map that `HostLobbyScene.startGame()` was already
  handing to `HostGameScene` unchanged - so `driveBotsIfNeeded`'s
  `entryForSlot(active)?.isBot` check picks up exactly the seats marked
  bot in the lobby (real peer/host entries have no `isBot`, so they
  correctly wait for input) with no new code needed on the `HostGameScene`
  side.
- **Seat-index <-> slot mapping**: the DOM seat list's index `i` (0-3) is
  defined as `ALL_NET_PLAYER_IDS[i]` (`p0`..`p3`) - host is always seated
  at `p0`/index 0 by `setUpRoom`, matching `nextAvailableSlot`'s own
  assignment order for real peers, so there's no separate mapping table.
- **Error-kind mapping**: `ConnectingScene`'s own `FailureOutcome` vocabulary
  (`roomNotFound`/`connectionFailed`/`alreadyInProgress`/`roomFull`/`timeout`)
  maps 1:1 onto `lobbyContent.ts`'s `ErrorKind`
  (`notFound`/`connFailed`/`inProgress`/`roomFull`/`timeout`) via a small
  table in `ConnectingScene.ts` - same 5 concepts, different names on each
  side of that boundary (already flagged as a gap in an earlier session's
  read-through, resolved here).
- **Error-screen retry semantics preserved from the design, made real**: a
  transient failure (`connectionFailed`/`timeout`) retries the *same* code
  by restarting `ConnectingScene` with the same data; the other three
  (`roomNotFound`/`roomFull`/`alreadyInProgress`) imply the code or room
  state itself needs to change, so their retry - and the busy screen's
  cancel, and the error screen's secondary button - all return to
  `LandingScene`. This one small simplification is flagged in "Open
  questions" below.
- **Real room-code validation used end to end**: the DOM join input now
  filters/validates through `net/lobbyCode.ts`'s real
  `normalizeLobbyCode`/`isValidLobbyCode`/`LOBBY_CODE_LENGTH` instead of a
  local placeholder regex and hardcoded `5`s; the copy-invite-link button
  now builds the real `${location.origin}${location.pathname}?lobby=<code>`
  URL (matching `HostLobbyScene.inviteUrl()`) instead of a fake
  `https://suits.mp/...` placeholder. `lobbyContent.ts`'s placeholder
  `CODE_ALPHABET`/`randomCode()` were removed as no longer used anywhere.
- **Bots never touch the network - unchanged, reverified**: `botAI.ts` and
  `HostGameScene.driveBotsIfNeeded` were not modified (explicitly out of
  scope). `driveBotsIfNeeded` only ever calls `applyAction` + `broadcastAll`
  for a bot-marked seat - it never reads `this.actions`/`room`. This was
  already true for Single Player before this task; this task just extends
  the same `isBot` roster flag to mixed lobbies via the lobby's own
  fill/release buttons, so the same guarantee now covers a lobby with 1-3
  real peers and the rest bots, not just an all-bot roster.

## Key technical decisions

- **DOM becomes the single real-data-driven renderer for the whole lobby/
  join flow**; the real scenes (`HostLobbyScene`, `ConnectingScene`) keep
  owning room/roster/reconnect lifecycle logic exactly as before, just
  push state out instead of rendering it themselves - this was the
  fork identified at the start of this task (DOM UI vs. plain-Phaser-Text
  UI, previously two disconnected implementations of the same flow) and
  matches root CLAUDE.md's UI-split rule (lobby/join screens are named
  explicitly as DOM chrome) plus every prior DOM-wiring precedent in this
  engagement (Rules, Overlay).
- **`JoinEntryScene` is now genuinely dead code**, not "deferred" as the
  previous session's comment said - the DOM's own 'join' screen (code
  input + pips + validation) fully replaces its job, and nothing calls
  `scene.start('JoinEntry', ...)` anywhere any more. Left registered in
  `main.ts` rather than deleted, since removing a whole scene felt like a
  call worth confirming rather than a silent cleanup - see "Open
  questions".
- **`PlayerLobbyScene` (the joining peer's own "waiting for host" screen)
  was left exactly as-is**, still plain Phaser Text. This task's own
  requirement 2 names "the UI seat list" specifically, which only the
  *host's* lobby screen has - the mockup itself has no design for a
  peer-side waiting screen at all (see "Open questions"), so converting it
  would mean inventing UI the brief never specified. The DOM does own the
  entire *attempt* to join (code entry, busy, error) - only the
  already-connected "waiting for start" screen stays on the older,
  unconverted Phaser Text UI, matching CLAUDE.md's "a prototype adopts
  this pattern the next time it does UI work" allowance for pre-existing
  UI.
- **Every real peer seat shows the same generic placeholder name** ("Erich
  Z.", from the design handoff) rather than anything peer-specific -
  suits-mp has no player-name/nickname system at all (only `NetPlayerId`
  slots), so there is no real identity to show; only occupancy *type*
  (host/peer/bot/empty) is real data.

## Open questions

- **The design mockup has no "peer is waiting in the lobby" screen.**
  `LobbyFlow.tsx`'s `Screen` union has `'lobby'` (host-only: room code,
  refresh, copy buttons, fill/release, Start Game) but nothing for "you've
  joined, waiting for the host to start" - that gap already existed before
  this task (the mockup itself never designed it) and is carried forward
  by leaving `PlayerLobbyScene` unconverted rather than inventing a screen
  the brief never specified. Flagging per this task's own instruction:
  `BRIEF.md` may want to say explicitly whether a peer-side DOM waiting
  screen is in scope for a future task, or whether Phaser Text there is
  intentionally permanent.
- **The host's own `'lobby'` screen has no leave/cancel affordance** (no
  button in the design calls back to Landing once hosting has started) -
  pre-existing gap in the mockup, not introduced by this wiring; a host
  who wants to abandon a lobby currently has no in-flow way to do so
  (only a hard reload).
- **Error-screen retry simplified for 3 of 5 outcomes** (`roomNotFound`/
  `roomFull`/`alreadyInProgress` now go back to Landing on retry, rather
  than the design's implied "straight back to the join code-entry screen
  with the same code slot ready to edit") - flagging per this task's
  "flag gaps rather than silently patch" instruction, since the two
  buttons' copy ("Speak the sigil anew" vs. "Return to the threshold")
  now both ultimately land on the same screen, just via a real vs. a
  purely-local navigation path respectively.
- **`JoinEntryScene` is fully unreachable now** (see above) - left in
  place rather than deleted; a follow-up could remove it (and its
  `main.ts` registration) if the user confirms it's not wanted as a
  fallback/testing entry point.

## Known issues

- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); no card-back art yet; Redistribution-log
  content still stubbed (no design handoff yet); Google Fonts fail to load
  in this dev sandbox's network environment (cosmetic fallback only).
- **This sandbox's network proxy blocks the Nostr relay WebSocket
  connections outright** (`Establishing a tunnel via proxy server failed`
  for all 5 pinned relays) - confirmed directly via Playwright console
  logs while testing. This means genuine two-device WebRTC/Trystero
  peer-to-peer connectivity could not be exercised at all in this
  environment; **see the session's final report for exactly what was and
  wasn't verified** - real peer-to-peer connection (a live 2nd device
  actually seating as 'peer' in the lobby, and mid-game reconnect for a
  real peer) still needs the user's own live multi-device test.
- Real refresh-in-progress has no loading/disabled visual state on the DOM
  refresh button (the underlying scene-side `refreshing` boolean guard
  still prevents a real double-fire bug, just with no visual feedback
  while a refresh is in flight) - minor, not fixed, out of scope as
  polish the brief didn't ask for.

## Next proposed step

Decide on the two "Open questions" above (peer-side waiting screen scope,
JoinEntryScene removal), then a real human-peer live pass across two
actual devices/networks (outside this sandbox) to verify what could not be
tested here: real Trystero/Nostr connectivity, a real peer's seat
reflecting live in the host's seat list, and identity-matched reconnect
for a real peer. Redistribution-log content and card-back art remain
carried over from before this task.
