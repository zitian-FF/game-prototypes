## Current milestone

In-game overlay layout adjustments: the bottom action row, the Team/god
HUD, and the hand fan have been reworked per explicit user direction (not
a new Claude Design handoff - direct layout instructions). Version stamp
counter is at 8 (`version.json`) - unchanged, no deploy has run yet.

## What was implemented

- **Bottom row, three parts, one coordinated DOM row**
  (`dom/overlay/GameOverlay.tsx`):
  - Sort button moved to bottom-right (was floating near the hand fan's
    right edge, top-anchored).
  - Redistribution log button moved to bottom-left - and migrated from a
    canvas-drawn stub (`ui/renderGameView.ts`'s old `renderRedistLogStub`,
    a Phaser `rect`+`text` button) to a real DOM button, since it's now
    laid out and bottom-anchored together with the other two (already-DOM)
    buttons. Wired through a new `onOpenRedistLog` field on
    `gameOverlayStore.ts`'s `GameOverlayUiState`, computed in
    `renderGameView.ts` right where the old stub used to set
    `ui.overlay = 'redistLog'`. The overlay content itself (the actual log
    panel, still "coming in a later pass") is untouched - only the button
    that opens it moved.
  - Action button stays centered, all three now share one bottom anchor
    (`BOTTOM_ROW_BOTTOM`) instead of three different `top`/`bottom` values.
- **Team/god HUD** ("Thy covenant" bar): reduced to exactly 50% size via
  a `transform: scale(0.5)` wrapper (`transformOrigin: 'top center'`)
  around the unchanged original box, rather than hand-halving every
  border/shadow/font/gap value - guarantees a uniform 50% rather than an
  approximation. Repositioned to sit flush (zero gap) under the local
  player's name tag - its `top` is now derived
  (`BOTTOM_TAG_TOP + LOCAL_TAG_HEIGHT`, plus `LOCAL_INVOKER_TAG_HEIGHT`
  when the local seat is also this trick's starter) instead of a fixed
  constant, so it stays flush against whichever of the two ("just the
  name tag" / "name tag + Invoker tag") is actually showing.
- **Hand fan** (`ui/renderGameView.ts`, canvas): retuned to span from one
  screen edge to the other with a shallower per-card angle -
  `tune.handFanPerCardStepDeg` 6->4, `handFanMaxSpreadDeg` 58->40,
  `handFanRadius` 240->566 (a much larger radius is what lets a smaller
  total angular spread still reach the screen edges, while keeping the
  cards' vertical droop about the same as before - see the tune.json
  diff's comment for the exact reasoning). A 10-card hand's edge cards
  now tilt +-18 degrees instead of +-27.
- Confirmed the action button already has a single consistent slot across
  every phase (`computeActionButtonState()` returns one
  `{label, hint, enabled, onClick}` shape for play/selectDelegate/
  redistribute/waiting, rendered by the one `data-ui="action-button"`
  DOM element regardless of phase) - nothing needed flagging per the
  task's fallback instruction.
- Verified with a throwaway Playwright harness built for this session
  (a scratch `overlayGallery.ts`/`overlay-gallery.html`, deleted before
  finishing) that constructs a synthetic `MaskedState` in the redistribute
  phase directly, rather than trying to reach a real double-win through
  bot play (chance-dependent, and a live UI-automation loop trying to
  reach it repeatedly stalled/timed out) - this reproduces the reference
  screenshot's exact phase deterministically and was the fastest reliable
  way to confirm all four changes together in that specific state.

## Key technical decisions

- **CSS `transform: scale()` over hand-editing every value** for the
  Team HUD's 50% reduction: the box has ~15 separate px values (borders,
  shadows, chip sizes, gaps, three different font sizes) - scaling the
  whole rendered box guarantees an exact, uniform 50% (including things
  easy to miss by hand, like `boxShadow` blur radii) rather than an
  approximation, and needed zero changes to the box's own inner JSX.
- **Larger fan radius, not just smaller angle, for "shallower but still
  edge-to-edge"**: a shallower angle alone (smaller `maxSpreadDeg`/
  `perCardStepDeg`) narrows the fan's horizontal reach for a fixed
  radius, working directly against "spans edge to edge" - increasing the
  radius substantially is what recovers that reach from a smaller angular
  budget. Chose values (radius 566, half-angle 18 degrees for a 10-card
  hand) that keep the outer cards' vertical droop close to the previous
  tuning (~28px, was ~26px) so this didn't reopen the Team HUD/fan
  clearance issue flagged in the previous session - see "Known issues".
- **Redistribution log button migrated to DOM now, not left canvas-drawn**:
  root CLAUDE.md's UI-implementation-split section explicitly allows this
  ("a prototype adopts this pattern the next time it does UI work" on a
  given piece) - since this task requires laying it out in exact
  coordination with two already-DOM buttons in one shared row, doing that
  arithmetic against a canvas button drawn in a completely different
  render pass would be more fragile than just moving it, not less.
- Kept `teamHudTop` as a value derived at render time (from
  `BOTTOM_TAG_TOP`/`starterSeat`) rather than a second fixed constant for
  the "Invoker showing" case - a fixed constant sized for the taller
  (Invoker-included) case would leave a visible gap in the far more common
  case where the local seat isn't this trick's starter.

## Open questions

- None from this session - the one instruction that asked to flag rather
  than guess (whether the action button has one consistent slot across
  phases) resolved to "yes, already true" from reading the existing code,
  not a real ambiguity.

## Known issues

- Previous session's flagged tightness (hand fan cards grazing the Team
  HUD bar) is resolved as a side effect of this session's changes - the
  Team HUD moved up against the name tag (out of the fan's vertical
  range entirely) and the fan's own cards no longer reach as high at the
  same radius/droop. Worth a second look only if a future session grows
  card height again.
- Team tag text baked into each card's frame texture is still illegible
  at this game's actual card size (unchanged from the previous session,
  unrelated to this one).
- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); not live-verified against real human
  peers; Google Fonts fail to load in this dev sandbox's network
  environment (cosmetic fallback only); the Lobby session's Host/Join
  real-vs-placeholder navigation question; no card-back art exists yet.

## Next proposed step

Redistribution-log content is still the only stubbed screen left (no
design handoff for it exists yet - only its opening button has real
layout now). Otherwise, the same carried-over items as before: the Lobby
Host/Join navigation decision, a real human-peer live pass, and card-back
art if the user wants full art parity there too.
