## Current milestone

Investigated a reported warm gold/amber glow persisting near the bottom
of the gameplay screen: **ruled out** the modal-leak hypothesis
conclusively (all three modals genuinely unmount, no trace left behind),
then found and fixed the real cause - an ungated `:hover` CSS rule on
the action button that mobile browsers commonly leave "stuck" active
after a tap, since touchscreens have no genuine hover concept. Also
changed the redistribution progress stack to full card size with the
"X/Y" progress overlaid on the card art, reusing the same Double-play
overlap technique already proven for the Double-need (2-card) case at
tight seat positions.

## What was implemented

### Part 1: Modal-leak hypothesis ruled out; real cause found and fixed

**Modal-leak investigation (ruled out)**: Live-tested all three modals
(`MenuModal.tsx`, `RulesModal.tsx`, `RedistLogModal.tsx`) via real
Playwright open/close sequences during actual gameplay - opened each,
closed it (via its own X button, and via scrim-click for Menu), and
scanned the entire live DOM afterward for (a) any element bearing the
modals' shared divider gradient (`rgba(48, 40, 18, 0.35) 45%`, the
exact distinctive middle stop, not just the shared gold RGB triple -
see caveat below) and (b) any element with a `data-ui` containing
"modal"/"screen"/"scrim" at all. Both scans came back **empty in every
case** - `DomRoot.tsx` renders each modal via a genuine `{flag &&
<Modal/>}` conditional (a real unmount, not an opacity/visibility
toggle), and `domUiStore.ts`'s `closeX()` functions correctly flip
their boolean with no transition/fade delay holding the component
mounted. No z-index or stacking-context issue found either - there's
nothing left occupying paint or layout once a modal's flag goes false.

**Caveat surfaced during investigation**: an early, cruder check (just
searching for the RGB triple `198, 160, 78` anywhere) produced a false
positive on `[data-ui="lead-glow"]` (the Center HUD's own intentional
pulsing glow, explicitly out of scope) - `GOD_ACCENT_RGB.YogSothoth` in
`GameOverlay.tsx` happens to be the exact same `198, 160, 78` as the
modal divider's own first gradient stop, purely by coincidental design
choice (both landed on the same "warm gold" value independently). Real
position data (`lead-glow` sits at ~y:226, near the Center HUD, never
near the bottom action button) and the more specific gradient-stop
match ruled this out as the culprit too.

**Real cause found (not a guess - confirmed via live DOM inspection of
the actual pressed/hovered state)**: `dom/overlay/GameOverlay.css`
(a *file* GameOverlay.tsx doesn't itself contain, which is why a
search scoped to the .tsx file alone found nothing):
```css
[data-ui='action-button']:not([data-enabled='false']):hover {
  box-shadow: 0 0 56px rgba(232, 190, 90, 0.6);
}
```
This is a real, active `boxShadow` - confirmed live via
`getComputedStyle()` while the action button was genuinely
mouse-hovered/pressed (`rgba(232, 190, 90, 0.6) 0px 0px 56px 0px`),
sitting exactly at the reported location (the action button, "near the
bottom of the gameplay screen"). `:hover` is a real CSS pseudo-class
with no unmount/lifecycle of its own - nothing in `GameOverlay.tsx`
needs to reference it for it to fire, matching the task's own "no
known active cause in GameOverlay.tsx" observation literally.

**Root cause of the "persists" complaint**: touchscreens have no
genuine hover concept, and mobile Safari/Chrome are well known to apply
a tapped element's `:hover` styles and never clear them until some
*other* element is tapped - there is no real "pointer leaves the
button" event on a touch device the way there is with a mouse. The
action button stays mounted and visible through the entire Play Card
phase (unlike a modal close button, which vanishes the instant it's
tapped), so a stuck `:hover` glow on it reads exactly as "persists...
even during normal Play Card phase."

**Fix**: gated the rule to real-hover-capable pointers only:
```css
@media (hover: hover) and (pointer: fine) {
  [data-ui='action-button']:not([data-enabled='false']):hover {
    box-shadow: 0 0 56px rgba(232, 190, 90, 0.6);
  }
}
```
`:active` (the separate `translateY(1px)` press-squish rule) is left
untouched - that pseudo-class reliably clears on touchend/touchcancel
across mobile browsers, unlike `:hover`, so it isn't exposed to the
same bug.

**Verified live, both directions**: real Playwright contexts -
- Mobile/touch (`hasTouch: true, isMobile: true`): confirmed
  `matchMedia('(hover: hover)')` and `(pointer: fine)` both evaluate to
  `false` in this context, and `getComputedStyle().boxShadow` stays
  `"none"` even with the pointer sitting directly over the button -
  exactly the condition that used to trigger the stuck glow.
- Desktop (real mouse, no touch emulation): both media features
  evaluate `true`, the glow correctly still appears while hovering
  (`rgba(232, 190, 90, 0.6) 0px 0px 56px 0px`) and correctly clears the
  instant the mouse moves away - the intended desktop affordance is
  fully preserved, not just suppressed everywhere.

**Also checked, not touched**: `dom/modalChrome.css`'s own near-
identical hover-glow rule (`rules-close-button`/`redist-log-close-
button`, `box-shadow: 0 0 50px rgba(232, 190, 90, 0.5)`) has the same
`:hover`-on-touch mechanism, but isn't exposed to the same *visible*
bug - tapping either button immediately closes and unmounts its whole
modal, so there's nothing left on screen for a stuck hover style to be
seen on. Left as-is to stay scoped to the actual reported symptom
rather than a speculative fix for an effect that can't actually be
observed. `dom/lobby/LobbyFlow.css`'s own similar glow (pre-game
screen, not "the gameplay screen" the report describes) is likewise
untouched for the same reason.

### Part 2: Redistribution progress stack - full card size, overlaid text, Double overlap

`ui/renderGameView.ts`'s `renderRedistributionStack` (amendment item 4)
now uses `CARD_DIMS_STANDARD` instead of `CARD_DIMS_MINI` - a full
card-back per owed card, matching a real played/hand card rather than
the old compact mini treatment. Updated the stale header comment at
this file's own "Card dimensions" section (previously documented
"mini" as covering both this stack and the previous-trick log; now
only the log still uses it).

**"X/Y" progress overlaid on the card art**: a small dark pill (`fill:
0x060c0f @ 0.95 alpha`, gold `0xc6a04e` border) drawn via
`scene.add.graphics()` directly on top of the card(s), centered at the
stack's own `(x, y)`, with the `have/need` text centered inside it -
replacing the old below-the-stack label. Color language matches
`dom/RedistLogModal.tsx`'s own card-count badge for visual consistency
across the DOM/canvas boundary.

**Double-need (2-card) fitting - reused, not reimplemented**: when
`need > 1`, spacing uses the exact same overlap formula
`drawCardRow` already solved for a Double *play* (`tune.
doublePlayOverlapFraction` - the same tune key, no duplicate added):
`step = dims.width * (1 - overlapFraction)`, later card drawn on top of
the earlier one. Verified the badge's center point always lands on the
frontmost (fully visible) card, never a seam: for 2 cards, the overall
footprint's horizontal center falls within the second (rightmost,
topmost-by-draw-order) card's own bounds by construction - checked the
arithmetic, not just eyeballed it.

**Verified live**: a real forced-deal scenario where one non-leading
player is forced to win via a genuine "Twin Awakening" double (two
matching-rank cards, different suits - the only double in the trick,
so `resolveTrick` forces them to win per its own "candidates = double
plays only, when any exist" rule) and picks the *local* player as
their delegate, so the local player's own screen renders the real
redistribution UI:
- **Left seat, need=2** (the tightest fit, exactly the case the task
  named): two full-size facedown cards, overlapping, both fully within
  the play-area recess bounds, "0/2" badge legible and centered on the
  frontmost card.
- **Top and right seats, need=1**: a single full-size facedown card
  each, "0/1" badge legible and centered.
- **Tap-to-assign still works**: staged a hand card, tapped the
  left-seat (need=2) stack - badge updated live from "0/2" to "1/2",
  confirming the interaction logic (unchanged) still functions
  correctly against the new full-size hit-area bounds.

**A debug-harness bug found and fixed along the way (test tooling
only, not shipped code)**: the temporary `debugForceDeal` hook used to
script this scenario could still have a bot's `scene.time.delayedCall`
(scheduled *before* the temporary bot-pause flag was set, against the
pre-forced random deal) fire *after* the forced deal was in place,
silently consuming a card from a hand that should have been untouched.
Fixed by having the temporary debug hook call `this.time.
removeAllEvents()` before installing the forced state - this hook was
fully reverted along with the rest of the temporary debug trio (see
below), so this fix itself ships nowhere; noted here only because it
cost real time to track down and would bite the next task that reaches
for the same forceDeal pattern.

## Key technical decisions

- Verified the modal-leak hypothesis with a *precise* gradient-stop
  match plus a broad `data-ui` pattern scan, rather than trusting a
  loose RGB-substring check - the loose version's own false positive
  (the coincidentally-same-color `lead-glow`) was a useful lesson in
  not concluding "found it" from a color match alone without also
  checking real screen position and the element's own actual purpose.
- Chose `@media (hover: hover) and (pointer: fine)` over deleting the
  hover effect outright - it's a legitimate desktop affordance, and per
  root CLAUDE.md's mobile-first house rule this is the standard,
  narrowly-targeted fix for "effect misbehaves on touch, not on
  desktop," not a reason to remove it for every user.
- Left `modalChrome.css`'s and `LobbyFlow.css`'s own near-identical
  hover-glow rules untouched rather than proactively "fixing" all
  instances of the pattern - neither is exposed to a *visible* stuck-
  glow bug (their host elements unmount immediately on tap, or live on
  a different screen than the one reported), so changing them would be
  unrequested, unverifiable scope creep.
- Centered the redistribution badge at the stack's exact `(x, y)`
  rather than offsetting it toward one edge - confirmed via the overlap
  arithmetic that this point always falls on the topmost, fully-visible
  card even in the 2-card case, so one placement rule works uniformly
  for both need=1 and need=2 without a special case.

## Open questions

None raised to the user this task - both parts were investigated and
verified concretely enough (a confirmed live root cause for Part 1, a
worked-through overlap-arithmetic proof for Part 2) without needing a
mid-task decision.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps; the
`'partner'` hand-fan state still has no working visual differentiation
from `'legal'`; the itch.io iframe canvas-scale fix, the asset
pipeline's downscale/recompress output, the Center HUD easing curve,
the card-play arc animation, and the Awakened reveal's own visual
polish all still want a real-device/live-deploy glance. The
`prepareCollectAnimation` multi-hidden-card id-matching bug flagged in
the immediately prior task (2026-09-10 collector-destination-
autoreveal) is unrelated to and unaffected by this task's own changes -
still open. suits-mp still has no permanent `?debug=1`-gated
`ForcedDeal` hook (unlike the sibling `suits` prototype's `rules/
debugScenarios.ts`) - this task built and fully reverted its own
temporary `debugForceDeal`/`debugApplyAction`/`debugSetBotsPaused`/
`debugGetState` hooks in `HostGameScene.ts`/`main.ts`/`host/
gameHost.ts` (confirmed via `git diff --stat` against `main`, empty for
all three) - now a thirteenth instance of the same one-off pattern.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the standing next open loop - nothing from this task
adds to that list. Worth specifically re-checking Part 1's fix on a
real phone during that pass (this task's own verification used
Playwright's touch/mobile emulation, which is a strong proxy but not
a substitute for a genuine device) to confirm the stuck-glow bug is
actually gone in the field, not just under emulation.
