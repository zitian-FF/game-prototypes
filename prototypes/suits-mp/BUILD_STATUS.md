## Current milestone

Rebuilt the Suit Cycle HUD's rotation math to solve relative to the
Invoker's actual seat (any of top/right/bottom/left) instead of a fixed
anchor - the previous session's fix (a constant `+180`) only happened to
work when the Invoker was at the bottom. Version stamp counter is at 8
(`version.json`) - unchanged, no deploy has run yet.

## What was implemented

- **Root cause of the previous fix's remaining gap**: the last session's
  `+180` re-anchored "current lead suit" to the ring's bottom - correct
  only when the Invoker happens to be seated there. With the Invoker at
  right/top/left, the wheel still put the right suit at the *wrong*
  screen position (bottom, always), because the formula never looked at
  *where the Invoker actually is* at all.
- **New rotation formula** (`dom/overlay/GameOverlay.tsx`): required
  rotation = angle_of(Invoker's seat) - home_angle_of(lead suit's fixed
  ring position), reduced to a 0-3 step index and fed through the
  existing `useForwardRotation` (unchanged - still forward-only, still
  freezes on indeterminate state, still never snaps back). The Invoker's
  seat->angle mapping reuses `overlayContent.ts`'s `SEAT_DEG` (previously
  defined but never actually consumed anywhere - the turn-indicator wheel
  computed the equivalent inline via `SEAT_ORDER.indexOf`) rather than
  re-deriving it, per the task's "reuse existing logic" instruction.
- **`starterSeat` is "the Invoker's position", not `currentTurnSeat`**:
  the task's prose named "whichever seat currently has the turn" as the
  value to reuse, but that's `currentTurnSeat` - a *different*, existing
  prop that keeps moving to whoever's turn it is as a trick progresses
  past its opening play. The prop that actually stays fixed at the
  Invoker's seat for the whole trick is `starterSeat` (computed by
  `ui/seating.ts`'s `computeSuitRing()`, already exactly "the trick
  leader's seat, frozen until the next trick"). Used `starterSeat`, since
  `currentTurnSeat` would make the wheel keep sliding to follow whoever's
  turn it currently is - it only coincides with the Invoker's seat at the
  exact instant the Invoker is leading, which is also exactly when both
  triggers in this task actually fire, so the two seat values happen to
  agree at every moment this feature cares about; `starterSeat` is the
  one that stays correct for the rest of the trick too.
- **Both triggers already worked correctly before this session** - this
  task's own two-trigger split (live local preview vs. wait-for-broadcast)
  was already exactly how `ui/seating.ts`'s `computeSuitRing()` and
  `ui/renderGameView.ts`'s `ViewState.selectedCards` were wired from an
  earlier session: `selectedCards` (`ui/renderGameView.ts`) is the "locally
  selected but not yet committed card" hook the task asked to flag if
  missing - it already existed cleanly (threaded through as `previewCardId`
  into `computeSuitRing`, which only reads it when `leaderNet ===
  state.yourSlot`, i.e. only for the local player's own selection - never
  another player's). Nothing needed changing there; only the final angle
  formula consuming `leadGodIndex`/`starterSeat` was wrong.
- **Lead-marker ring now follows the Invoker's seat too**: a direct,
  necessary consequence of the rotation fix - the marker was drawn at a
  fixed `bottom: -2`, which would highlight the wrong badge 3 times out of
  4 once the wheel could point anywhere. Repositioned via `transform:
  translate()` from a fixed center anchor (computed pixel offset per seat,
  `MARKER_OFFSET`) rather than swapping which of `left`/`right`/`top`/
  `bottom` is set, since only a single interpolatable property like
  `transform` can actually cross-animate between two arbitrary positions -
  swapping between e.g. `bottom: -2` and `right: -2` can only snap, not
  transition. Shares the wheel's own `suitCycleRotationMs`/Easing so it
  visually travels with the badge it's marking. Freezes at its last known
  seat (a small reusable `useLastKnown<T>` hook, the same pattern the
  previous session used and removed when the old text label went away -
  reintroduced here, generic this time, since the marker needs it too)
  rather than losing its position while indeterminate.
- No `tune.json` changes - checked first per the task's instruction; the
  marker's new transition reuses the wheel's own existing
  `suitCycleRotationMs`/`suitCycleRotationEasing` so they move in lockstep,
  and the rotation formula itself has no new feel/timing value to expose.

## Key technical decisions

- **Solve algebraically, don't special-case 4 seats**: rather than writing
  a lookup table of 16 (seat, suit) combinations, the fix computes the
  required step index directly from the two existing 0-3 indices
  (`starterIndex - leadGodIndex`, wrapped mod 4) - this is what makes the
  fix a small, symmetric change rather than a large one, and it's the
  same structural shape `useForwardRotation` already expected (a single
  0-3 index driving forward-only rotation).
- **Verified via a synthetic-state harness again, not live bot play**:
  reaching all 4 Invoker seats *and* both triggers through genuine
  multiplayer/bot flow would need contriving specific seat assignments
  per trick, which isn't controllable from the UI - built a throwaway
  harness (deleted before finishing) that drives `renderGameView` directly
  with hand-built `MaskedState`s (one path per Trigger 2 seat, held fixed
  while varying the leading player's `NetPlayerId` under a fixed
  `yourSlot`) and, separately, a *real* Playwright tap on an actual fan
  card for Trigger 1 (since that path depends on genuine local
  `ViewState.selectedCards`, which can't be injected the same way a
  masked network payload can). Confirmed all 4 (seat, suit) pairs for
  Trigger 2 and all 4 possible suits for Trigger 1's live pre-commit
  preview, by reading the DOM's actual computed badge/marker positions
  relative to the ring's own center (not just eyeballing screenshots).

## Open questions

- None from this session - this was a rebuild against an already
  correctly-architected state layer (per the task's own note, both
  triggers' hooks already existed), not a design ambiguity.

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
