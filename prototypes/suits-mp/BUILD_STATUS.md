## Current milestone

Removed a legacy leftover text-glow on the bottom action button's label
(predated the real state-specific slab art, now reads as a stray
highlight), and added a second trigger condition to the "Awakened"
preview's Scenario 1 (local player holds a Dormant Deity Card, a 10 is
played) so it no longer fires on the local player's own 10 play or
after the local player has already taken their turn this trick.

## What was implemented

### Part 1: Action button text-glow removed

`GameOverlay.tsx`'s action-button label had `textShadow: actionEnabled
? '0 0 16px rgba(252, 216, 130, 0.6)' : '0 1px 3px rgba(0, 0, 0,
0.85)'`. Changed the enabled branch to `undefined` (no shadow at all),
leaving the disabled branch's plain legibility shadow untouched. The
enabled-state text *color* change (`oklch(0.97 0.04 92)`) is unaffected
- only the glow shadow is gone.

**Out-of-scope effects confirmed unchanged, not just left alone**:
- `[data-ui="lead-glow"]` (Center HUD's active-suit pulse): live
  `getComputedStyle()` shows `boxShadow: none` - this was never a
  `boxShadow` in the first place, it's an animated radial-gradient
  `background` (`suitsMpLeadGlowPulse` keyframe animation), so `none`
  here is correct and expected, not a regression. Confirmed this file's
  `lead-glow` block (lines ~391-404) has zero diff from this task.
- The small dark legibility drop-shadows (`0 1px 3px rgba(0, 0, 0,
  0.85)`-style, at the lines named in the task) are untouched -
  confirmed via a full-file diff review, only the one target line
  changed.

**Verified live, both states**: real Playwright screenshots + live
`getComputedStyle()` on the label span:
- Enabled ("Play Card", card selected): `textShadow: "none"`,
  `color: oklch(0.97 0.04 92)`.
- Disabled, both sub-cases ("Select a card to play" before selection,
  and "Waiting for Player N..." after submitting): `textShadow:
  "rgba(0, 0, 0, 0.85) 0px 1px 3px"` in both, unchanged.

### Part 2: Awakened Scenario 1 - added "local hasn't played yet" condition

`ui/renderGameView.ts`'s trigger block (inside `renderCardFan`, the
"Awakened preview" section) now requires **both**:
1. A 10 has been played in the current trick (existing check, via
   `state.currentTrick.some((play) => play.cards.some((id) =>
   cardById(id).rank === 10))`).
2. The local player has not yet played their own card this trick - new
   check, `!state.currentTrick.some((play) => play.player ===
   state.yourSlot)`.

Both conditions must hold before any of the local player's own
still-unplayed Dormant Deity Cards get added to `ui.awakenedHandCardIds`
(the set driving the persistent "Powered" look until the next trick
reset). Nothing else in that block changed - the `currentTrick.length
=== 0` reset-clear, the per-card-id loop, and Scenario 2 (a separate
code path further down this same file, for an opponent's already-
Powered play) are all untouched.

**A masking subtlety surfaced during verification, worth flagging**:
`host/mask.ts`'s `maskedCardIds()` blanks an **offsuit** play's real
card ids to `[]` for every viewer except the player who made it. This
means the Scenario 1 check's `state.currentTrick.some(...)` can only
ever see a 10 played by someone *other* than the local player if that
10 was played as a **required-suit follow** (`kind: 'normal'`) - an
offsuit 10 played by an opponent is invisible to the local client's own
`state.currentTrick` regardless of this task's new condition. This was
already true before this task (pre-existing masking behavior, not
something this task changed) and doesn't need a fix - flagging only
because it shaped how the verification scenarios below had to be built
to genuinely exercise the new condition rather than accidentally
testing masking instead.

## Key technical decisions

- Used `play.player === state.yourSlot` (both already-available fields
  on `MaskedState`/`MaskedTrickPlay`) to detect "local already played",
  rather than adding a new tracked field - the information was already
  present in `state.currentTrick`, just not previously checked for this
  purpose.
- Left `ui.awakenedHandCardIds`'s clear-on-`currentTrick.length === 0`
  logic exactly as-is: the new condition only gates *adding* newly-
  awakened cards, so a card already added earlier in the same trick
  correctly keeps its Powered look for the rest of that trick even
  after the local player takes their own turn - matching the task's
  explicit "does not change persistence/reset behavior" instruction.
- On discovering the offsuit-masking interaction while building the
  verification scenarios, rebuilt the "local already played, then a
  later player plays a 10" test so that later 10 is a genuine required-
  suit follow (visible to the local client), rather than leaving a test
  that would have passed for the wrong reason (the card being invisible
  due to masking, not because of the new condition).

## Open questions

None raised to the user this task - both parts were specified precisely
enough to implement and verify without needing a mid-task decision.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps; the
`'partner'` hand-fan state still has no working visual differentiation
from `'legal'`; the itch.io iframe canvas-scale fix, the asset
pipeline's downscale/recompress output, the Center HUD easing curve,
the trick-result dwell hold, the card-play arc animation, the Awakened
reveal's own visual polish, and the end-of-trick collect animation all
still want a real-device/live-deploy glance. suits-mp still has no
permanent `?debug=1`-gated `ForcedDeal` hook (unlike the sibling `suits`
prototype's `rules/debugScenarios.ts`) - this task built and fully
reverted its own temporary `debugForceDeal`/`debugPlayCard`/
`debugSetBotsPaused`/`debugAwakenedHandCardIds` hooks in
`HostGameScene.ts`/`main.ts`/`host/gameHost.ts` (confirmed via
`git diff --stat` against `main`, empty for all three) to exercise
these scenarios deterministically - now an eleventh instance of the
same one-off pattern.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the standing next open loop. Nothing from this task
adds to that list. If a future task wants to test more Awakened/masking
interactions like the one surfaced in Part 2, it's worth remembering
that `state.currentTrick` only ever carries real card ids for the
local player's own plays and for anyone's *required-suit* plays -
never for another player's offsuit play, which the host masks to `[]`
before it ever reaches the client.
