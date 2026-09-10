## Current milestone

Re-verified a previously-fixed glow bug (found it genuinely still fixed -
likely a stale screenshot on the user's end), implemented the revised
Section 5 spec for the local nameplate's Team compartment (a real
two-row layout, replacing the immediately prior task's "match the
Center HUD" sizing entirely), deleted the contextual hint panel outright
(DOM/canvas element and all its supporting code, not hidden), and
re-verified the full vertical layout stack now that the hint panel's
space is freed - found genuinely clear, no further trade-off to escalate.

## What was implemented

### Part 1: Local nameplate glow - re-verified, still genuinely fixed

Re-checked `[data-ui="local-nameplate"]`'s live `getComputedStyle()`
directly rather than assuming the prior fix still held or guessing at a
new cause: `boxShadow: "none"`, `filter: "none"`, no `outline`/`border`,
and a fresh full-page + element screenshot shows no shadow-like artifact
anywhere on or around the plate. Grepped the whole file for every
"shadow"-related CSS property - the only matches are unrelated
`textShadow` glows on small text elements (the sigil "✦" and the "YOU"
overlay), nothing on the nameplate `<div>` itself or any ancestor.

**Conclusion reported plainly, not re-fixed**: nothing in the current
code could produce a shadow artifact on this element. The user's fresh
screenshot showing one again is almost certainly a stale/cached image on
their end (the fix from the immediately prior task - deleting the
`boxShadow` declaration outright - is still in place and unchanged). No
code change was made for this part.

### Part 2: Team compartment - revised Section 5 two-row layout

Implements the brief's revision, which explicitly **supersedes** the
immediately prior task's "match the Center HUD's own 56.27x56.27 symbol
size" result - reverted back down to a smaller, explicit target instead:

- **Nameplate footprint**: width unchanged (260px, matches the asset's
  own compartment proportions). Height re-measured fresh before
  calculating (confirmed 89.265625px live, matching the prior task's own
  claim) and increased ~20%: **89.27 -> 107px** (`tune.
  localNameplateHeight`, new key).
- **Right compartment**: real two-row flex column (`flexDirection:
  'column'`), replacing the old single-row "symbols + trailing labels"
  layout entirely.
  - **Top row**: runtime "TEAM CHAOS" / "TEAM COSMOS" text, **11px**
    (`tune.localTeamHeaderFontSize`, new key - within the 10-12px
    target).
  - **Bottom row**: the two canonical `deity_symbol_*.png` masters as a
    pair, each in a **40x40px** container (`tune.localTeamSymbolSize`,
    changed from the prior task's 56.27 back down to 40 - the task
    explicitly named this as an existing key to *change*, not
    duplicate), **11px gap** between them (`tune.localTeamSymbolGap`,
    new key - within the 10-12px target).
  - Re-measured all four `deity_symbol_*.png` masters' real alpha bounds
    (Python/PIL `getbbox()`, all 1024x1024 canvases) to confirm a single
    shared container size works for both god-fill-fraction groups
    without per-god branching: Cthulhu/Nyarlathotep fill_h=0.6807,
    ShubNiggurath/YogSothoth fill_h=fill_w=0.6738 - the limiting
    (largest) fraction, 0.681 (already established for the Center HUD's
    own recess symbols), gives a **~27.24px visible backplate** at a
    40px container - solidly inside the 26-28px target for every god.
- **Centering**: each symbol is centered via `objectFit: 'contain'`
  inside a square container matching its own master's square canvas -
  since content-fill is centered within each master's own canvas (bbox
  measurement confirmed this for all four), this centers each visible
  symbol on its own true alpha bounds automatically, so Chaos hexagons
  and Cosmos circles read as equally prominent without any per-motif
  offset math.
- **"YOU" overlay**: an absolutely-positioned `<span data-ui="you-
  overlay">` along the *lower edge* of the local player's own symbol
  specifically - not a third row, and not present on the teammate's
  symbol. Identified "which chip is local" via `chip === yourGodChip`
  reference equality (an even earlier iteration of this code used the
  same pattern, per its own historical comments) rather than a data
  field, since `yourGodChip` is always the literal first element of the
  `[yourGodChip, teammateGodChip]` array being mapped. Positioned via a
  new `TEAM_SYMBOL_EDGE_INSET` constant (`(tune.localTeamSymbolSize *
  (1 - 0.681)) / 2` = `6.38px` at the current 40px size) combined with
  `transform: translate(-50%, 50%)`, landing the label's own vertical
  center exactly on the visible backplate's lower rim rather than the
  padded square container's edge.
- **No "KIN" label**: confirmed still absent from the teammate's symbol
  (`teammateGodChip: { ..., label: '' }` - unchanged from the prior
  task's own removal). No code change needed here, just confirmed.
- **Positioning basis**: everything in the right compartment is laid out
  via this flex box's own runtime bounds (flex column + flex row, `gap`,
  `alignItems`/`justifyContent: center`), not old absolute coordinates -
  so it re-centers correctly regardless of the compartment's actual
  rendered width.

### Part 3: Contextual hint panel - deleted entirely

Removed the whole `[data-ui="required-suit-banner"]` `<div>` (icon,
"Suit" label, and suit-name/"Any Suit" text spans) from `GameOverlay.
tsx`, not hidden or zero-sized. Also removed its now-dead supporting
code across four files:

- `GameOverlay.tsx`: the JSX block itself, the `REQUIRED_SUIT_BANNER_
  TOP` constant, the `requiredSuitGod` prop (interface field +
  destructured parameter), and the now-unused `GOD_DISPLAY_NAME` import
  (confirmed via grep it had exactly one other use, inside the deleted
  block).
- `ui/renderGameView.ts`: the `requiredSuitGod` field from both
  `GameOverlayHudState` and the object passed to `showGameOverlay(...)`,
  and its computation inside `computeGameOverlayHudState` - leaving
  `state.requiredSuit` itself (the real `MaskedState` field, used
  elsewhere for hand-legality logic) completely untouched, since only
  the HUD-specific derived/passed-through copy was ever for this panel.
  The now-unused `God` type import was also removed.
- `dom/overlay/gameOverlayStore.ts`: the `requiredSuitGod` field and its
  default value.
- `dom/DomRoot.tsx`: the `requiredSuitGod={...}` prop pass-through.
- `tune.json`: `contextualHintWidth`/`contextualHintHeight` deleted.
- Updated three stale comments that referenced the removed panel by name
  (`GameOverlay.tsx`'s `BOTTOM_ROW_BOTTOM` comment, `ui/renderGameView.
  ts`'s `FAN_BASELINE_Y` comment and its `TABLETOP_SIGIL_ANCHOR`
  comment) so they no longer describe a UI element that no longer
  exists.

**Flagging per the task's own instruction**: Section 6 of the 2026-09-10
live-asset-layout-corrections brief (unchanged, still in the doc) framed
this panel as reusable scaffolding for "future tutorial/gameplay hints
later." That framing is now moot - the actual region/component is gone,
not just repurposed. If a future task wants a similar contextual-hint
surface, it will need to be rebuilt from scratch rather than restyled
from what existed here.

### Part 4: Full vertical stack - re-verified, no conflict found

With the hint panel gone and the local nameplate now taller, re-checked
the real stack (local nameplate -> hand fan -> bottom controls) at the
390px reference viewport, via real (unforced) Single Player gameplay
plus one real user interaction (clicking a hand card to trigger the
worst-case popped-out/selected state):

- **Local nameplate bottom edge**: `y:501 + h:107 = 608` (up from the
  old `590.27`).
- **Resting hand fan**: real screenshot shows a clean, generous gap
  between the nameplate's new bottom edge and the top of the fan - no
  dead space left behind by the deleted hint panel, but no cramping
  either.
- **Worst case checked, not assumed**: clicked a real hand card to
  trigger the popped-out/selected state (larger card, shifted up by
  `tune.handFanPopOutDistance`) - the exact scenario most likely to
  collide with the taller nameplate above. Real screenshot confirms
  comfortable clearance, no overlap.
- **Bottom edge**: the enlarged "Play Card" action button (`266x117`,
  appears once a card is selected) still sits at its existing `y:711`
  with the fan's own bottom edge clearing it the same way it did before
  this task.
- **Conclusion**: `FAN_BASELINE_Y` (674) and `BOTTOM_ROW_BOTTOM` (16)
  both needed **no adjustment**. Removing the hint panel freed exactly
  the room the taller nameplate now uses, without requiring the fan or
  bottom row to move - this fully resolves the immediately prior task's
  "the button/fan space budget is now fully spent" open question; no
  trade-off to escalate.

## Key technical decisions

- Investigated Part 1 by checking live computed state first, per the
  task's own explicit instruction, rather than re-diagnosing a new cause
  for an already-solved problem - avoided inventing a fix for a bug that
  isn't actually present.
- Reused the alpha-bounds/content-fill methodology and the 0.681 limiting
  fraction already established for the Center HUD's own recess symbols,
  rather than re-deriving a separate approach for the Team compartment -
  the two now share the same sizing math even though they're tuned to
  different target sizes.
- Changed `localTeamSymbolSize`'s *value* (56.27 -> 40) instead of adding
  a second, parallel tune key for "Team symbol size" - per the task's
  explicit "reuse/adjust the existing key" instruction - while still
  adding genuinely new keys (`localNameplateHeight`,
  `localTeamHeaderFontSize`, `localTeamSymbolGap`) for values that had
  no tune key at all before (previously hardcoded inline).
- Identified the local chip via `chip === yourGodChip` reference
  equality rather than adding a new boolean field to `GodChipState` -
  the array being mapped is always literally `[yourGodChip,
  teammateGodChip]`, so this is a correct and minimal way to know which
  rendered chip is "mine" without widening the shared state shape.
- Verified Part 4's "no conflict" conclusion via a real user interaction
  (an actual Playwright click selecting a hand card), not just the
  resting-state screenshot - the popped-out/selected state is strictly
  the tallest the fan ever gets, so it's the correct worst case to check
  against the now-taller nameplate above.

## Open questions

None raised to the user this task - Section 5's revision, the hint-panel
deletion, and the vertical-stack re-check were all specified precisely
enough in the task brief/message to implement and verify without needing
a mid-task decision.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps; the
`'partner'` hand-fan state still has no working visual differentiation
from `'legal'`; the itch.io iframe canvas-scale fix, the asset
pipeline's downscale/recompress output, the Center HUD easing curve, the
trick-result dwell hold, the card-play arc animation, the Awakened
reveal, and the end-of-trick collect animation all still want a real-
device/live-deploy glance. suits-mp still has no permanent
`?debug=1`-gated `ForcedDeal` hook (unlike the sibling `suits`
prototype's `rules/debugScenarios.ts`).

**Section 6 of the live-asset-layout-corrections brief is now stale**:
it still describes building the contextual hint panel as reusable
scaffolding, but Part 3 of this task deleted that panel and all its
code outright. A future task revisiting `BRIEF.md`/that doc should
reconcile this rather than assume the scaffolding still exists.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the standing next open loop - none of today's changes
add to that list, and Part 4 confirms the vertical-layout budget that
was flagged as "fully spent" two tasks ago is now comfortably resolved
at the reference 390px viewport. Still worth a real-phone glance
eventually (same caveat as before: reference-viewport measurements can
read slightly differently at real mobile pixel density), but no longer
urgent given the freed margin.
