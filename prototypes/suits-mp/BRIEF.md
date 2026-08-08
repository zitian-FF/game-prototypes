# suits-mp (Stage 1+2)

A true-multiplayer rebuild of the hotseat prototype `prototypes/suits`
("Suit of Madness"), on the same networking foundation as
`prototypes/mp-net` (Trystero, Nostr strategy, identity handshake,
host/join landing screen, TURN fallback). `prototypes/suits` is untouched
and stays live at its own URL; this is a separate project with its own
itch.io page.

This file documents Stage 1 (networking skeleton) + Stage 2 (rules
engine + masking), combined per an explicit user decision to not further
split this task. Stage 3 (real visual UI, turn indicator animation) is a
separate future task.

## Stack

Phaser 3 + TypeScript + Vite, same as the other prototypes, plus
`trystero` (`trystero/nostr`) and `tweakpane` (`?debug=1`).

## Orientation

All screens, all devices, portrait only - including the host. Unlike
mp-base/mp-net's landscape-host dashboard, there is no orientation this
prototype ever lays out for besides portrait; `orientation/orientation.ts`
just guards against a player rotating their phone sideways mid-session.

## Lobby and join flow

Ported directly from mp-net (landing screen, 5-character room code
excluding 0/O/1/I/L, copy-code/copy-invite-link, `?lobby=XXXXX` auto-join,
TURN-servers-before-join fetched from mp-net's already-deployed Cloudflare
Worker, debounced pre-game disconnect, identity-matched mid-game
reconnect), with one addition:

**Room capacity is hard-locked to exactly 4** (host + 3 peers).
`HostLobbyScene` assigns each joiner the lowest free seat (`p1`..`p3`;
host is always `p0`) and rejects a 5th joiner with a `roomFull` hostUI
message instead of `lobbyJoined`. Start Game stays disabled until all 4
seats are filled, and re-disables if the room drops below 4 pre-game.

`ConnectingScene` distinguishes five join outcomes: room not found,
connection failed even after TURN fallback, generic timeout, game already
in progress (a stranger hitting a started game), and room full (hit only
pre-game).

## Networking: masking architecture

This is the one deliberate divergence from mp-base/mp-net's shared
`hostUI` broadcast pattern. The host holds one canonical `GameState` (all
4 hands, hidden identities, deck/trick/redistribution state) and never
broadcasts it as-is. `host/mask.ts` computes a distinct `MaskedState` per
seat, and every send of the `state` action in `HostGameScene` passes an
explicit `{ target: peerId }` - there is no unmasked broadcast path to
disable by mistake. A masked payload contains only: that seat's own hand,
any identities revealed at game-over, the public trick-in-progress, whose
turn it is and what phase, and that seat's own redistribution-receipt
history. It never contains another seat's hand or an unrevealed identity.

As with mp-base/mp-net, this does not protect against the host's own
browser (which holds the full canonical state to run game logic) - same
trust model as a physical card game's dealer.

## Networking: action types

Four action types, all sent on player confirm, over one `gameAction`
channel (`net/actions.ts`):

- `playCard` - `{ playType: "single"|"double"|"facedownSingle", cards }`.
  `playType` is informational; the host's ported `playCard()` derives the
  actual legality/kind from the cards and current required suit itself.
- `selectDelegate` - `{ targetPlayer }`, valid only immediately after a
  double win.
- `redistribute` - `{ assignments: [{ toPlayer, cards }] }`, explicit
  manual assignment. Host-side validation (via the ported
  `redistribute()`) rejects the action unless every contributing player's
  returned card count exactly matches their contribution to that trick.
- `declareRoleGuess` - `{ guesses: { p0: God, p1: God, p2: God, p3: God } }`.

**On `declareRoleGuess`:** the original task brief specified "exactly
three" action types (playCard/selectDelegate/redistribute), but also
locked in porting the trick-40+ Role Revelation win condition and a
role-guess UI prompt as in-scope for this stage - there is no way to
submit a guess to the host without a network action for it. Resolved by
explicit user decision: add this as a fourth action type rather than
stub the feature. It carries the full guess in one shot (declare +
submit as a single confirm) rather than round-tripping a separate
"declare intent" message first.

There is no action-rejection/nack message type. An illegal action (per
the ported engine's own checks) is simply dropped host-side with a
console warning; the sender's screen just doesn't change. After every
applied action, the host recomputes and re-sends a fresh masked payload
to all four seats - there is no separate "it's your turn" message. Each
client reads `turnPhase` (`"play" | "selectDelegate" | "redistribute" |
"roleGuess" | "gameOver"`) to decide which action UI to show, and
`currentTurn` to decide whose turn it is.

Reconnect reuses mp-net's identity-matched handshake; a successful
re-match additionally triggers an immediate re-send of that peer's
current masked payload (`HostGameScene`'s `identity.onMessage`), rather
than waiting for the next game-state change.

### Redistribution and delegate masking (implementation note)

The ported engine (`redistribute()`) lets a self-redistributing winner
hand back *any* card from their own hand, not just cards from the trick
just won - by card-count validation only, not card-identity. That's fine
when the winner redistributes themself (it's their own hand). It's a
problem for a delegate: a delegate has no legitimate way to see the
winner's whole hand over a real network (masking forbids it), so
`host/mask.ts` restricts the `candidateCards` offered to a distributor
(winner or delegate alike) to that trick's own cards - already public,
since they were played face-up. This is a tighter restriction than the
locked engine itself enforces, chosen specifically so a delegate never
needs the winner's unrelated hand contents to make their decision. See
`net/actions.ts`'s `RedistributionContext` doc comment.

## Rules engine

`src/rules/{types,cards,engine}.ts` are a direct, unmodified copy of
`prototypes/suits/src/rules/{types,cards,engine}.ts` - the rules are
locked and ported exactly, not reinterpreted. `src/host/gameHost.ts`
drives them host-side:

- `createInitialState()` deals via the engine's own `initGame()` (genuine
  shuffle, Blue-2-holder leads trick 1, exactly as before).
- `settleAutoPhases()` auto-advances the engine's `'blocker'` and
  `'trickResult'` phases, which model the hotseat "pass the device, tap
  when ready" and public-result beats. Those have no suits-mp equivalent
  (every seat already has its own device, and masking already keeps
  everything else hidden appropriately), so they're resolved
  automatically and never appear over the network - `turnPhase` in a
  masked payload is always one of `play`/`selectDelegate`/`redistribute`/
  `roleGuess`/`gameOver`.
- `applyAction()` routes each of the four wire actions to the matching
  engine call, with an authorization check (right phase, right seat) on
  top of whatever the engine itself already enforces.

## UI (placeholder / text-dump, Stage 2 scope)

`src/ui/renderGameView.ts` is the entire UI this stage: monospace text
and tappable rows, shared between `HostGameScene` (the host's own
perspective, rendered locally with no network round trip for its own
actions) and `PlayerGameScene` (a remote peer's perspective, rendered
from a received `state` message). Shows: your hand, whose turn, the
current trick in play order, the current turn phase, a role-guess prompt
when eligible, and enough tap targets to actually play a full game
(select cards, confirm a play, pick a delegate, assign redistribution
cards, submit a role guess). The redistribution log and rules overlay are
stubbed with placeholder text, per Stage 2 scope - real presentation is
Stage 3. No turn-indicator animation, no real visual hand/trick/HUD
layout - also Stage 3.

## Out of scope (this task)

Any real visual UI, turn indicator animation, spectator mode,
fewer/more-than-4-player support, and anything already merged as a
housekeeping item (CLAUDE.md deploy-path doc, relay-pinning doc, mp-base
relay fix). No changes to the existing hotseat `suits` prototype.

## Verification status

Automated (this task): `npm run typecheck` and `npm run build` both pass.
A Playwright boot check confirms the landing screen renders with the
version stamp visible and no uncaught JS exceptions, and that clicking
Host successfully creates a Trystero room and renders the lobby (room
code, seat list, disabled Start Game at 1/4) with no uncaught exceptions.
Console does show `Failed to load resource` network errors from the TURN
worker fetch in this sandboxed environment - identical to mp-net's own
landing page under the same network conditions, and swallowed internally
by `fetchTurnIceServers()`'s own try/catch (never blocks the flow); not a
suits-mp-specific regression.

**Not automated-verified, needs the user's own multi-device test after
deploy:** masking correctness across 4 real peers, turn rotation, suit
legality end-to-end over the network, redistribution count validation,
delegate flow, role-guess win/stalemate, and reconnect mid-game. A single
Playwright browser cannot exercise 4 concurrent connected clients.
