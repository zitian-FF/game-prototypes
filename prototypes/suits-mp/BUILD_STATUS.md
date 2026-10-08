## Current milestone

Tutorial mode's contextual hint (lesson) panel no longer covers the hand
fan it's supposed to be guiding - real-device testing (user report, with
screenshot) showed it hiding most of every card, including the exact one
the guide pointer indicated.

## What was implemented

- `ui/CanvasUiScene.ts`: moved the tutorial lesson box from
  `(195, 711)` to `(195, 90)` - same size, same text styling, just
  relocated from directly over the hand fan to the gap just below the
  scene-selector/quit row at the top of the screen.

## Key technical decisions

- Root cause: `ui/renderGameView.ts`'s `FAN_BASELINE_Y` (674) is the
  resting hand fan's own anchor - each card (`tune.cardStandardHeight`
  114) spans roughly y617-731 around it. The lesson box's old center
  (711) with its own 82px height spanned y670-752, directly covering
  most of that range - confirmed via side-by-side screenshots (lesson
  closed vs open) at the exact same scene/step, not just computed on
  paper. This is why it wasn't caught at the time it was built: a sliver
  of each card stayed visible above the box, tappable in a quick test,
  but the box hid the rank numerals and most of each card's real
  footprint - exactly what the real-device screenshot showed, and bad
  enough on different viewport proportions to make tapping genuinely
  fail.
  - This confirms this is NOT the same "contextual hint panel" an
    earlier task's trail (now-stale task-list entries) referred to -
    that one was the ordinary-gameplay "required-suit-banner"
    (`dom/overlay/GameOverlay.tsx`'s old scaffolding), already deleted
    for real (see `FAN_BASELINE_Y`'s own doc comment in
    `renderGameView.ts`, 2026-09-10). This is the tutorial-only lesson
    box (`tutorialUiStore.ts`'s `lessonOpen`/`lessonText`), a separate,
    newer piece of chrome that was never checked against the fan's real
    footprint until now.
  - The new spot overlaps the top seat's own card-back box instead of
    the fan - acceptable since that box is decorative-only in every
    guided moment a lesson ever coexists with (no scene's hard-lock ever
    asks the player to tap the top seat while a lesson is showing - Scene
    6's one delegate-selection moment targets the *left* seat).
  - Kept the box's own size/wrap width unchanged (confirmed the longest
    existing lesson strings, including Scene 6's two multi-line ones,
    still render without clipping at the new position - see
    Verification).

## Open questions

None.

## Known issues

None outstanding.

## Next proposed step

None - this was a targeted, confirmed fix. Any future lesson text
meaningfully longer than what exists today should be re-checked against
the box's fixed 82px height (it currently fits every scene's text with
room to spare, but isn't dynamically sized to content).

## Verification

`npm run typecheck`: pass.
`npm run build`: pass.

**Real-gameplay Playwright verification** (Chromium, dev server):
side-by-side screenshots confirming the exact overlap before the fix
(lesson-closed vs lesson-open at the identical step, showing the old
box hiding each card's rank numeral and lower half), then the same
comparison after the fix (hand fan and rank numerals fully visible,
guide pointer unobstructed, lesson text fully readable at the new
position). Re-verified the real card tap still works end-to-end (select
the pointed-to card, confirm the play, phase advances). Re-verified
Scene 6's two lesson steps specifically (the longest lesson strings in
the tutorial) - both wrap cleanly within the unchanged box height, and
the delegate step's guide pointer (at the left seat) renders fully
unobstructed since it's nowhere near the relocated box. Console errors:
only the pre-existing sandbox-only `ERR_CERT_AUTHORITY_INVALID` (Google
Fonts) and the dev server's own missing-favicon 404, unchanged by this
fix.
