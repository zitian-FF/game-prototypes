## Current milestone

Fixed a real bug in the Suit Cycle HUD (the wheel's rotation didn't put
the current lead suit's badge at the position players actually read it
from) and removed the now-redundant "Lead: <name>" center-hub text per
explicit user direction. Version stamp counter is at 8 (`version.json`) -
unchanged, no deploy has run yet.

## What was implemented

- **Root cause found**: `leadGodIndex` (the data driving the wheel) was
  always correct - it's the exact same value the removed center label
  used, and `ui/seating.ts`'s `computeSuitRing()` already resolves it
  correctly to `state.leadSuit` for the trick leader. The bug was
  entirely in *where* the rotation math pointed that correct data: the
  wheel's four badges are laid out with Yog-Sothoth at local top (12
  o'clock) at rest, and the existing rotation formula
  (`leadGodIndex * -90`, accumulated forward-only via `useForwardRotation`)
  correctly rotates the lead suit's badge to that *top* position - but
  the "lead-marker" highlight ring, the visual cue for "this badge is the
  current lead," was already sitting at the ring's *bottom* (`top: -2`
  read like a leftover from a design that put it up top, contradicted by
  where it's actually drawn) and that's also where the user (and the
  in-canvas "Invoker"/turn indicator, a separate concentric layer) was
  reading it from. Wheel position and lead suit were never desynced from
  the game state - the ring was just rotating the right badge to the
  wrong anchor.
- **Fix**: added a fixed `+180` to the rendered rotation
  (`dom/overlay/GameOverlay.tsx`'s `suitDeg`), re-anchoring "current lead
  suit" to the bottom position instead of top, and moved the `lead-marker`
  highlight ring's own `top: -2` to `bottom: -2` to match. The
  `useForwardRotation` accumulation math itself (the forward-only,
  never-snap-back stepping) was untouched and re-verified correct - the
  `+180` is a constant anchor offset applied once at render time, not a
  change to the stepping logic.
- **Center hub cleanup**: removed the "Lead" caption and the suit-name
  text (`leadShort`, plus the now-fully-unused `useLastKnown` hook and
  `knownLeadGodIndex`/`leadShort` variables it fed) from the hub, per the
  task - the hub is now a plain decorative disc; the wheel's own rotation
  (highlighted by the repositioned lead-marker ring) is the only "current
  lead suit" indicator now.
- No changes to `tune.json` - the task said to check whether rotation
  timing/easing were already exposed rather than re-adding, and they were
  (`suitCycleRotationMs`/`suitCycleRotationEasing`, from an earlier
  session); this fix didn't need a new value since the +180 is a fixed
  correctness constant, not a feel/timing knob.
- **Verification**: live bot play proved too slow/unreliable at reliably
  reaching a *specific* lead suit within a scripted Playwright run (tried
  twice, both timed out without a second trick starting) - built a
  throwaway harness (`rotationCheck.ts`/`rotation-check.html`, deleted
  before finishing) that drives `renderGameView` with a synthetic
  `MaskedState` whose `leadSuit` can be swapped on demand
  (`window.__setLeadSuit(god)`), and checked all 4 gods plus a wrap-back
  to the first one. For every one of the 5 states, the badge Playwright
  measured as closest to the ring's bottom edge matched the state's real
  `leadSuit` exactly (both via the DOM's computed rotation matrix and via
  screenshot). Also confirmed via the real single-player game that the
  console stays clean on boot and the center hub renders as an empty disc.

## Key technical decisions

- **Fixed constant offset, not a rewrite of the accumulation math**: since
  `useForwardRotation`'s forward-only stepping was already provably
  correct (verified by hand-deriving the modular arithmetic and then
  confirming empirically), the minimal, lowest-risk fix was a single `+180`
  applied once at the point the angle is rendered, leaving the
  battle-tested stepping/freeze-on-null/never-snap-back behavior (shared
  with the turn-indicator wheel, which has no such anchor bug and wasn't
  touched) completely alone.
- **Didn't touch the turn-indicator wheel**: that's a separate concentric
  layer tracking whose *turn* it is (`currentTurnSeat`), not lead suit -
  it has its own independent rotation and pointer graphic, unaffected by
  and unrelated to this bug. Worth naming explicitly since a screenshot of
  the two rings together can look like one system at a glance.

## Open questions

- None from this session - this was a bug fix against already-correct
  state, not a design ambiguity.

## Known issues

- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); not live-verified against real human
  peers; Google Fonts fail to load in this dev sandbox's network
  environment (cosmetic fallback only); the Lobby session's Host/Join
  real-vs-placeholder navigation question; no card-back art exists yet;
  Redistribution-log content still stubbed (no design handoff yet).

## Next proposed step

The same carried-over items as before: Redistribution-log content, the
Lobby Host/Join navigation decision, a real human-peer live pass, and
card-back art if the user wants full art parity there too.
