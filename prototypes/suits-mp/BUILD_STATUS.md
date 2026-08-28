## Current milestone

Stage 3c (continued): the in-game HUD chrome (name tags, Suit Cycle HUD,
turn indicator wheel, Trick Starter tag, Team/god HUD, Order/Action
buttons) is now real DOM content, alongside the Rules overlay and Lobby
screen from previous sessions - all three are Claude Design handoffs
implemented as React components over the Phaser canvas, per root
CLAUDE.md's "UI implementation split." Redistribution-log content is
Stage 3c's last remaining stubbed piece. Version stamp counter is at 8
(`version.json`) - unchanged, no deploy has run yet.

## What was implemented

- Ported the Claude Design handoff `Suit of Madness Overlay.dc.html` as
  `src/dom/overlay/GameOverlay.tsx`: the turn indicator wheel and Suit
  Cycle HUD (two independently-rotating rings), 4 seat name tags with a
  Trick Starter ("Invoker") tag, a static Team/god identity HUD, and the
  "Order"/"Action" buttons. Data split into `overlayContent.ts` (seat
  order/degrees, suit info, placeholder names) and `gameOverlayStore.ts`
  (the bridge to the canvas, see below). The design's own decorative
  background layers (abyssal bloom, film-grain noise, vignette), its
  `canvas-owned zones` guide boxes, and its bottom-left "DOM overlay"
  label were all dropped - none are real chrome, they're the design
  tool's own stand-ins for what the *real* Phaser canvas already renders
  live underneath this layer.
- Both ring rotations are state-triggered CSS `transition`s (not
  `@keyframes` loops or Phaser tweens), with duration/easing now in
  `tune.json` (`turnWheelRotationMs`/`turnWheelRotationEasing`,
  `suitCycleRotationMs`/`suitCycleRotationEasing`) - exposed via the
  existing Tweakpane debug panel, which needed a small fix
  (`debug/debugPanel.ts`) since it previously assumed every tune value
  was numeric; easing curves are strings. The outer sigil ring's
  continuous decorative spin (a real `@keyframes` loop, not one of the
  two state-triggered rings the rule above targets) also got a tune.json
  duration (`outerSigilRingSpinMs`).
- `ui/renderGameView.ts`'s old Phaser-drawn equivalents of all of the
  above - the Suit Cycle HUD hub+ring dots, per-seat name-tag/turn-dot/
  starter-dot text, and the Team/Your-row god chips (`renderYourRow`,
  removed entirely) - were deleted rather than left running alongside
  the new DOM chrome, along with the unused `suitCycleHudRadius` tune
  value only they referenced. `renderPlayerCluster` now only draws the 4
  card play areas (still real, still canvas-owned).
- Positioning for the new DOM elements was adapted to this codebase's
  *real* Stage 3a layout constants (`CLUSTER_CENTER_Y`, `TOP_BOX_Y`,
  `SIDE_BOX_Y`, etc. in `renderGameView.ts`), not copied verbatim from
  the design's own coordinates - the design's guide boxes for where
  cards/play-areas sit were only an approximation independent of this
  codebase's actual geometry, and using them as-is would have visibly
  misaligned the new rings/tags against the real canvas-drawn cards
  beneath them. Each element's own *styling* (colors, borders,
  clip-paths, fonts, sizes) is still a direct pixel-for-pixel port.

## Key technical decisions

- **Two different things share this one component, per explicit user
  direction mid-task** (see the two-part clarifying question this
  session opened with, and `GameOverlay.tsx`'s header comment):
  - Name tags, the Suit Cycle HUD, the turn wheel, and the Trick Starter
    tag are placeholder/demo display only - a local `demo` state (turn/
    lead/trick/starter counters, ported near-verbatim from the design's
    own self-contained Component class) drives them, exactly mirroring
    the Rules/Lobby sessions' approach. They do not read real
    `MaskedState`.
  - The "Order" and "Action" buttons stay **real**: `sortLabel`/
    `onToggleSort` and `actionLabel`/`actionHint`/`actionEnabled`/
    `onAction` are threaded from `renderGameView.ts`'s real render pass
    through `gameOverlayStore.ts`, just re-skinned rather than redrawn.
    Neutering them would have made a currently-playable single-player
    bot game unplayable (no way to submit moves) or lose real sort
    behavior, for no benefit - this was simple prop-threading, not
    rules-engine work, so keeping it real cost nothing extra.
- **Seat-tag delegate-selection tap targets also stay real** - a
  discovery made *during* this session, not part of the original
  clarifying question: the old Phaser name tags weren't purely
  decorative, they were also the only way to tap-select a redistribution
  delegate after a Twin Awakening (double) win. Making the new DOM tags
  placeholder-only (as approved for their *display*) would have silently
  broken that interaction, leaving a real bot game stuck with no legal
  way to proceed past a double win. Applied the same "interactive stays
  real, display goes placeholder" principle the user had just approved
  for Order/Action: `gameOverlayStore.ts` carries a real
  `seatDelegate: Record<SeatPosition, SeatDelegateState>` (tappable/
  staged/onPick per seat, computed by the new
  `computeSeatDelegateState()` in `renderGameView.ts` from the exact
  same real logic the old code used), while the tag's *displayed* name
  and starter-tag stay placeholder. Not re-confirmed with the user before
  proceeding (to avoid a third clarifying round over a case that follows
  directly from a principle already approved this session) - flagged
  here per the standing rule for exactly this kind of mid-session
  discovery.
- Every real Action-button click also pulses the placeholder `demo`
  state forward (`GameOverlay.tsx`'s `handleAction`), purely so the
  ring rotations this task asked for are actually exercised during real
  play - this is not a claim that the demo state reflects the turn that
  just really happened (seat identities/order in the demo are unrelated
  to the real roster).
- The DOM tags are the tap targets directly (real `onClick` on the
  button element), not a parallel invisible Phaser hit-rectangle at a
  duplicated position - simpler and removes a way the two layers'
  coordinates could silently drift apart.

## Open questions

- No new open questions from this session beyond the one carried over
  from the Lobby session (Host/Join real-vs-placeholder navigation, see
  "Next proposed step").

## Known issues

- Google Fonts fail to load in this dev sandbox's network environment
  (carried over, same fonts, same cosmetic fallback to `serif`/
  `Georgia`) - not a code defect.
- The delegate-selection tap interaction (seat tags during the
  `selectDelegate` phase) is logic-ported directly from the previously-
  working real code and was exercised via TypeScript/build checks, but a
  live double-win didn't occur during this session's bot-game Playwright
  pass (chance-dependent) - this exact gap (`selectDelegate`'s live
  rendering not pixel-verified) was already a known, carried-over issue
  from the original Stage 3a implementation, so it isn't a new
  regression in verification coverage, just still open.
- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); not live-verified against real human
  peers (masking, turn rotation, redistribution/delegate flow, reconnect,
  room-code refresh); the off-suit double-selection fan is logic-
  verified but not pixel-verified live; the TURN worker fetch's swallowed
  console error in the dev sandbox; the Lobby session's Host/Join
  real-vs-placeholder navigation question (see below).

## Next proposed step

Real-state wiring for this session's placeholder HUD (name/turn/suit-
cycle/starter all currently demo-only) is the natural next Stage 3c
follow-up, alongside the still-open Lobby-session question of whether
Host/Join should navigate to the real `HostLobbyScene`/`JoinEntryScene`
now. Otherwise, Redistribution-log content remains Stage 3c's last
stubbed piece, and the carried-over Known issues (real fix for the
facedown-card masking leak, a user phone/live pass for real-peer
masking/reconnect, double-win/`selectDelegate` and off-suit-selection
live rendering) still stand.
