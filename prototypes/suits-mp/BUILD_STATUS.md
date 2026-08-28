## Current milestone

Stage 3c (complete except Redistribution-log content): the in-game HUD
chrome (name tags, Suit Cycle HUD, turn indicator wheel, Trick Starter
tag, Team/god HUD, Order/Action buttons) is now real DOM content driven
by real `MaskedState` - no placeholder/demo data remains anywhere in
`dom/overlay/`. This completes the follow-up flagged at the end of the
previous session. Alongside the Rules overlay and Lobby screen, all
three Claude Design handoffs implemented so far are now fully wired to
real game state where real state exists to wire (see "Known issues" for
the two things that still don't: Lobby's Host/Join navigation, and
Redistribution-log content). Version stamp counter is at 8
(`version.json`) - unchanged, no deploy has run yet.

## What was implemented

- Removed `GameOverlay.tsx`'s local placeholder `demo` state (turn/lead/
  trick/starter counters, the `advanceTurn`-on-click pulse) entirely.
  Every value it renders is now a prop computed from real `MaskedState`
  by a new `computeGameOverlayHudState()` in `ui/renderGameView.ts`,
  threaded through `gameOverlayStore.ts`:
  - **Seat name tags**: real `seatLabelFor(seat)` ("P1"/"P2"/"P4") plus
    "(You)" for the local seat - this codebase has no real player-
    nickname data anywhere (`RosterEntry` carries no `name` field), so
    the seat label *is* the real equivalent of "name", not a placeholder.
  - **Turn indicator wheel**: rotates to the seat holding real
    `state.currentTurn` (via `seatFor`).
  - **Suit Cycle HUD**: rotates to the real lead god - reusing
    `ui/seating.ts`'s existing `computeSuitRing()` (the same function
    the old Phaser ring used), including its leader's-own-screen live
    preview of an in-progress selection before commit.
  - **Trick Starter ("Invoker") tag**: shown on whichever seat
    `computeSuitRing` reports as the real trick leader.
  - **Team/god HUD**: real `GOD_TEAM`/`TEAMMATE_GOD` lookups against
    `state.yourGod` (same source the old `renderYourRow` used).
  - Both `currentTurnSeat` and `leadGodIndex` come back `null` when
    genuinely indeterminate (e.g. an opponent is about to lead but
    hasn't committed, or between-phase moments with no trick in
    progress) - `GameOverlay.tsx`'s new `useForwardRotation`/
    `useLastKnown` hooks freeze the wheel/label at their last real value
    in that case rather than snapping to a default.
- New `useForwardRotation(index, order, stepDeg)` hook in
  `GameOverlay.tsx` turns a real 0-3 index into cumulative rotation
  degrees (jumping straight to the first real value at mount, then
  accumulating forward-only steps on every change) - this is what keeps
  the wheels turning forward and never snapping back now that the index
  driving them is real game state instead of a local demo counter that
  only ever incremented by exactly one.
- `overlayContent.ts` gained `GOD_TO_SUIT_INDEX` (God -> the fixed
  YS/CT/SN/NY cycle position) and dropped `PLACEHOLDER_NAMES` (no longer
  needed).

## Key technical decisions

- Reused `ui/seating.ts`'s existing `computeSuitRing()` rather than
  writing new leader/lead-god logic - it already encodes the exact real
  rules (mid-trick leader + `state.leadSuit`, or the local live-preview
  fallback while about to lead) that both the old canvas ring and the
  delegate-tap targets already depended on; recomputing it once per
  render in `computeGameOverlayHudState()` (alongside
  `computeSeatDelegateState()`, which already called it) keeps a single
  source of truth rather than two.
- Kept the God->code mapping as this repo's own 2-letter design codes
  (YS/CT/SN/NY, via `overlayContent.ts`'s `SUITS`/`GOD_TO_SUIT_INDEX`)
  rather than switching to `rules/cards.ts`'s `GOD_ABBR` (3-letter: YOG/
  CTH/SHU/NYA) - pixel fidelity to the source design's own abbreviations
  wins, and both are just abbreviations of the same real god, so nothing
  is lost.
- `yourGodChip`/`teammateGodChip`'s "Bound"/"Kin" labels and highlighted-
  vs-dashed styling stay structurally fixed to which chip is which
  (your own god is always "Bound"/highlighted, the teammate's is always
  "Kin"/dashed) rather than data-driven - that distinction is inherent
  to the two chips' roles, not something that varies per game, matching
  the old `renderYourRow`'s `isYours` check exactly.

## Open questions

- None from this session.

## Known issues

- Google Fonts fail to load in this dev sandbox's network environment
  (carried over, same fonts, same cosmetic fallback to `serif`/
  `Georgia`) - not a code defect.
- The delegate-selection tap interaction (seat tags during the
  `selectDelegate` phase) still hasn't been exercised by a live double-
  win in this repo's Playwright passes (chance-dependent) - carried over
  from the previous session, not new.
- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); not live-verified against real human
  peers (masking, turn rotation, redistribution/delegate flow, reconnect,
  room-code refresh); the off-suit double-selection fan is logic-
  verified but not pixel-verified live; the TURN worker fetch's swallowed
  console error in the dev sandbox; the Lobby session's Host/Join
  real-vs-placeholder navigation question (Host/Join currently navigate
  within `LobbyFlow`'s own placeholder state rather than to the real
  `HostLobbyScene`/`JoinEntryScene` - unrelated to this session's HUD
  work, still open from the Lobby session).

## Next proposed step

Redistribution-log content is Stage 3c's only remaining stubbed piece
(no design handoff for it exists yet). Otherwise, the two still-open
items above: the Lobby session's Host/Join real-vs-placeholder
navigation decision, and the carried-over Known issues (real fix for the
facedown-card masking leak, a user phone/live pass for real-peer
masking/reconnect and double-win/off-suit-selection live rendering).
