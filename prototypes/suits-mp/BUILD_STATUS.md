## Current milestone

Stage 3a (core gameplay screen) plus its follow-up "unified card
component" amendment are complete. This is a true-multiplayer rebuild of
the hotseat `prototypes/suits` on mp-net's networking foundation
(Trystero/Nostr, identity handshake, TURN fallback), now with a laid-out
Phaser-primitives gameplay screen (seating, card fan, Suit Cycle HUD,
redistribution stacks, previous-trick log) replacing the original Stage
2 text-dump. Stage 3 real visual/sprite card art and turn-indicator
animation polish are explicitly future work, not started. Version stamp
counter is at 8 (`version.json`).

This session's change is infrastructure-only: suits-mp's client ID
generation, `identity`/`hostUI` action-channel creation, and
identity-matched reconnect handshake (debounced disconnect + roster
match-or-create with the room-capacity/slot-assignment check preserved
as a local callback, plus match-for-reconnect mid-game) now come from
the new shared `packages/mp-core` workspace package instead of a
locally duplicated copy also present in mp-net. No gameplay, UI, or
wire-protocol behavior changed - see "Key technical decisions" below.

## What was implemented

- Networking: ported from mp-net (landing screen, 5-char room code,
  copy-code/copy-invite-link, `?lobby=XXXXX` auto-join, TURN-servers
  fetch, debounced disconnect, identity-matched reconnect), with room
  capacity hard-locked to exactly 4 (host `p0` + peers `p1`-`p3`), a
  `roomFull` rejection for a 5th joiner, and a "Refresh code" button
  matching mp-net's (real peer roster entries dropped on refresh; bot
  seats survive since they're not real network peers).
- Masking architecture (`host/mask.ts`): the one deliberate divergence
  from mp-base/mp-net's broadcast pattern - host holds one canonical
  `GameState`, computes a per-seat `MaskedState`, every send is targeted
  (`{ target: peerId }`), no unmasked broadcast path exists.
- Three wire actions (`playCard`, `selectDelegate`, `redistribute`) over
  one `gameAction` channel; illegal actions are dropped host-side with a
  console warning, no nack message type. A `declareRoleGuess` action
  existed early on but was removed (see trick-40 forced end, below).
- Rules engine (`src/rules/{types,cards,engine}.ts`): started as a
  direct copy of hotseat `suits`'s engine, has since diverged
  (role-guess removal, trick-40 forced end). `host/gameHost.ts` drives
  it: `createInitialState()` deals, `settleAutoPhases()` auto-resolves
  the hotseat-only `blocker`/`trickResult` phases (no suits-mp
  equivalent), `applyAction()` routes wire actions through the engine
  with an authorization check on top.
- Bug fix - double-win card ownership: trick cards used to collect into
  the winner's hand even on a double win, which mandatorily delegates
  redistribution to someone else - breaking the 10-cards-per-player
  invariant. Fixed by collecting at one site (`advanceBlocker()`'s
  transition into the redistribution phase) keyed on
  `pendingDistributorId` rather than `pendingWinnerId`. Verified via a
  50-game bot simulation (zero invariant failures) plus a reproduction
  of the original bug by temporarily reintroducing the pre-fix ordering
  (1466 failures), confirming the test would have caught it.
- Bug fix - trick-1 forced opener: the *player* leading trick 1 was
  constrained to whoever holds the 2 of Yog-Sothoth, but not the *card*
  they opened with. Fixed via `isForcedTrick1Opener`/
  `forcedTrick1Opener` in `rules/engine.ts`, used as the single source
  of truth by `playCard()`'s validation, `host/botAI.ts`'s move choice,
  and `ui/handLegality.ts`'s legal/illegal highlighting.
- Trick-40 forced end (replaces role-guess): `redistribute()` checks
  after trick 40's redistribution finishes with no suit completed, which
  team's best player (by own-suit cards held) is ahead; ties break on
  the other teammate; full tie = stalemate. `WinInfo.reason` gained
  `'trick40'`.
- AI bot mode: permanent (not `?debug=1`-gated), entered via a
  standalone **Single Player (play with bots)** landing-screen button
  (skips all networking - no lobby, no room code, no TURN fetch, no
  Trystero room). Bots run host-local through the exact same
  `gameHost.applyAction()` path as real peers - Level 1 (legal-random)
  only, no suit/team-awareness. Bot steps are paced by `tune.json`'s
  `botActionDelayMs` (1000ms default) so a human can follow bot turns.
- Stage 3a gameplay screen (`src/ui/renderGameView.ts`): egocentric
  seating (`src/ui/seating.ts`, you always bottom), Suit Cycle HUD with
  a leader's-own-screen live preview of the lead god before commit, play
  areas + name tags with turn/starter dot markers, a stage-then-target
  redistribution flow, a card fan (`src/ui/cardFan.ts`) with
  legal/illegal/partner coloring driven by `src/ui/handLegality.ts`
  (Phaser-free, unit-testable), a rank/suit-cycle sort toggle, and a
  presentation-layer safeguard (`maskedPlayText()`) that renders any
  other player's offsuit play as a generic "Facedown card" regardless of
  what the payload actually contains (see Known issues).
- Stage 3a amendment - unified card component (`src/ui/cardComponent.ts`):
  one shared `drawCard()` used everywhere (hand fan, play areas,
  redistribution stacks, previous-trick log), narrower "Air Deck"
  proportions (`tune.json`'s `cardStandardWidth/Height`,
  `cardMiniWidth/Height`), a selection pop-out effect for selected fan
  cards (including both cards of a Twin Awakening pair), facedown mini
  card-back progress stacks for redistribution, a previous-trick log
  showing real masked cards instead of plain text, and the sort button
  repositioned onto the fan's top edge.

## Key technical decisions

- Masking is per-target-peer send, not broadcast-then-filter - there is
  structurally no unmasked broadcast path to disable by mistake.
- Bots share the exact same validation path as human actions
  (`gameHost.applyAction()`); no parallel/simplified bot rules path.
- Redistribution candidate pool for a human is restricted to that
  trick's cards (avoids needing visibility into another player's hand
  over the network); a host-local bot uses the engine's more permissive
  full-hand pool instead, since it already has full canonical-state
  access.
- Facedown-card masking is patched at the UI layer
  (`maskedPlayText()`) rather than in `host/mask.ts` itself, since the
  actual payload-level leak (see Known issues) was judged out of scope
  for the presentation-only Stage 3a task that surfaced it.
- Live-preview Suit Cycle HUD scope: broadcasting an unconfirmed
  selection pre-commit would be a masking/networking change, out of
  scope for a presentation-only stage - resolved by previewing only on
  the leader's own screen from their local (never-networked) selection.
  This was flagged to the user mid-implementation before landing on
  that resolution (see Open questions).
- mp-core extraction (this session): only `identity`/`hostUI` channel
  creation and the identity-matched reconnect handshake moved into
  `packages/mp-core` - suits-mp's own `gameAction`/`state` channels,
  masking, capacity check, and slot assignment all stay local (the repo
  brief for this had assumed suits-mp's action set was close to a
  superset of mp-net's generic `input`/`analogInput`/`inputDelta`
  channels; on inspection it isn't a superset at all - suits-mp never
  used those channels, they were replaced wholesale by the turn-based
  `gameAction`/`state` pair). The room-full/slot-assignment check that
  used to run inline in the identity handler is now passed as a
  `createEntry` callback into mp-core's `matchOrCreateRosterEntry`,
  preserving the exact same reject-vs-create behavior.

## Open questions

- The Stage 3a live-preview HUD scope question above was raised to the
  user mid-implementation rather than resolved silently; BRIEF.md now
  documents the accepted resolution in full, so no outstanding decision
  remains, but future sessions touching the Suit Cycle HUD should be
  aware this constraint (no pre-commit broadcast) was a deliberate
  scope call, not an oversight.
- No other outstanding questions. (Flagging per the new CLAUDE.md rule:
  no BRIEF.md ambiguity surfaced in the reviewed history that wasn't
  already written back into BRIEF.md itself.)

## Known issues

- **Facedown-card masking leak (payload level):** `host/mask.ts`'s
  `currentTrick`/`previousTrick` still carry the *real* card id for
  offsuit plays to every peer, not just the player who made the play -
  only patched at the UI rendering layer (`maskedPlayText()`), not at
  the source. A real fix belongs in `host/mask.ts` as its own task.
- Not live-verified against real human peers (only against bots/typecheck/
  build): masking correctness across 4 real peers, turn rotation and
  suit legality over a real network, redistribution/delegate flow with
  real human input, mid-game reconnect, and the room-code refresh
  button against a genuinely lapsed Nostr room announcement (relay-
  timing-dependent, not reproducible in the dev sandbox).
- Not live-exercised in any pass so far: the off-suit double-selection
  fan rendering with a real empty-required-suit + same-rank-pair hand,
  and the `selectDelegate` phase's live rendering (no double-win
  occurred in the sessions where live browser verification was done).
  The underlying state-machine logic for both was unit- or
  simulation-verified; only the live pixel rendering is unconfirmed.
- TURN worker fetch shows a `Failed to load resource` console error in
  the dev sandbox network environment - pre-existing, swallowed
  internally by `fetchTurnIceServers()`'s try/catch, not a regression,
  matches mp-net's own landing page under the same conditions.

## Next proposed step

Recommend a user phone/live pass specifically targeting a double-win
(two same-rank cards led, to exercise `selectDelegate` live) and an
empty-required-suit hand (to exercise the off-suit double-selection fan
UX live) - both are logic-verified but not pixel-verified. Separately,
the `host/mask.ts` facedown-card payload leak should get a real fix
(currently only patched at the UI layer) before this prototype is
considered network-security-complete. Stage 3 (real visual/sprite card
art, turn-indicator animation) remains unstarted and out of scope until
explicitly requested. See mp-net's own BUILD_STATUS.md for what's next
on the shared `packages/mp-core` side (mp-base is a candidate to also
wire onto it in a future brief).
