## Current milestone

Fixed the end-of-trick collector animation's destination for a remote
winner (now flies cards into their own play area, not their nameplate -
without repointing the shared constant the unrelated card-PLAY
animation's origin also depends on), and added a genuine flip-reveal
for a facedown card once it lands in the local player's own hand at
the end of a trick they collected - confirmed this was a pure
animation-timing gap (the real identity was already available), not a
masking data gap.

## What was implemented

### Part 1: Collector destination - play area, not nameplate

`ui/renderGameView.ts`'s `finishCollectAnimation` (the "cards fly to
whoever wins the trick" animation, remote-collector branch) used
`REMOTE_NAMEPLATE_ORIGIN[descriptor.destSeat!]` as its flight
destination. Changed to `seatCenter(descriptor.destSeat!)` - the same
function `renderPlayerCluster`/`renderPlayArea` already use to
position that seat's own play area.

**Deliberately did NOT repoint `REMOTE_NAMEPLATE_ORIGIN` itself**, per
the task's own explicit warning: that constant is also the *origin* for
the unrelated remote-seat card-PLAY animation (`animateCardPlayIntoPlayArea`'s
call site in `renderPlayArea`, further down the same file) - a
different animation showing where a remote player's card visually
comes *from* when they play it, which must keep originating from the
nameplate exactly as before. Giving the collector animation its own
destination reference (`seatCenter`, already used elsewhere in this
file for exactly this purpose) instead of repointing the shared
constant keeps the two animations' concerns fully separate.

The local player's own destination (their hand, via
`pendingHandCollectOrigins`/reflow) is a completely separate code path
(the `descriptor.isLocalCollector` branch) and is untouched.

**Verified live, not just read**: real forced-deal scenarios (temporary
debug hooks, fully reverted after - see below):
- **Collector destination**: forced a remote seat ('top') to win a
  trick outright (a required-suit follow beats the leader's low card
  and two offsuit plays). Screenshots across the animation's timeline
  show all 4 cards converging and landing squarely inside the 'top'
  seat's own play-area box (the same dashed-outline rectangle
  `renderPlayArea` always draws there) - not anywhere near the
  nameplate position higher up the screen.
- **Card-PLAY origin regression check**: rather than trying to catch a
  190ms animation mid-flight via screenshot (timing-race-prone over a
  real CDP round-trip), added a temporary debug hook exposing the live
  x/y of whatever the most recent render flagged as still-animating
  (`PersistentUIState.cardsAnimatingThisRender`), read synchronously
  right after triggering a remote seat's play - before any
  `requestAnimationFrame` tick could have advanced the tween, this
  reliably samples the flight's true starting point. Result: `{x:57,
  y:375}`, exactly `REMOTE_NAMEPLATE_ORIGIN.left` - confirmed distinct
  from `seatCenter('left')` (`{x:58, y:305}`), proving the card-PLAY
  animation's origin is genuinely unaffected by this change.

### Part 2: Auto-reveal a collected facedown card - investigation + flip

**Investigation result: Case 1** (pure client-side animation-timing
gap, not a masking data gap). `host/mask.ts`'s `buildMaskedState`
already sends `yourHand: state.players[forSlot].hand` - the real,
completely unmasked hand array. The instant a card is collected into
the local player's own hand, its real id is already present in that
payload; `maskedCardIds`'s masking (`play.kind === 'offsuit' &&
play.playerId !== forSlot` - the mechanism that hides a card from
*opponents*) only ever applies to `state.currentTrick`/`previousTrick`,
never to `yourHand`. `ui/renderGameView.ts`'s existing
`prepareCollectAnimation` already relies on exactly this fact - it
recovers a hidden incoming card's real id "by elimination" against
`state.yourHand` (its own pre-existing doc comment says so). No
`host/mask.ts` change was made or needed.

**What was actually missing**: once a facedown incoming card's reflow
tween finished, the drawn container - built once, at reflow-draw time,
with `face: {kind:'facedown'}` baked in - was never updated again. It
would keep showing the generic card-back indefinitely until whatever
*unrelated* next full render happened to come along (the
`trickResultDwellMs` re-render, ~850ms later in the common case) and
silently redrew it correctly with the real face - an abrupt, untimed,
transition-free swap, not a deliberate reveal.

**Fix**: added `playCardRevealFlip` (`ui/renderGameView.ts`), triggered
from the existing reflow tween's own `onComplete` whenever `isIncoming
&& face.kind === 'facedown'` (i.e. a freshly-collected card whose
identity was hidden while it sat in the trick). A classic scale-through-
zero flip: the still-facedown container shrinks to nothing on the X
axis, is swapped for a freshly-drawn faceup container (the real
`entry.id`) at the exact same position/rotation, then grows back out -
the swap happens at the invisible zero-width midpoint, so no
facedown/faceup blend is ever visible mid-transition. New tune keys:
`cardRevealFlipMs` (260, split evenly across the two halves) and
`cardRevealFlipEase` ("Sine.easeInOut", matching the easing style
already used for this file's other short settle/punch tweens).

**Verified live**: a real forced-deal single-win trick where the local
player leads and wins with two opponents legitimately following suit
(visible) and one playing genuinely offsuit (masked/facedown from
local's perspective). Screenshots confirm: the hidden card shows the
generic mandala card-back while it sits in the trick; after local
collects (single win, no delegate step), that same card - identified
by marker id `Nyarlathotep-6` - lands in the hand fan and, without any
further render, transitions to its real composited face (purple,
Nyarlathotep's eye motif, rank 6) with no lingering facedown state,
confirmed stable 1.5s+ after the flip.

**A real, pre-existing bug surfaced during verification - flagged, not
silently fixed**: an *earlier* test scenario with **three**
simultaneously-hidden cards in the same collected trick (all three
non-local seats offsuit at once) left one of them stuck showing its
card-back permanently, with no flip ever firing. Root-caused to
`prepareCollectAnimation`'s existing id-recovery logic (`ui/
renderGameView.ts`, well above this task's own changes): it matches
`hiddenIds[i]` (from `state.yourHand`'s own natural order, filtered by
elimination) to `hiddenIncoming[i]` (from `previousTrick`'s play order)
purely *positionally*, assuming the two lists' orders always agree.
Isolating the same scenario down to exactly one hidden card (removing
any ordering ambiguity, since a length-1 list can't be
mis-ordered) reveals the real identity correctly every time - so the
flip mechanism itself is confirmed sound; the mismatch is specifically
in the pre-existing multi-hidden-card id-matching step this task never
touched. Per the task's own "flag clearly rather than silently bundle a
fix" principle (stated for the case-1/case-2 masking question, but the
same judgment applies here): **not fixed in this task**, since it's a
distinct, deeper defect outside what was asked, and worth a dedicated
look rather than a rushed patch alongside this animation work.

## Key technical decisions

- Reused `seatCenter` (already the single source of truth for a seat's
  play-area position elsewhere in this file) for the collector's new
  destination, rather than hand-deriving the same coordinates a second
  time or introducing a parallel constant.
- Verified the card-PLAY origin regression via a synchronous live
  position read (a temporary debug hook) instead of screenshot timing,
  after confirming empirically that a real CDP screenshot round-trip's
  own latency is comparable to or exceeds the 190ms animation it was
  meant to catch mid-flight - a screenshot-based check would have
  produced misleading "already settled" frames regardless of whether
  the code was correct.
- Chose a scale-through-zero flip (swap at the invisible zero-width
  midpoint) over a cross-fade or an instant texture swap - matches "a
  quick scale/rotate-through-zero card-flip" from the task's own
  suggested default, and sidesteps `drawCard`'s multi-layer composited
  art (frame + symbol + rank text) not being a single texture that
  could cross-fade cleanly on its own.
- Stopped at flagging the multi-hidden-card id-matching bug rather than
  fixing it - it lives in code this task didn't touch (`prepareCollectAnimation`),
  fixing it would mean redesigning how hidden-card identity gets
  recovered (order-independent matching needs a different data
  structure than a plain positional array), and the task's own explicit
  instruction was to keep a discovered pre-existing gap separate and
  flagged rather than silently bundling an unrelated fix into this
  animation task.

## Open questions

None raised to the user this task - both parts were specified precisely
enough (including the explicit shared-constant risk warning for Part 1)
to implement and verify without needing a mid-task decision.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps; the
`'partner'` hand-fan state still has no working visual differentiation
from `'legal'`; the itch.io iframe canvas-scale fix, the asset
pipeline's downscale/recompress output, the Center HUD easing curve,
the card-play arc animation, and the Awakened reveal's own visual
polish all still want a real-device/live-deploy glance. suits-mp still
has no permanent `?debug=1`-gated `ForcedDeal` hook (unlike the sibling
`suits` prototype's `rules/debugScenarios.ts`) - this task built and
fully reverted its own temporary `debugForceDeal`/`debugPlayCard`/
`debugSetBotsPaused`/`debugPeekAnimatingPositions` hooks in
`HostGameScene.ts`/`main.ts`/`host/gameHost.ts` (confirmed via `git
diff --stat` against `main`, empty for all three) - now a twelfth
instance of the same one-off pattern.

**New this task**: `ui/renderGameView.ts`'s `prepareCollectAnimation`
can mismatch a collected card's real id to the wrong hidden-card slot
when **more than one** card is hidden in the same collected trick (see
Part 2's own write-up above for the root cause) - the symptom is a
collected card stuck showing its facedown card-back permanently, with
no flip and no later correction. Only reproduced with all three
non-local seats offsuit in the same trick; a single hidden card (by far
the more common case) is unaffected. Worth a dedicated task before this
becomes visible in real play.

## Next proposed step

Investigate and fix the multi-hidden-card id-matching bug flagged
above in `prepareCollectAnimation` - likely needs the hidden-card
recovery to key off something more specific than list position (e.g.
each hidden play's own seat/position, matched against where the
collected card's rank/god combination could plausibly have come from,
or restructuring the host's collection step to preserve per-card
origin metadata through to the client). A real-device/live-deploy pass
covering the rest of "Known issues" remains the standing next open
loop after that.
