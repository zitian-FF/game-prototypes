## Current milestone

Added the "Awakened" reveal: a burst flourish (duplicate Deity-face +
star art scaling up to 2.5x and fading out, plus a rainbow holo-foil
shimmer) that plays once whenever a Deity Card's Dormant→Powered state
becomes visible - either as a client-side-only preview on a Dormant
Deity Card still sitting in the local player's own hand (fires the
instant any 10 appears in the current trick, persists until played or
the trick ends), or on another player's already-Powered play once it
finishes landing in its play area.

## What changed

**Files changed**: `ui/cardArt.ts` (new exported `playAwakenedEffect`;
`placeContain` now returns the placed Image instead of void), `ui/
renderGameView.ts` (`PersistentUIState` extended, `renderCardFan`'s
trigger detection + hand-card rendering, `animateCardPlayIntoPlayArea`'s
punch-tween `onComplete` chaining), `tune.json` (5 new values). No
changes to `rules/engine.ts`, `host/mask.ts`, `net/actions.ts`, or
`cardComponent.ts` - the real engine's own Dormant/Powered computation
and the network payload it produces are untouched; this task is purely
a new client-side preview layered on top of them, plus a shared
presentation flourish for both scenarios.

- **Scenario 1 - own dormant card, in hand, a 10 gets played**: new
  `PersistentUIState.awakenedHandCardIds: Set<CardId>` tracks which of
  the local player's own Dormant Deity Cards are currently showing
  their swapped/Powered look. `renderCardFan` computes, on every
  render, whether any 10 has already appeared in `state.currentTrick`
  (`play.cards.some(id => cardById(id).rank === 10)` - this only ever
  sees cards the client already has real ids for, since a masked
  offsuit play's `cards` is already `[]` by the time it reaches here;
  the preview is deliberately bounded by the same information the real
  player has, not omniscient) - if so, every Deity Card in
  `state.yourHand` not already in the Set gets added (and the burst
  fires for each, independently - handles holding two at once for
  free) and drawn with `deityCardState: 'powered'` from then on. An
  empty `state.currentTrick` clears the whole Set unconditionally -
  this is the exact same trick-scoped boundary the real engine resets
  its own equivalent tracking at (`state.plays` reset to `[]` the
  instant a trick's 4th card is played, in `rules/engine.ts`'s
  `playCard`), so clearing here is correct both at a genuine fresh
  trick's start and right after a real reset; the trick-result dwell
  hold's frozen render (which substitutes `previousTrick` into
  `currentTrick`, never empty for a trick that actually completed)
  correctly does *not* clear early, so an unplayed Awakened card
  keeps showing through the whole dwell and only reverts once the
  real next state renders.
- **Scenario 2 - another player plays an already-Powered card**:
  `animateCardPlayIntoPlayArea`'s existing punch-tween `onComplete` (the
  point where a play has fully finished landing - travel, then the
  arrival punch) now also fires `playAwakenedEffect` when
  `remoteOrigin !== null` (a remote seat, never the local player's own
  play - `remoteOrigin` doubles as the existing "is this a remote
  seat" signal from PR #91, no new parameter needed) and
  `face.deityCardState === 'powered'`. No underlying art swap here -
  `maskedPlayFaces` already resolved the real, correct Powered face
  before this card was ever drawn, exactly as it did before this task,
  so the burst plays on top of art that was already right from its
  very first frame. Piggybacks on the same per-seat
  `animatedPlayKeyBySeat` fingerprint the fly-in itself already uses,
  so it needs zero new bookkeeping and structurally cannot re-fire on
  a later re-render of the same already-landed play.
- **`playAwakenedEffect(scene, container, god, dims)`** (new, `ui/
  cardArt.ts`): spawns a duplicate `deity_face_<god>` Image (same
  `POWERED_FACE_BOX` placement `buildCard` already uses) and a
  duplicate `'★'` Text (same `RUNTIME_RANK_CENTER`/`RUNTIME_STAR_SIZE`
  as the real glyph), each tweened to `tune.awakenedBurstScale` (2.5x)
  with alpha to 0 over `tune.awakenedBurstMs`, self-destroying on
  `onComplete`. `container` must be the same card-center-relative local
  space `buildCard` placed its own layers into - both callers pass the
  outer container `drawCard()` itself returns, which shares that
  origin with `buildCard`'s inner one.
  - **Rainbow holo-foil shimmer**: one additive-blended rainbow-gradient
    `Graphics` quad, swept once across the burst face art over
    `tune.awakenedShimmerMs`, masked to that same face art's own alpha
    silhouette via a live `Phaser.Display.Masks.BitmapMask` reference (not
    a hand-traced shape, so it can never drift out of sync with the art,
    and it inherits the face art's own scale-up/fade-out automatically
    since the mask samples its live rendered state each frame). Chosen
    over a custom shader as the better effort/quality tradeoff - a
    single Graphics quad plus a stock Phaser mask already reads as a
    foil-card shine, and the task explicitly allowed this technique.
    Skipped outright when `scene.renderer.type !== Phaser.WEBGL`
    (BitmapMask is WebGL-only) rather than risk an unmasked rainbow
    rectangle floating free of the art in a Canvas-renderer fallback -
    the burst's scale/fade still plays either way.
- **`placeContain`** (`ui/cardArt.ts`) now returns the placed
  `Phaser.GameObjects.Image` (or `null` if the texture isn't loaded)
  instead of `void`, so `playAwakenedEffect` can tween/mask the exact
  image it just placed rather than re-deriving its position
  independently. `buildCard`'s own four call sites are unaffected -
  they already ignored the return value.
- **`tune.json`**: `awakenedBurstScale: 2.5`, `awakenedBurstMs: 550`,
  `awakenedBurstEase: "Cubic.easeOut"`, `awakenedShimmerMs: 700`,
  `awakenedShimmerAlpha: 0.55` - five independent values so the burst's
  size/speed/feel and the shimmer's duration/opacity can each be
  retuned without touching the others. All five bind automatically to
  the existing generic `?debug=1` Tweakpane panel - confirmed live.

## How this was verified

Real gameplay, not fabricated/injected state - but per the task's own
explicit allowance, some of these combinations (holding two Deity
Cards at once, an opponent's Deity Card resolving Powered) are rare
under real shuffle luck, so the same debug-hook-then-revert pattern
established in prior tasks was used to construct them deterministically
via `rules/types.ts`'s existing `ForcedDeal` mechanism (`initGame`'s
`forced` parameter - already wired for `?debug=1` scenario forcing in
this repo's sibling `suits` prototype, just not yet exposed in
suits-mp). Two temporary hooks (`HostGameScene.ts`'s `debugForceDeal`
+ its own masked-state/container exposure; `main.ts`'s `window.__gs`/
`__container`/`__forceDeal`/`__handCardClickTarget`, the last one
replicating `renderCardFan`'s own fan-layout math to click a
*specific* hand card by id rather than just any legal one) were added,
used, then fully reverted via `git checkout` (both files carry zero
permanent changes this task) - confirmed via `git diff --stat` against
`main` showing exactly `ui/cardArt.ts`, `ui/renderGameView.ts`, and
`tune.json` changed, nothing else.

- `npm run typecheck` / `npm run build` (repo root) - clean.
- Confirmed all five new `awakened*` keys appear as live-editable
  Tweakpane fields under `?debug=1`.
- A forced deal gave the local player two Dormant Deity Cards
  (`Nyarlathotep-DeityCard`, `Cthulhu-DeityCard`) and rigged the trick
  so bots at earlier positions played two separate 10s before the
  local player's own turn. A Playwright script scanned the whole
  render container (counting `'★'` Text nodes and `deity_face_*`
  Image nodes) at each step of a real trick:
  - **The first 10 lands** → count jumped from the steady 2 (both
    cards' permanent Powered markers) to 4 for ~150-250ms (each
    card's own transient burst pair layered on top), then back to 2 -
    confirms the trigger fires and both cards animate independently in
    the same render (cases a + e).
  - **A second 10 lands** later the same trick → count stayed flat at
    2 across 8 samples spanning ~1s - confirms no re-trigger (case b).
  - **The local player plays the already-swapped
    `Nyarlathotep-DeityCard`** → count rose to 3, but for a fully
    accounted-for reason unrelated to any bug: the local player won
    this trick with it (Powered scores 11, beating the two 10s), and
    `advanceBlocker` collects the trick's cards straight back into the
    winner's (distributor's) hand ahead of redistribution - so during
    the following trick-result dwell, the *same* card is legitimately
    showing twice at once (once frozen in its just-landed play-area
    slot, once again in the hand fan, now inflated with the collected
    cards) with no new burst tween running either time - confirms case
    d (moves silently, no second animation).
  - **Once the dwell actually ends** (polled the canvas itself, not
    `window.__gs()` - the masked state the host hands back updates
    ahead of what's actually rendered, since `presentGameView`'s dwell
    only delays the render, not the state snapshot a debug hook reads)
    → both Deity Cards (now sitting in the distributor's inflated,
    still-unredistributed hand) read exactly 0 stars / 0 face images /
    2 plain "1" numerals - confirms the still-unplayed
    `Cthulhu-DeityCard` reverted to Dormant at the real trick boundary
    (case c).
- A second forced deal gave a bot an already-Powered
  `Cthulhu-DeityCard` (a 10 played by the leader first, then the bot's
  only legal card was its own suit's Deity Card). Sampling from the
  instant that play first appeared in `currentTrick`: real Powered art
  visible immediately (1 star/1 face, no swap, correct for a card the
  local player never saw Dormant) through the whole ~370ms fly-in
  (`cardPlayTravelMs` + `cardPlayPunchMs`×2), then the burst fired
  right on schedule (2/2 for ~500ms, matching `awakenedBurstMs`),
  self-destroying back to 1/1 - confirms case f, sequenced strictly
  after landing.
- Masking correctness for this task specifically: Scenario 2's burst
  condition (`face.kind === 'faceup' && face.deityCardState ===
  'powered'`) can structurally never be true for a masked/hidden
  offsuit play - `maskedPlayFaces` already reduces those to a single
  `{kind: 'facedown'}` face with no `deityCardState` at all before
  this code ever runs, unchanged from PR #91 - so this task introduces
  no new way for a hidden play's real state to leak.
- Browser console clean on boot under `?debug=1` (only the
  pre-existing, unrelated sandboxed network noise - `net::ERR_CONNECTION_RESET`
  / a 404 - present on every boot in this environment) - checked with
  all temporary hooks removed.

**This change benefits from the user's own live verification on a
real device**, per the task's own explicit note. The counted-node
sampling above proves the burst and shimmer are genuinely running on
schedule and self-destroying cleanly, but "does a 2.5x face+star burst
with a rainbow foil sweep actually read as an exciting Awakened
reveal, on a real phone" is a feel/quality judgment this automated
check can't make - the five `awakened*` Tweakpane fields under
`?debug=1` are there to retune live if the numbers or the shimmer's
look don't land right on first look. The shimmer technique in
particular (a gradient quad masked to the face art's silhouette,
additive-blended) was a deliberate cheap/effective choice over a
custom shader - worth a specific look to confirm it reads as a foil
shine rather than a wash of color.

## Open questions

None new - the task's own two-scenario split, the explicit
client-side-only/non-predictive framing of the hand preview, the
trick-scoped reset rule, and the addendum about reusing the existing
facedown placeholder verbatim (no substitute card-back asset, no
filename assumptions about a future one) were specific enough that no
mid-session clarification was needed.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps (no
Setup section, off-suit hidden-identity nature unstated in the copy);
`ui_player_nameplate.png` still applies to the local seat tag only
(deliberate); the `'partner'` hand-fan state still has no working
visual differentiation from `'legal'`; the itch.io iframe canvas-scale
fix, the asset pipeline's downscale/recompress output, the hand-fan
edge-bound fix, the Center HUD easing curve, the trick-result dwell
hold, the card-play arc animation, and now this Awakened reveal's own
feel/shimmer quality all still want a real-device/live-deploy glance;
a Twin Awakening double-card play landing with a Powered Deity Card as
one of its two cards wasn't separately exercised this pass (the same
per-face loop in `animateCardPlayIntoPlayArea` already handles it, just
not empirically confirmed for the double case specifically). Also
worth flagging for a future task: `rules/types.ts`'s `ForcedDeal`
mechanism already exists and is wired through `initGame`, but suits-mp
has no permanent `?debug=1`-gated way to invoke it yet (unlike the
sibling `suits` prototype's `rules/debugScenarios.ts`) - every task in
this feature area so far, this one included, has had to build and
tear down its own temporary hook to reach it, which is worth
promoting to a real, permanent debug feature if forced-deal scenarios
keep coming up.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the next open loop - the Awakened burst's scale/timing
and the rainbow shimmer's look specifically (does it read as foil, not
noise) would be the highest-value addition from this task's own
follow-up. Separately, promoting a permanent `?debug=1` forced-deal
hook (matching `suits/src/rules/debugScenarios.ts`'s existing pattern)
would remove the need for every future task in this area to build and
revert its own one-off version.
