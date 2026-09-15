## Current milestone

Return to Menu: a warned confirmation dialog plus a uniform hard game-end
for real multiplayer sessions. Any connected player (host or peer) can
now voluntarily end a real multiplayer game for everyone via a new Menu
option; Single Player and Tutorial get a lighter local-only quit with no
networking at all. No mid-game equivalent of the lobby's Host
Disconnected cascade existed before this task - this is genuinely new
infrastructure, not a reuse of an existing "session ended" mechanism.

## What was implemented

**Part 1 - Menu option (`dom/MenuModal.tsx`):** a new "Return to Menu"
row alongside the existing Rules/Previous Trick options, wired through a
new `onReturnToMenu` prop. Tapping it opens the confirmation dialog
(Part 2) - it never acts immediately.

**Part 2 - Warning confirmation (`dom/EndGameConfirmModal.tsx`, new):**
deliberately styled to read as a warning - a red/orange accent
(`oklch(0.80 0.14 25)`, the same hue family already used for the lobby's
own `connFailed` error screen), a `⚠` glyph, and a two-button
Cancel/Confirm layout - distinct from the game's normal gold/teal
Rules/Menu/RedistLog chrome. Copy branches on a new `isMultiplayer`
flag threaded all the way from whichever scene is rendering (see
below): real multiplayer gets "This ends the game for every player, not
just you. This cannot be undone." with a "End Game for Everyone" confirm
label; Single Player/Tutorial get "Are you sure you want to quit?" with
a plain "Quit" label, since the "ends it for everyone" wording would
simply be untrue there.

**Part 3 - Real multiplayer hard end:**
- `net/actions.ts`: a new `{ action: 'endGame' }` `ClientAction` variant
  - flows through the exact same wire mechanism every other action
  already uses (`sendAction`/`room.makeAction<ClientAction>`), no new
  plumbing needed.
- `rules/types.ts`: `WinInfo.reason` extended to `'suit' | 'stalemate' |
  'quit'`, plus a new `quitterId?: PlayerId` field (only set for
  `'quit'`). `net/actions.ts`'s `NetWinInfo` mirrors this with
  `quitterId?: NetPlayerId` (translated at the host/mask.ts boundary via
  `toNetPlayerId`, the same PlayerId->NetPlayerId crossing every other
  identity field in `MaskedState` already goes through).
- `rules/engine.ts`: a new `endGame(state, quitterId)` function, placed
  right after `checkSuitCompletion` - the only other `WinInfo`-producing
  function. Sets `phase: 'gameOver'` and `winner: { team: null, reason:
  'quit', detail, quitterId }`, reusing the exact same transition every
  other win already relies on rather than a separate "session ended"
  state machine. Callable from any phase - a deliberate quit isn't
  gated behind whose turn it is.
- `host/gameHost.ts`: a new `case 'endGame'` in `applyAction`'s switch,
  with no turn/phase precondition (any of the 4 players may end the
  game at any time) except rejecting an already-`'gameOver'` state (so
  a stray double-confirm race doesn't throw or overwrite an
  already-settled winner).
- `host/mask.ts`: `buildMaskedState`'s `winner` field now also carries
  the translated `quitterId`.
- This works identically whether the quitter is the host or a peer with
  **no special-casing anywhere**: `HostGameScene.applyAndBroadcast` is
  already the single path both a real peer's network message and the
  host's own local UI action go through (see `sendMaskedStateTo`'s
  `entry.isHost` branch calling `applyAndBroadcast` in-process vs. a
  peer's message arriving over the wire) - `endGame` needed nothing
  extra to "know" who called it and broadcast to everyone correctly.
  There is also no explicit `room.leave()`/teardown call for the host
  to add: `HostGameScene`/`PlayerGameScene` never explicitly leave the
  Trystero room on a normal win either (confirmed by reading both
  files) - the graceful part is entirely that the real state broadcast
  (`broadcastAll()`) completes synchronously as part of processing the
  action, strictly *before* anyone (including the quitter) ever
  navigates away - navigation only happens later, when a client taps
  the Game Ended screen's own Back to Menu button, by which point the
  broadcast has already reached every peer regardless of what the
  quitter's own client does next.

**Part 4 - Game Ended screen (`dom/GameEndedModal.tsx`, new):** a
deliberately much simpler screen than the Victory Screen - "Game
Ended" / "The game has been ended by `<name>`." / a single Back to Menu
button, reusing the exact same gold clipped-button chrome as
VictoryModal/TutorialCompleteModal. Wired into `ui/renderGameView.ts`'s
existing `if (state.winner)` dispatch as a new `reason === 'quit'`
branch, checked *before* the `'suit'` branch reaches
`startVictorySequence` - never triggers Local Victory or the Victory
Screen. The quitter's display name is resolved via `playerLabelFor`,
the exact same real identity resolution the Victory Screen and
Redistribution Log already use (including its existing "(You)" suffix
when the viewer is the quitter themself) - no new name-lookup mechanism
was built. Called on every render pass while this state persists (same
idempotent-redraw precedent as the pre-existing stalemate stub), not
gated behind a one-shot flag - there's no animated sequence here that
would need one.

**Part 5 - Local exit (Single Player/Tutorial):** the confirm handler
checks the new `isMultiplayer` flag; when false, it calls the same
private `navigateToLandingMenu(scene)` this file already uses for every
other "Back to Menu"/Quit action, with **no** `sendAction` call at all
- confirmed via Playwright that no network-shaped request (TURN/relay/
ICE) fires when a Single Player or Tutorial session is quit this way.

## Threading `isMultiplayer` through the render pipeline

`presentGameView`/`renderGameView`/`renderWithView` all gained a new
required `isMultiplayer: boolean` parameter (placed before the existing
optional `tutorial` param, so every call site must pass it explicitly -
this is real, correctness-affecting behavior, not a tutorial-style
"zero effect if omitted" parameter). Every call site was updated to
pass the right value:
- `HostGameScene.ts`: `this.actions !== null` - true for a real Host
  session (even if no peer has joined yet, since Single Player is the
  only path that ever passes `actions: null`), false for Single Player.
- `PlayerGameScene.ts`: always `true` - a peer only exists in real
  multiplayer.
- `TutorialScene.ts`: always `false`.

The new `'endGameConfirm'` `OverlayKind` slots into the existing
Rules/RedistLog/Menu overlay-branch chain in `renderWithView`, in the
same "check this kind, `return`, otherwise fall through to `closeX()`"
shape every other overlay kind already uses. The one deliberate
divergence from that shared pattern: the CONFIRM callback (not Cancel)
never calls its own `rerender()` after sending the real `endGame`
action - see that branch's own doc comment in `ui/renderGameView.ts`
for why: for the host, `sendAction` is entirely synchronous
(`applyAndBroadcast` -> `broadcastAll` -> a nested `presentGameView`
call using the same `ui` object, which by then already reflects the
real new state) - an extra `rerender()` afterward would re-run with
*this* closure's own stale `state` (still no winner) and stomp the
nested render's correct result. `ui.overlay` is still reset to `'none'`
*before* sending, so whichever render actually happens next (the host's
nested synchronous one, or a peer's eventual async one once the host's
broadcast arrives) correctly falls through past the overlay checks into
the real `state.winner` dispatch.

## Verification

`npm run typecheck` and `npm run build` both pass cleanly.

Real-gameplay Playwright verification, to the extent this sandboxed
environment allows (see the explicit limitation below):

- **Single Player quit**: start a game, open Menu, Return to Menu shows
  the local-only wording ("Quit to Menu?"/"Are you sure..."), Cancel
  correctly leaves the game untouched (board still fully interactive),
  confirming navigates straight to Landing with **no** Game Ended
  screen and **no** TURN/relay/ICE network request observed (only an
  ordinary image-asset fetch was seen during the whole flow).
- **Tutorial quit via the new Menu option** (distinct from Tutorial's
  own pre-existing, unconfirmed top-bar Quit button, which this task
  never touched): same local-only wording, same direct exit to Landing,
  no networking.
- **A real "Host" multiplayer session, host quitting**: hosted a real
  room (not Single Player - `data.actions` genuinely non-null),
  filled all 3 remaining seats with bots, started the game. Return to
  Menu correctly shows the multiplayer warning wording ("This ends the
  game for every player..."/"End Game for Everyone"). Cancel leaves the
  game running. Confirming runs the real `endGame` action through the
  real `applyAction`/`gameHost.ts` pipeline, and the resulting Game
  Ended screen correctly reads "The game has been ended by HostQuitter
  (You)." - the real quitter name, through the real `playerLabelFor`
  resolution, including its existing "(You)" suffix. Back to Menu
  correctly returns to Landing, and starting a fresh session afterward
  shows no stray confirm/Game-Ended modal state left over.
- Console clean on boot throughout (aside from the pre-existing,
  unrelated ICE-server-fetch/cert noise already present on plain boot
  in this sandboxed test environment).

**Explicit limitation - could not test literal cross-browser peer
transport.** A direct connectivity probe (two separate Playwright
browser contexts, one hosting, one joining with the real room code)
confirmed the sandbox's outbound proxy rejects the WebSocket tunnel to
every one of the pinned public Nostr signaling relays
(`relay.damus.io`, `nos.lol`, etc.) with "Establishing a tunnel via
proxy server failed" / "connect_rejected (organization policy)" - so
two real peers genuinely cannot discover each other in this
environment, regardless of the code under test. This means the "a peer
quits" and "a peer receives the host's broadcast" halves of the
verification requirement could not be exercised with an actual second
network client. What was verified instead, to close that gap as much
as possible without real transport:
- The **host-side** pipeline was verified completely end-to-end (engine
  -> `gameHost.applyAction` -> `HostGameScene.applyAndBroadcast` ->
  `host/mask.ts`'s `quitterId` translation -> `presentGameView` ->
  `renderGameView.ts`'s new branches -> `GameEndedModal`) via a real
  "Host" session, since a host's own screen renders through this exact
  same pipeline regardless of whether any peer is actually connected.
- The **peer-side** rendering code is not a separate implementation at
  all: `PlayerGameScene.ts`'s `actions.state.onMessage` handler calls
  the *exact same* `presentGameView` function the host's own local
  render already uses, with the *exact same* masked-state shape
  (confirmed correct above, `quitterId` included) as its only input -
  there is no peer-specific branch anywhere in this feature. A peer
  receiving that payload over a working connection would exercise
  identical, already-verified code; the only untested link is the raw
  network delivery itself, which is an environmental constraint of this
  sandbox, not a property of the code.
- `sendAction` for a peer (`(action) => void actions.gameAction.send(action)`,
  `PlayerGameScene.ts`) already forwards *any* `ClientAction` generically
  - confirmed by reading the code, this needed no change at all to
  carry the new `{ action: 'endGame' }` variant, the same way it never
  needed special-casing for `playCard`/`selectDelegate`/`redistribute`.

If real network access to these relays is available in a different
environment (or once mp-net/mp-console's own TURN worker is reachable),
re-running the two-context connectivity probe in
`scripts/`-adjacent scratch space (not committed - see this session's
own scratchpad) would close this gap for real; nothing about the
implementation itself is contingent on that follow-up.

## Key technical decisions

- `WinInfo`/`NetWinInfo` gained a `quitterId` field rather than baking a
  display name into `detail` at the engine layer - the engine only ever
  knows the generic seat name (`PlayerState.name`, always "Player N"),
  never a real chosen display name (a pre-existing characteristic of
  this codebase, confirmed by reading `checkSuitCompletion`'s own
  `detail` strings, which have the same limitation). Storing the raw id
  and resolving it client-side via the existing `playerLabelFor` is the
  same pattern the Victory Screen and Redistribution Log already use
  for every other identity shown in this game - not a new mechanism.
- The Game Ended screen is called unconditionally on every render pass
  once `state.winner.reason === 'quit'`, not gated behind a
  `PersistentUIState` one-shot flag the way `victorySequenceStarted`
  gates the animated Victory sequence - there's no animation here to
  avoid re-triggering, so the simpler "redraw every time, same as the
  pre-existing stalemate stub" approach was enough.
- The confirm handler's asymmetric `rerender()` behavior (called on
  Cancel, deliberately not called on Confirm) is the one place this
  task's own render-pipeline change doesn't mirror the Rules/RedistLog/
  Menu close-button pattern exactly - see its own doc comment in
  `ui/renderGameView.ts` and this file's "Threading isMultiplayer"
  section above for the full reasoning (avoiding a stale-state render
  stomping the host's own synchronous nested re-render).

## What's general vs. specific to this feature

**General, reusable as-is:**
- The `isMultiplayer` parameter now threaded through the whole render
  pipeline is available to any future feature that needs to distinguish
  a real multiplayer session from Single Player/Tutorial at render
  time - this was the first feature to need that distinction.
- `WinInfo.reason`'s three-way union and the `quitterId` field pattern
  (store a raw id at the engine layer, resolve a display name
  client-side) is the template for any future non-`'suit'`/`'stalemate'`
  ending this game might eventually need.

**Specific to this feature:**
- `EndGameConfirmModal`/`GameEndedModal` and their `domUiStore.ts`
  entries are purpose-built for this one flow.
- The asymmetric confirm-handler `rerender()` reasoning is specific to
  this action's own synchronous-for-the-host call shape; a future
  action that never ends the game this way likely doesn't need it.

## Open questions

None arose that needed asking - the task's own spec was explicit about
every branch (multiplayer vs. local wording, host-vs-peer uniformity,
what the Game Ended screen should and shouldn't trigger). The one
finding worth flagging for whoever picks up networking work next:
**this sandboxed environment cannot reach the public Nostr signaling
relays at all** (outbound WebSocket tunnels are rejected by the proxy
per organization policy) - any future task requiring genuine
cross-browser multiplayer Playwright verification will hit this same
wall and should plan around it (e.g., testing from an environment with
real network access, or building a mock-transport test harness) rather
than assuming it'll work.

## Known issues

None in the shipped code, to the extent verified. The one known gap is
the environmental one described above (cross-browser peer transport
untestable in this sandbox) - not a defect in the implementation, which
was reasoned through and verified as thoroughly as the environment
allows.

## Next proposed step

If genuine multi-browser network access becomes available, re-run the
peer-quit and host-quit-reaches-a-real-peer scenarios with two actual
connected clients to close the one verification gap this task
couldn't. Otherwise, the next natural mid-game infrastructure gap is
the mid-game "Host disconnected" experience `scenes/PlayerGameScene.ts`
still shows for an *unplanned* disconnect (a raw black Phaser overlay
with no button, a dead end) - much more primitive than this task's own
deliberate-quit flow, and worth bringing up to the same standard in a
future task (the lobby-phase equivalent already has a real "Return to
Main Menu" button; the mid-game one still doesn't).
