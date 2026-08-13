# suits-mp (Stage 1+2)

A true-multiplayer rebuild of the hotseat prototype `prototypes/suits`
("Suit of Madness"), on the same networking foundation as
`prototypes/mp-net` (Trystero, Nostr strategy, identity handshake,
host/join landing screen, TURN fallback). `prototypes/suits` is untouched
and stays live at its own URL; this is a separate project with its own
itch.io page.

This file documents Stage 1 (networking skeleton) + Stage 2 (rules
engine + masking), combined per an explicit user decision to not further
split this task; a first follow-up task (AI bots, room code refresh, a
trick-40 rule change, a UI interactivity bug fix, and dropping
role-guess); and a second follow-up task (a trick-1 forced-opener bug
fix, moving bot-testing to its own Single Player main-menu entry, and
legal/illegal hand-card styling with a full off-suit selection UX).
Stage 3 (real visual UI, turn indicator animation) is a separate future
task.

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

Three action types, all sent on player confirm, over one `gameAction`
channel (`net/actions.ts`):

- `playCard` - `{ playType: "single"|"double"|"facedownSingle", cards }`.
  `playType` is informational; the host's ported `playCard()` derives the
  actual legality/kind from the cards and current required suit itself.
- `selectDelegate` - `{ targetPlayer }`, valid only immediately after a
  double win. Mandatory: `selectDelegate` always fires on a double win (no
  path lets the winner redistribute themself), and the ported
  `chooseDelegate()` rejects `targetPlayer` equal to the winner - see
  "Rules engine" below.
- `redistribute` - `{ assignments: [{ toPlayer, cards }] }`, explicit
  manual assignment. Host-side validation (via the ported
  `redistribute()`) rejects the action unless every contributing player's
  returned card count exactly matches their contribution to that trick.

(A fourth action, `declareRoleGuess`, existed briefly during Stage 1+2 to
carry the original design doc's trick-40+ role-guess win condition. A
follow-up task dropped role-guess entirely in favor of an automatic
trick-40 forced end with no player action involved - see "Trick-40 forced
end" below - so that action type no longer exists.)

There is no action-rejection/nack message type. An illegal action (per
the ported engine's own checks) is simply dropped host-side with a
console warning; the sender's screen just doesn't change. After every
applied action, the host recomputes and re-sends a fresh masked payload
to all four seats - there is no separate "it's your turn" message. Each
client reads `turnPhase` (`"play" | "selectDelegate" | "redistribute" |
"gameOver"`) to decide which action UI to show, and `currentTurn` to
decide whose turn it is.

Reconnect reuses mp-net's identity-matched handshake; a successful
re-match additionally triggers an immediate re-send of that peer's
current masked payload (`HostGameScene`'s `identity.onMessage`), rather
than waiting for the next game-state change.

### Redistribution and delegate masking (implementation note)

Per the GDD, the trick winner adds all trick cards to their hand *first*,
then redistributes one facedown card per contributing player from that
whole hand - not just the cards from the trick just won. The ported
engine (`redistribute()`) already matches this: it lets a
self-redistributing winner hand back any card from their own hand, by
card-count validation only, not card-identity. `host/mask.ts`'s
`candidateCards` mirrors that: it's the redistributor's (winner's or
delegate's) full current hand at redistribution time, already inclusive
of the just-won trick cards (`playCard()` merges them into the winner's
hand immediately on trick resolution, before the redistribute phase is
ever reached).

This does mean a delegate (on a double-win) sees the winner's full hand
contents in this one screen, not just the trick's own cards - an
intentional trade-off to match the GDD's actual redistribution pool
rather than a narrower, invented restriction. See `net/actions.ts`'s
`RedistributionContext` doc comment.

## Rules engine

`src/rules/{types,cards,engine}.ts` started as a direct, unmodified copy
of `prototypes/suits/src/rules/{types,cards,engine}.ts` at Stage 1+2 - the
hotseat `suits` prototype's own copy is untouched and this file no longer
claims suits-mp's copy is identical to it, since a follow-up task
explicitly authorized diverging suits-mp's own rules engine (role-guess
removal, the trick-40 forced end below). Everything else about the
ported logic (deal, suit rotation, follow-suit/double legality, trick
resolution, redistribution count-matching) is still exactly as ported,
not reinterpreted. `src/host/gameHost.ts` drives it host-side:

- `createInitialState()` deals via the engine's own `initGame()` (genuine
  shuffle, Blue-2-holder leads trick 1, exactly as before).
- `settleAutoPhases()` auto-advances the engine's `'blocker'` and
  `'trickResult'` phases, which model the hotseat "pass the device, tap
  when ready" and public-result beats. Those have no suits-mp equivalent
  (every seat already has its own device, and masking already keeps
  everything else hidden appropriately), so they're resolved
  automatically and never appear over the network - `turnPhase` in a
  masked payload is always one of `play`/`selectDelegate`/`redistribute`/
  `gameOver`.
- `applyAction()` routes each of the three wire actions to the matching
  engine call, with an authorization check (right phase, right seat) on
  top of whatever the engine itself already enforces. Used identically
  for real peer actions and host-local bot actions (see "AI bot mode"
  below) - there is no separate/parallel bot rules path.

### Mandatory delegation on double-win

The ported engine already modeled this as mandatory from the start:
`proceedFromTrickResult()` routes every double-win (`wonByDouble`)
through the `chooseDelegate` phase unconditionally - there is no branch
where a double-winner redistributes themself - and `chooseDelegate()`
itself throws if `delegateId === pendingWinnerId`. A follow-up task's
brief asked to make this mandatory and non-self-selectable "for every
player, not optional, and not AI-specific"; auditing the existing code
confirmed both properties already held with zero code changes needed.
Verified with a 300-game bot-vs-bot simulation plus an adversarial probe
that explicitly attempts self-delegation on every double-win and confirms
it's rejected every time (see "Verification status").

### Trick-1 forced opener (bug fix)

Only the *player* leading trick 1 was ever constrained to whoever holds
the 2 of Yog-Sothoth - the *card* they opened with was not, which let a
bot (or, in principle, a human) open trick 1 with a different card
entirely (observed: a bot opening with Astral Pulse instead of Flicker
of the Void). Fixed by `rules/engine.ts`'s `isForcedTrick1Opener(trickNumber,
position)` / `forcedTrick1Opener(state)`: trick 1's leading play must be
exactly the 2 of Yog-Sothoth, checked inside `playCard()`'s own
validation. This is the single source of truth for the restriction -
`playCard()`'s authoritative check, `host/botAI.ts`'s move choice, and
`ui/handLegality.ts`'s client-side legal/illegal highlighting (see "UI"
below) all call it, so there's no separate human/bot/UI copy that could
drift. Every trick after the first is unaffected: its leader (whoever
performed the prior redistribution) may open with any single card, same
as before.

### Trick-40 forced end (replaces role-guess)

A follow-up task removed the original design doc's trick-40+ role-guess
win condition entirely from suits-mp (the `declareRoleGuess` action, the
`roleGuess` phase/turnPhase, `PlayerState.guessUsed`, all gone) and
replaced it with an automatic forced end, computed host-side with no
player action involved: `redistribute()` now checks, right after
finishing trick 40's own redistribution (whether self-performed or
delegated) and finding no suit completed, which team's **best** player
(by count of their own suit's cards currently held) is ahead; ties break
on each team's **other** player; a full tie is a stalemate. See
`rules/engine.ts`'s `resolveTrick40ForcedEnd`. `WinInfo.reason` gained a
`'trick40'` value for this (distinct from `'suit'`); `'stalemate'` now
means only this specific tie, not the old role-guess-exhaustion stalemate.

## AI bot mode

A permanent test mode (not `?debug=1`-gated), entered via the landing
screen's own **Single Player (play with bots)** button - see "Single
Player mode" below for how that entry point works. (An earlier version
of this feature was a "Fill with bots" button inside the regular Host
lobby, letting a partially-full room top up with bots; a follow-up task
moved bot-testing to its own dedicated entry point and removed that
button entirely - a Host-lobby game is now always either full of real
joined players or waiting for them, never a human/bot mix.)

Bots run entirely host-local, never over the network: `HostGameScene
.driveBotsIfNeeded()` checks after every state change whether the active
seat is a bot, and if so asks `host/botAI.ts`'s `chooseBotAction()` for a
move and feeds it through the exact same `gameHost.applyAction()` every
real peer action goes through - there is no separate bot rules path, so
bot play is a genuine exercise of the same validation a human's actions
get. This repeats (broadcasting after each step, so a human host watching
can see bot turns happen) until a human seat's turn comes up or the game
ends.

Bot behavior is Level 1 - legal-random only (no suit/team-awareness, no
strategy, explicitly deferred to a future task):

- **Playing a card**: uniformly at random over the full set of
  currently-legal moves - each required-suit card is one option when
  following suit is possible; otherwise each individual off-suit card is
  one option and each rank with a matching pair in hand is one additional
  double option. On trick 1's opening play specifically, the "legal move
  set" is a single forced option (see "Trick-1 forced opener" above) - the
  bot asks the same `forcedTrick1Opener()` the host validates against,
  rather than picking randomly and risking rejection.
- **Choosing a delegate** (after winning via double): uniformly at random
  among the other 3 seats (self-selection is already impossible - see
  "Mandatory delegation" above).
- **Redistributing** (whether self-performed or as a delegate): the
  required count per contributing recipient is filled with a random
  sample from the *winner's entire hand* - not restricted to just the
  trick's cards the way a human distributor's UI is (see "Redistribution
  and delegate masking" above). That restriction exists purely to avoid a
  human delegate needing visibility into another player's hand over the
  network; a host-local bot already has full canonical-state access, so
  it's free to use the engine's actual, more permissive pool exactly as
  the brief for this behavior specified.
- Bots that win via suit completion or via the trick-40 forced end just
  end the game like anyone else - no special-casing.

**Bot pacing (follow-up task):** each bot step is delayed by
`tune.json`'s `botActionDelayMs` (default 1000ms, tunable via `?debug=1`
per the root "Tuning" rule) before it's applied and broadcast, so a human
player can visually follow what a bot just did rather than seeing an
entire multi-bot sequence resolve instantly. `HostGameScene
.driveBotsIfNeeded()` implements this with `this.time.delayedCall(...)`
scheduling the next step recursively rather than a synchronous loop - the
old `MAX_BOT_STEPS` safety cap is threaded through as an explicit `step`
parameter instead of a loop counter, since the recursion now happens
across Phaser timer callbacks, not the JS call stack. Presentation-timing
only: `chooseBotAction()`'s decision logic (still Level 1 legal-random)
is completely unchanged, and the delay applies uniformly to every bot
action type (playCard/selectDelegate/redistribute). Does not apply to
human actions, which stay immediate on confirm.

## Single Player mode

The landing screen has a third option alongside Host/Join: **Single
Player (play with bots)**. Tapping it skips every networking step
entirely - no lobby, no room code, no TURN fetch, no Trystero room - and
drops straight into trick 1: `LandingScene.startSinglePlayer()` builds a
roster directly (the tapping player as host/`p0`, the other three seats
as bots) and starts `HostGameScene` with `room: null, actions: null`.

`HostGameScene`/`HostGameData` treat `room`/`actions` as nullable
specifically for this: every place that would talk to real peers
(`gameAction`/`identity` message handlers, the `state.send` branch in
`sendMaskedStateTo`) is guarded to skip cleanly when there's no network
layer at all, while the host's own local rendering and the bot-driving
loop (`driveBotsIfNeeded`) run completely unchanged - Single Player is
the same authoritative host loop every other mode uses, just never wired
to a Trystero room.

The TURN-servers fetch that normally fires eagerly at boot is instead
lazy and memoized (`BootData.getIceServers`, only invoked by
`HostLobbyScene`/`ConnectingScene`) specifically so Single Player - which
never calls it - makes zero network requests of any kind. Verified by
recording every outbound request a full page load + Single Player click
produces: zero, in every run (see "Verification status").

## Room code refresh (suits-mp and mp-net)

Both prototypes share the same underlying issue: if the host sits idle in
an empty lobby for a while, the Trystero/Nostr room announcement can
lapse, making the room code silently undiscoverable to new joiners even
though the host's session is still alive. `HostLobbyScene` in both now has
a manual-only "Refresh code" button (pre-game only; there's no equivalent
mid-game, and no passive/background refresh timer). On tap it:

1. Leaves the current Trystero room and rejoins under the *same* code -
   the closest equivalent to "re-announce presence" achievable through
   Trystero's public API, which exposes no lower-level reannounce
   primitive.
2. Runs the same occupancy check the initial host setup uses; if that
   comes back occupied (another room claimed the code in the meantime),
   falls back to generating a brand new code with the same retry loop the
   initial setup uses.
3. Updates the displayed code, the copy-code/copy-invite-link values (now
   read via a getter closure instead of a captured string, so they always
   reflect the current code), and re-wires the identity/peer-leave
   handlers onto the new room.

Real peer connections don't survive the `room.leave()` this requires, so
their roster entries are dropped on refresh (they'd need to reconnect on
the possibly-new code); the host's own slot survives, and in suits-mp,
bot seats survive too (they were never real network peers). This is a
known, accepted trade-off given the failure scenario the button exists
for is specifically "no one has successfully joined yet" - it isn't
addressed further since it wasn't asked for.

## UI (Phaser primitives, Stage 3a scope)

`src/ui/renderGameView.ts` is the entire UI, shared between
`HostGameScene` (the host's own perspective, rendered locally with no
network round trip for its own actions) and `PlayerGameScene` (a remote
peer's perspective, rendered from a received `state` message). Stage 2's
monospace text-dump has been fully replaced (Stage 3a) with a laid-out
screen built from Phaser primitives (rectangles, circles, text) - still
placeholder-first per root CLAUDE.md, no sprites or art. The Rules
overlay and full Redistribution-log content are still stubs; real design
for both comes from Claude Design as DOM overlays in a later stage (3c).

**Interactivity fix (first follow-up task):** the Stage 1+2 build looked
non-interactive because `rerender()` called the top-level exported
`renderGameView`, which constructs a brand new `ViewState` on every call -
so a tap that selected a card (or assigned a redistribution card)
immediately triggered a re-render that discarded the very selection it
was showing. Fixed by splitting an internal `renderWithView()` that
reuses one `ViewState` object across re-renders triggered by the player's
own taps, with only the exported entry point (called when a genuinely new
masked state arrives) starting a fresh one. Also switched the remaining
raw `.on('pointerdown', ...)` handlers (hand-card selection,
redistribution card assignment) to go through `input/intents.ts`'s
`bindTapIntent`, matching every other tappable element.

**Legal/illegal hand-card styling (second follow-up task):** during the
play phase, every card in hand is now colored by whether it's currently
legal to play - white/tappable if legal, gray/inert (no tap handler at
all) if not - recomputed after every selection change. The state machine
behind this lives in `src/ui/handLegality.ts` (`computeHandLegality`,
`nextSelectionAfterTap`), deliberately kept free of any Phaser/DOM import
(unlike `renderGameView.ts` itself) so it can be unit-tested directly in
plain Node - see "Verification status". Four cases, most to least
restrictive:

1. **Trick 1's forced opener**: only the 2 of Yog-Sothoth is legal.
2. **Leading (any other trick), or required to follow suit**: only the
   legal pool (any single when leading, the suit cards when following)
   is legal; still single-select, no doubles. Tapping a different legal
   card *replaces* the current selection rather than accumulating one.
3. **Off-suit, nothing selected yet**: every card is legal (any of them
   could become a facedown single or start a double).
4. **Off-suit, one card selected**: that card shows as selected (amber);
   same-rank cards get a distinct highlight color (`partner` - still
   legal, tapping one *completes* a Twin Awakening double) while every
   other card stays plain legal (a facedown single with just the one
   card is still a valid confirm - selecting one card doesn't yet lock
   in "double" as the play type). Tapping a second, *different*-rank
   card replaces the selection rather than forming an invalid mismatched
   pair. Once two matching cards are selected, the double is complete and
   every other card locks to illegal until one of the two is deselected.

This note carries over unchanged when real card art eventually replaces
the placeholder text (per this task's own brief): only the rendering
(text color vs. sprite/texture state) needs re-skinning, not the
underlying `computeHandLegality`/`nextSelectionAfterTap` logic.

**Previous-trick log and own-identity display (carried over, re-skinned in
Stage 3a):** the log toggle button now sits top-left of the top bar
(mirroring Rules, top-right); tapping either swaps the whole screen for
that overlay's content, with a `[ Close ]` button to return. The
previous-trick log's content and masking rules are unchanged from the
follow-up task that introduced them (see `MaskedState.previousTrick`,
sourced from `state.lastTrickResult`). Own-identity now lives in "Your
row"'s team tag (see below) instead of a standalone text line, showing
the same `MaskedState.yourGod` data. `PersistentUIState` (still owned per
scene, still surviving every masked-state push - see Stage 3a section
below) generalized from a single `logOpen: boolean` to an `overlay:
'none' | 'log' | 'rules' | 'redistLog'` enum to cover the two new stub
screens, plus a `sortMode` field for the fan's suit/rank toggle.

## Stage 3a: core gameplay screen

Replaces the whole Stage 2 layout with Phaser primitives per the fixed
screen spec below - presentation/layout only, built entirely on the
already-correct game logic from earlier stages (no rules engine, bot AI,
networking, or masking changes, except the presentation-only safeguard
noted at the end of this section).

**Seating model** (`src/ui/seating.ts`, Phaser-free/unit-testable): seats
are drawn egocentrically - the local player is always at the bottom
("P3"), with the other three placed by their distance in turn order, not
their absolute `NetPlayerId`. Since turn order already proceeds clockwise
(`rules/engine.ts`'s `turnOrder` increments `PlayerId` by 1 mod 4), and
walking the physical seats clockwise from "you" goes bottom -> left ->
top -> right -> bottom, the mapping is: the next player to act after you
sits left (P4), the player two turns from you (opposite) sits top (P1),
and the player who acted right before you sits right (P2). `seatFor`/
`seatLabelFor`/`buildSeatMap` implement this once; every other piece of
Stage 3a (name tags, play areas, delegate targets, the Suit Cycle HUD)
reads seat position through them rather than re-deriving it.

**Suit Cycle HUD** (`computeSuitRing` in `ui/seating.ts`): a ring with one
node per seat. The trick's leader and lead god are derived from data
already in `MaskedState` - no new masked-state field needed: mid-trick,
the leader is `currentTrick[0].player` and the lead god is the existing
`leadSuit` field; before the leader's first card is committed, only *who*
will lead is known (`currentTurn`), not yet the suit; between tricks
(selectDelegate/redistribute/gameOver) no trick is in progress and every
node comes back undetermined. Each seat's suit is `suitAfterSteps(leadGod,
offsetFromLeader)`, reusing the same fixed rotation the rules engine
already enforces for follow-suit requirements - this HUD is a
visualization of that existing rule, not new logic.

*Live preview, accepted scope resolution:* the original design note
wanted the ring to update the instant the leader taps a card, before
committing, so everyone else can see what they'll need to follow - but
broadcasting an unconfirmed selection to other peers before commit would
be a masking/networking change, out of scope for this presentation-only
stage. Flagged to the user during implementation; the accepted resolution
splits the difference: the leader's own screen previews the lead god
immediately from their local (already-known-to-them, never-networked)
selection - `renderPlayerCluster` passes `view.selectedCards` into
`computeSuitRing` as `previewCardId`, and the previewed node renders with
a lighter/thinner outline than a confirmed leader - while every other
player's ring still only updates once the play is confirmed and
broadcast, matching the brief's own stated fallback.

**Play areas and name tags:** each seat shows the card played this trick
(masked - see below), and a name tag with independent turn (green dot)
and trick-starter (amber dot) markers, both can be lit at once. During
`selectDelegate`, opponent tags become tap targets *only* on the actual
double-winner's own screen - gated on `state.delegateChoices !== null`,
which `host/mask.ts` already only populates for that one player, so no
new masking logic was needed. During `redistribute`, the acting
distributor's own screen swaps the three opponent boxes from "card played"
to a "have/need" counter and tap target, gated the same way on
`state.redistribution !== null`.

**Redistribution flow:** tapping a candidate card in the fan stages it
(reuses `view.selectedCards`, holding 0 or 1 id, styled with the same
`selected` color as the play-phase selection); tapping an unfulfilled
opponent box assigns the staged card to that recipient and clears the
staging. This two-step (stage-then-target) flow replaces the earlier
auto-assign-to-first-needer text-dump interaction, per this stage's own
brief - the underlying `redistribute` action shape and host-side
validation are unchanged.

**Card fan** (`src/ui/cardFan.ts`, Phaser-free/unit-testable): an arc
radiating from a pivot point below the visible area, computed from
`tune.json`'s `handFanPerCardStepDeg`/`handFanMaxSpreadDeg`/
`handFanRadius`/`handFanCardWidth`/`handFanCardHeight` (per-card spread
scales with hand size, capped so a full 13-card hand still fits the
390px canvas - the cap had to fold in the card's own rotated bounding box
width, not just its center-point offset, since the outer cards' rotation
pushes their edges further out than their centers). Reuses
`computeHandLegality`/`nextSelectionAfterTap`/`colorFor` from
`ui/handLegality.ts` completely unchanged for the play phase; redistribute
gets its own much simpler card-state function (`redistributeCardState` -
assigned/staged/available, no suits or doubles involved) that reuses the
same `legal`/`illegal`/`selected` color vocabulary for visual consistency,
per this stage's "reuse the existing state logic" instruction (which,
read in context, is specifically about the play phase's
suit/double/pair-partner mechanic that redistribute has no equivalent
of).

**Sort button:** toggles the fan's display order between `sortCardIds`
(suit-cycle order, existing) and the new `sortCardIdsByRank` (ascending
rank, ties broken by suit-cycle order) - both in `rules/cards.ts`,
ascending-only per this stage's brief. Display-only; selection/legality
state is keyed by card id, not position, so re-sorting never disturbs it.

**Action button:** single full-width button below the fan, relabelled and
re-enabled per `turnPhase` and the local `ViewState` (which grew a
`delegateChoice: NetPlayerId | null` field alongside the pre-existing
`selectedCards`/`redistributeAssignment`, for the same stage-then-confirm
delegate flow as playing a card or redistributing).

**Facedown-card masking (presentation-layer safeguard):** the brief
requires "never reveal another player's actual card" for offsuit
(facedown) plays. Auditing `host/mask.ts` while implementing this
surfaced a pre-existing gap: `currentTrick`/`previousTrick` currently
carry the *real* card id for offsuit plays too, for every peer, not just
the player who made the play - a masking bug that predates this stage and
is out of scope to fix here (Stage 3a is presentation-only; masking fixes
belong in `host/mask.ts`, a separate task). `maskedPlayText()` in
`renderGameView.ts` works around it at the UI layer: any offsuit play
that isn't the local player's own is always rendered as a generic
"Facedown card" placeholder, regardless of what the payload actually
contains, applied consistently to both the live play-area boxes and the
previous-trick log. This satisfies the brief's UI-visible requirement
without touching masking/networking, but the underlying payload leak
itself still needs a real fix in a follow-up task.

## Out of scope

Any real visual/sprite card rendering (still placeholder/primitives -
Stage 3a laid out the screen with rectangles/circles/text, not art),
spectator mode, fewer/more-than-4-player support, Level 2/3 AI
sophistication (suit/team-awareness - explicitly deferred), any change to
when-suit-must-be-followed logic or the underlying redistribute/
selectDelegate action validation, and anything already merged as a
housekeeping item (CLAUDE.md deploy-path doc, relay-pinning doc, mp-base
relay fix). No changes to the existing hotseat `suits` prototype.
(Superseded: an earlier draft of this list also excluded "any change to
redistribution/delegate UI" - Stage 3a's own brief explicitly asked for a
new redistribution *UI* interaction model, which is now implemented; the
constraint that still holds is no change to the validation/action shape
underneath it.)

Stage 3a's own out-of-scope items: full Rules overlay content and full
Redistribution-log content (both stubbed - real design comes from Claude
Design + DOM overlays in a later Stage 3c), turn-indicator *animation*
polish beyond the plain dot markers, and a win-tracker/suit-completion
progress display (not requested by Stage 3a's brief).

## Verification status

Automated: `npm run typecheck` and `npm run build` both pass (across both
suits-mp and mp-net). A Playwright boot check confirms the landing screen
renders with the version stamp visible, all three buttons (Host/Join/
Single Player), and no uncaught JS exceptions; that clicking Host
successfully creates a Trystero room and renders the lobby (room code,
seat list, Refresh code button, disabled Start Game at 1/4) with no
uncaught exceptions - same for mp-net's own host lobby with its Refresh
code button. Console does show `Failed to load resource` network errors
from the TURN worker fetch in this sandboxed environment - identical to
mp-net's own landing page under the same network conditions pre-existing
this task, and swallowed internally by `fetchTurnIceServers()`'s own
try/catch (never blocks the flow); not a regression from this work.

**Bot-mode end-to-end, including the trick-1 fix:** 350 full bot-vs-bot
games total across two scripted simulations (host + 3 bots,
`chooseBotAction` on every seat, run directly against the shipped
`gameHost.applyAction` / `rules/engine` / `host/botAI` modules via `tsx` -
not committed, ad hoc) - all completed with zero rejected actions or
stuck states. Every single game's trick 1 opened with exactly Flicker of
the Void [Yog-Sothoth 2], regardless of which seat held it. An
adversarial probe attempted self-delegation on every double-win that
occurred (93 total across both runs, both directly against
`chooseDelegate()` and via the network-shaped `applyAction`); all were
correctly rejected. Outcome mix: suit-completion wins are rare-to-absent
under purely random Level 1 play, so most games ended via the trick-40
forced end or a trick-40 stalemate - expected, and it incidentally gives
heavy real coverage of that path.

**Card-selection state machine (item 3/4):** `computeHandLegality` and
`nextSelectionAfterTap` were extracted into `src/ui/handLegality.ts`
specifically so they could be unit-tested directly in plain Node (the
rest of `renderGameView.ts` imports Phaser, which needs a browser `window`
and can't be loaded standalone). A scripted test (not committed) walked
the exact 0 -> 1-selected -> 2-selected-matching -> deselect sequence
against hand-built fixtures and asserted every card's classification at
each step (legal/partner/selected/illegal) and the resulting `playType`
matched this brief's spec precisely - all steps passed.

**Live browser confirmation:** multiple Playwright runs through Single
Player's real UI, each starting a fresh shuffled game, confirmed: (a) the
forced-opener case rendering correctly (only Flicker of the Void
white/tappable, the other 9 cards gray/inert) in both a bot-led and a
human-led trick 1; (b) the must-follow-suit case's white/gray split
matching the required suit; (c) tapping between multiple different legal
cards correctly replaces the selection each time (single-select
contexts) and enables Play once a legal choice is selected; and (d),
in one run, a full successful round trip - selecting a legal card,
confirming Play, the bot-driven trick resolving with the human player
winning it, and the view correctly transitioning into the redistribution
phase with the right candidate cards and contribution counts shown - all
with zero console page errors. Coordinate-guessing against Phaser's
canvas-rendered text (no real DOM to query) made this slower than a
DOM-based UI to drive, but every interaction actually exercised was a
real tap through the real intent-layer handlers, not a simulated event.

**Single Player makes no networking calls:** verified by recording every
outbound request (excluding the page's own local asset loads) across a
full page load and Single Player click - zero, every time, confirming
the lazy `getIceServers` never fires and no Trystero room is ever joined
in this mode.

**Not automated-verified, needs the user's own test after deploy:**
masking correctness across 4 *real* human peers, turn rotation and suit
legality end-to-end over a real network, redistribution/delegate flow
with real human input, reconnect mid-game, and the room-code refresh
button's actual behavior against a genuinely lapsed Trystero/Nostr
announcement (that failure mode is relay-timing-dependent and wasn't
reproducible in this environment; the refresh code path itself was
exercised in isolation only insofar as it typechecks, builds, and renders
without crashing). Also not exercised in this pass specifically: the full
manual on-device tap sequence for the off-suit double-selection UX end to
end by a real user (the state machine driving it was verified directly,
per "Card-selection state machine" above, and its rendering was confirmed
correct for the forced-opener and must-follow-suit cases live - the
off-suit case's *live rendering* specifically would benefit from the
user's own phone pass, since engineering that exact hand/suit combination
via scripted bot play wasn't practical in this pass).

**Stage 3a (core gameplay screen):** `npm run typecheck` and `npm run
build` both pass; a Playwright boot check shows zero console page errors.
Live browser confirmation via an interactive Playwright session (screenshot
-> read -> click -> repeat, since coordinate-guessing needed the actual
rendered layout, not a blind script) played 14 real tricks end to end in
Single Player, confirming: the Suit Cycle HUD's per-seat suit assignment
mathematically cross-checked correct against the actual leader/lead-suit
for many different leader seats across those tricks; the local live-preview
HUD update (the accepted resolution for the live-preview design note - see
"Stage 3a" section above) visibly lighting up the correct seat/suit the
instant a card was tapped, before Play was even pressed; three full
redistribution cycles as the acting distributor (stage a card, tap a
target box, watch the have/need counter update and turn green on
fulfillment, Action button correctly gating on all-fulfilled) with the
resulting state changes broadcasting correctly to advance to the next
trick; turn and starter dot markers moving correctly across every
turn/trick transition; the Sort button toggling fan order between
`sortCardIds` and `sortCardIdsByRank` with the displayed cards visibly
reordering; all three overlay stubs (previous-trick log, Rules,
Redistribution log) opening and closing correctly, including the log
correctly listing a completed trick's plays with attribution; and,
critically, the facedown-card masking safeguard - an actual bot offsuit
play rendered as "Facedown card" in both the live play-area box and the
previous-trick log, confirmed by the exact screenshot rather than just
reasoned about. **Not exercised live in this pass:** the off-suit
double-selection UX's fan rendering specifically (same gap as the prior
task's own note above - 14 tricks of bot-shuffled hands never happened to
leave the human seat void of the required suit with a same-rank pair
available) and the `selectDelegate` phase (no double-win occurred in the
games played). Both reuse code paths already exercised elsewhere in this
pass or a prior one: the off-suit/pair color and tap-handler wiring in
`renderCardFan` is generic across all four `CardVisualState` values, not
special-cased per state, and `computeHandLegality`/`nextSelectionAfterTap`
themselves are byte-for-byte unchanged from the prior task's own verified
version; the delegate tap-to-stage/Action-button-commit flow is the same
two-step pattern already live-verified for redistribution, just gated on
`state.delegateChoices` instead of `state.redistribution`. Recommend the
user's own phone pass specifically target a double-win (two same-rank
cards led) and an empty-required-suit hand to see both live.

## Stage 3a amendment: unified card component

A presentation-only follow-up to Stage 3a, addressing six items: a single
reusable card-rendering component instead of per-context drawing code, a
slimmer "Air Deck" card proportion, a pop-out visual for selected fan
cards (including both cards of a Twin Awakening pair), facedown mini
card-back progress stacks for the redistribution flow, a previous-trick
log that shows real (masked) cards instead of plain text, and the sort
button repositioned onto the fan's own top edge. No rules/legality logic
changed - `ui/handLegality.ts` is untouched.

**Shared card component** (`src/ui/cardComponent.ts`): `drawCard()` is the
one place any card - hand fan, all four play areas, redistribution
stacks, previous-trick log - gets drawn. It takes a `CardFace`
(`faceup`/`facedown`/`empty`) and a caller-supplied `CardStyle` (fill,
border, text color); it has no opinion on what a visual state *means*
(legal/illegal/selected/assigned/etc.) - callers in `renderGameView.ts`
own that via small style-preset functions (`handCardStyle`,
`playAreaStyle`, `emptySlotStyle`, `stackFilledStyle`, `stackNeededStyle`,
`logCardStyle`). Face-up cards show the 2-letter god abbreviation (`YS` /
`CT` / `SN` / `NY`) over the rank (`A` for Ace), facedown cards get a
placeholder diagonal-stripe pattern, and empty slots get a dashed
outline - all primitives, no art. A `dims: CardDimensions` parameter
(`width`/`height`/`fontSize`) drives both the "standard" (hand/play-area)
and "mini" (redistribution stacks, log) size variants from the same
drawing code.

**Air Deck proportions:** `tune.json`'s `cardStandardWidth`/
`cardStandardHeight` (42x82) and `cardMiniWidth`/`cardMiniHeight` (18x35)
replace the old `handFanCardWidth`/`handFanCardHeight` keys - noticeably
narrower relative to height than a standard poker card, applied
everywhere through the shared component so every card context stays
visually consistent. The whole player-cluster vertical layout
(box/tag/HUD-ring/fan-baseline positions) was recomputed from scratch to
fit the taller card without colliding with the Suit Cycle HUD;
`handFanRadius` dropped from 260 to 240 to compensate.

**Selection pop-out** (`renderCardFan` in `renderGameView.ts`): entries
are split into non-selected and selected groups and drawn in two passes -
non-selected first, selected last - so selected card(s) render on top of
their neighbors with no overlap, translated up by
`tune.handFanPopOutDistance` and scaled by `tune.handFanPopOutScale`. The
same two-pass split naturally covers both a single selection and a
completed Twin Awakening pair (both cards carry the `selected` state at
that point), with no special-casing for the pair case.

**Redistribution progress stacks** (`renderRedistributionStack`): each
opponent's play-area box, during `redistribute`, now shows a row of small
facedown mini cards - one per card they're owed - dimmed
(`stackNeededStyle`) until assigned and filled/accented
(`stackFilledStyle`) once staged, alongside a small "have/need" text
label. The stage-a-card/tap-a-box interaction is unchanged from Stage 3a,
just re-skinned onto the shared component.

**Previous-trick log:** now renders each entry as the seat label plus its
play's card(s) via the shared component and the same `maskedPlayFaces`
masking used by the live play-area boxes (`drawCardRow`, shared between
both), instead of the old plain-text row - same play order, same masking
guarantees.

**Sort button:** moved from its own row above the player cluster to sit
directly on the card fan's top edge (`SORT_BUTTON_Y`, rendered
immediately before `renderCardFan`) - positioning only, behavior
unchanged.

**Verification:** `npm run typecheck` and `npm run build` both pass. A
Playwright boot check across the hub, `suits`, and `suits-mp` all show
the same single pre-existing `Failed to load resource: 404` console
message (present before this change too, on every prototype and the hub
page alike - not a regression from this work, most likely a missing
favicon); no other console errors on boot. Live interactive verification
via the screenshot-read-click Playwright loop played a real Single Player
game through several tricks and captured: a single card selected in the
fan popping out on top of its neighbors; a same-rank pair (`SN 4` /
`NY 4`) both showing the cyan "partner" highlight before the second tap
and both popping out together as "Commit: Twin Awakening" after,
including that double actually winning the trick and correctly
transitioning into `selectDelegate`; the redistribution flow's stacks
rendering as dimmed "0/1" facedown minis and turning into filled/accented
"1/1" ones as each recipient was assigned, then the resulting "Commit:
Redistribute"; and the previous-trick log open, showing all four seats'
real played cards (own card face-up, matching Stage 3a's existing
masking behavior for others). Four additional full/mostly-automated
Single Player games (bot-vs-bot with a scripted, blind coordinate-sweep
human turn) ran end to end with zero console errors beyond the
pre-existing 404, two of them progressing through multiple tricks with
hands correctly re-rendering after redistribution gains - confirming
stability beyond the one hand-driven session, on top of that session's
own direct pixel confirmation of the redistribution-stack and log
rendering correctness.
