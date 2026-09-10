## Current milestone

Added the end-of-trick "cards to collector" animation: once a trick's
winner (or, on a double win, their chosen delegate) is known, all 4
played cards from that trick visibly fly to their destination - either
zooming into another seat's nameplate and fading (this client can't see
that player's hand), or, when the local player is the collector,
reflowing into their own hand fan at each card's correct freshly-sorted
slot, alongside the rest of the hand smoothly tweening to its own new
layout.

## What changed

**Files changed**: `ui/renderGameView.ts` (`PersistentUIState` extended,
new "cards to collector" section, `presentGameView` and `renderCardFan`
both modified), `tune.json` (7 new values). No changes to `rules/
engine.ts`, `host/gameHost.ts`, or network/broadcast timing - this is a
presentation-layer animation on top of state the engine already
produces; trick resolution, delegate selection, and card collection
itself are all untouched.

- **Trigger split (single vs. double win)**: a single win's collector
  (`pendingDistributorId`) is known the instant the trick resolves, so
  its animation is embedded inside the existing `trickResultDwellMs`
  (2000ms) window: `presentGameView`'s existing freeze-on-`previousTrick`
  dwell now schedules a `cardCollectStaticBeatMs` (500ms) delayed call
  that runs the collect animation *before* the dwell's own 2000ms
  elapses - no extension of total dwell time. A double win's collector
  isn't known until the winner's own `chooseDelegate` action actually
  resolves (a real, indeterminate-duration player interaction, no
  dwell-like wait of its own for this part) - that shows up as an
  ordinary render where `turnPhase` has just become `'redistribute'`,
  detected via a plain, cheap check in the `!justCompletedTrick` branch
  of `presentGameView` with no special-casing needed.
- **`prepareCollectAnimation`** (new): the single shared entry point
  both trigger paths call. Guards on `turnPhase === 'redistribute'` and
  a `previousTrickKey` fingerprint (`ui.collectAnimatedTrickKey`) so it
  fires exactly once per completed trick regardless of which path
  reaches it. Resolves the trick's plays to masked `CardFace`s via the
  existing `maskedPlayFaces(play, yourSlot)` - the same masking
  mechanism every other animation in this file already uses - never
  from `state.yourHand`/`redistribution.candidateCards`, which stop
  being masked the instant a collected card (including a previously
  facedown one) merges into the collector's own hand array in
  cleartext. Branches on whether the local player is the collector.
- **Destination: another seat's nameplate**: `finishCollectAnimation`
  draws all 4 (or 5, on a double play) resolved faces at their real
  play-area origins and manually tweens each (`scene.tweens.
  addCounter`, the same arc-lerp technique as the existing card-play-
  in animation) toward `REMOTE_NAMEPLATE_ORIGIN[seat]` - the exact
  existing nameplate coordinates from PR #91, no new coordinate system
  - fading and self-destroying on arrival. A facedown card renders via
  its already-masked `{kind: 'facedown'}` face for the whole flight,
  identically to how a facedown play already renders at rest.
- **Destination: the local player's own hand**: `prepareCollectAnimation`
  computes which of `state.yourHand`'s ids are newly collected (against
  `oldHandIds`, an explicit snapshot - see the masking-leak bug below)
  and stores two new `PersistentUIState` maps keyed by `CardId`:
  `pendingHandCollectOrigins` (real play-area flight origin) and
  `pendingHandCollectFaces` (the masked `CardFace` to render *while
  flying*, resolved once up front from `previousTrick`, never from the
  by-then-unmasked `yourHand`). `renderCardFan` (unchanged sort/layout/
  edge-bound-compacting logic - `computeFanLayouts` already recomputes
  a fresh slot for every card in the resorted hand array, incoming
  cards included) reads these maps: any card present in
  `pendingHandCollectOrigins` draws from its flight origin and the
  masked face instead of the default `{kind:'faceup', cardId}`; every
  *existing* hand card also gets a reflow tween from its own previous
  rendered position (`ui.lastHandLayoutsByCardId`, snapshotted before
  this render) to its new slot - both incoming and existing cards tween
  simultaneously via the same manual arc-lerp counter, reading as one
  "hand reflows to accept new cards" motion rather than two separate
  animations. Gated strictly behind a `reflowing` flag
  (`pendingHandCollectOrigins !== null`) so a completely ordinary
  render is byte-for-byte unaffected - zero risk of a normal re-render
  misinterpreting "this card was also in last render's map" as a
  reflow trigger.
- **`tune.json`**: `cardCollectStaticBeatMs: 500`,
  `cardCollectStaggerMs: 60`, `cardCollectTravelMs: 650`,
  `cardCollectArcHeight: 40`, `cardCollectEase: "Cubic.easeInOut"`,
  `cardCollectFadeMs: 250`, `cardCollectFadeScale: 0.4` - all bind
  automatically to the existing generic `?debug=1` Tweakpane panel,
  confirmed live.

## How this was verified

Real gameplay, not fabricated/injected state - reusing the established
temporary-debug-hook-then-revert pattern (`HostGameScene.ts`'s
`debugForceDeal` + masked-state/container exposure, `main.ts`'s
`window.__gs`/`__container`/`__forceDeal`/`__handCardClickTarget`) to
construct the required rare hand/trick combinations deterministically
via `ForcedDeal`, since several of the 5 required scenarios need
specific, low-probability card distributions and (for the double-win
delegate cases) specific random bot choices. Both files carry zero
permanent changes this task - confirmed via `git diff --stat` against
`main` showing exactly `ui/renderGameView.ts` and `tune.json` changed.

- `npm run typecheck` / `npm run build` (repo root) - clean.
- All 7 new `cardCollect*` keys confirmed as live-editable Tweakpane
  fields under `?debug=1`.
- **(a) Single win, local NOT the winner, includes a facedown card**:
  forced deal with local playing last into a trick a bot wins outright,
  one bot forced into an off-suit (facedown) play. Sampled the render
  container's real-art-image count through the whole dwell+flight
  window: held at exactly 3 (the 3 genuinely-visible plays; the
  facedown one never contributes real art) from the static beat through
  the flight to the winner's nameplate, with no leak at any sampled
  point.
- **(b) Single win, local IS the winner, hand reflow, includes a
  facedown card**: forced deal so the local player's own card wins the
  trick outright. Sampled real-art-image count: held at exactly 7 (4
  old-hand cards + 3 genuinely-visible incoming cards; the incoming
  facedown card never contributes real art) throughout the static
  beat, the simultaneous existing-hand-reflow + incoming-card-flight
  tweens, and settling - confirming both the masking correctness and
  that existing hand cards visibly move to their new sorted slots
  rather than snapping.
- **(c) Double win, delegate NOT local**: forced deal giving the local
  player a legal double (matching-rank pair, missing the required
  suit), delegating to a non-local seat after the dwell ends. Verified
  the trick-result dwell (which fires for a double win too, per its
  own existing design, since it keys on `previousTrick` changing
  regardless of win kind) correctly shows no embedded collect
  animation for a double win, and that the flight to the delegate's
  nameplate fires immediately once `chooseDelegate` actually resolves
  - real-art-image count transitioned 6→5→3 exactly matching this
  trick's 5 genuinely-visible cards converging then leaving.
- **(d) Double win, delegate IS local**: forced deal requiring two
  independent ~1-in-3 bot random choices to land on "play the double"
  and "delegate to local" (~1-in-9 combined) - a retry loop with a full
  page reload per attempt (to avoid stale-timer cross-contamination
  between attempts) succeeded within a handful of tries. Sampled
  real-art-image count: correctly held at 4 (the trick's 4 genuinely-
  visible cards, out of 5 total - local's old hand was already empty,
  their own card having left it earlier in this same trick) for the
  entire flight/reflow window (matching `cardCollectTravelMs` +
  worst-case stagger, ~890ms), then rose to 5 only *after* the
  animation had fully settled - traced this rise to the animation
  correctly finishing (`finishCollectAnimation` clears the pending
  masking-override maps once the flight is done) followed by an
  entirely separate, pre-existing, out-of-scope behavior: a collected
  card that's now genuinely and permanently part of the local player's
  own hand is shown with its real art from then on, same as every
  other card the local player holds - not a masking leak during the
  animation itself, which is this task's actual scope.
- Masking correctness (hard requirement) held across all 5 required
  cases: a facedown card's real identity was never observed during
  flight, in either destination type, confirmed by the real-art-image
  counts above never exceeding the genuinely-visible count for their
  scenario at any sampled point mid-animation.
- Browser console clean on boot under `?debug=1`, real/unforced boot
  into Single Player (only the pre-existing, unrelated sandboxed
  network noise - `net::ERR_CONNECTION_RESET` / a 404 - present on
  every boot in this environment) - checked with all temporary hooks
  removed.

Two bugs were found and fixed during this task's own verification,
both masking-leak risks in the local-collector hand-reflow path:

1. `ui.lastHandLayoutsByCardId` is unconditionally overwritten by
   *every* `renderCardFan` call, including the dwell's own frozen
   render - so reading it directly inside `prepareCollectAnimation` to
   compute "which hand ids are newly collected" always saw the
   already-inflated post-collection hand, meaning no card was ever
   correctly flagged as newly-incoming and a facedown collected card's
   real id leaked as ordinary art. Fixed by snapshotting
   `oldHandIds` at the very top of `presentGameView`, before any
   render happens in that invocation, and threading it in explicitly
   rather than having `prepareCollectAnimation` read the (by-then-
   stale) field itself.
2. The dwell's frozen render initially substituted `oldHandIds`
   wholesale into `frozen.yourHand`, which incorrectly resurrected the
   local player's own just-played card into the static-beat display
   when that exact play was what ended the trick (their card leaves
   the hand in the same `presentGameView` call whose `oldHandIds`
   snapshot still includes it from the prior render). Fixed by
   filtering `masked.yourHand` down to ids also in `oldHandIds`
   instead, which correctly excludes both a newly-collected card and a
   card that legitimately already left the hand via the local player's
   own play.

**This change benefits from the user's own live verification on a
real device**, per the task's own explicit note - the automated
sampling above proves the trigger/destination/masking logic is
correct, but timing feel (the static-beat length before the zoom, the
travel/arc/fade curves, whether the hand-reflow reads as one cohesive
motion rather than two disjoint ones) is a judgment call the 7
`cardCollect*` Tweakpane fields exist to retune live.

## Open questions

None new - the task's own trigger/destination split (embedded-in-dwell
for a single win vs. immediate-after-delegate-resolution for a double
win), the "all 4 cards including the collector's own already-played
one" requirement, and the explicit "any actual reveal beyond this
flight is a separate later concern" scoping note were specific enough
that no mid-session clarification was needed.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps (no
Setup section, off-suit hidden-identity nature unstated in the copy);
`ui_player_nameplate.png` still applies to the local seat tag only
(deliberate); the `'partner'` hand-fan state still has no working
visual differentiation from `'legal'`; the itch.io iframe canvas-scale
fix, the asset pipeline's downscale/recompress output, the hand-fan
edge-bound fix, the Center HUD easing curve, the trick-result dwell
hold, the card-play arc animation, the Awakened reveal, and now this
collect animation's own feel/timing all still want a real-device/live-
deploy glance. Also still worth flagging: suits-mp still has no
permanent `?debug=1`-gated `ForcedDeal` hook (unlike the sibling
`suits` prototype's `rules/debugScenarios.ts`) - this is the fourth
task in this feature area to build and tear down its own one-off
version.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the next open loop - this collect animation's own
static-beat length, travel/arc/fade feel, and whether the hand-reflow
reads as one cohesive motion would be the highest-value addition from
this task's own follow-up. Promoting a permanent `?debug=1` forced-deal
hook (matching `suits/src/rules/debugScenarios.ts`'s existing pattern)
continues to look worthwhile given how many tasks in this area have
now needed one.
