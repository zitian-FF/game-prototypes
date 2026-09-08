## Current milestone

Removed the thin rim outline drawn over every real card's finished art
(reported as unwanted "wireframe" clutter) and replaced illegal-card
signaling with a dedicated, correctly-shaped dimmer overlay instead of a
whole-container alpha fade.

## What was implemented

- **`ui/cardComponent.ts`**: `drawCard()`'s real-card (non-empty,
  non-facedown) branch no longer draws the `rim` rectangle/stroke at all.
  Confirmed before removing it that selected-card state doesn't depend on
  it: `renderGameView.ts`'s `renderCardFan()` already pops the selected
  card up and draws it last in a separate pass (see its own comment,
  "Item 3: selected card(s) pop out of the fan"), independent of any
  outline - verified this still works with no rim in the live game (see
  Verification).
- **`CardStyle` gains a `dimmed?: boolean` field**, deliberately separate
  from the existing `alpha` field - `alpha` still fades the whole
  container (used by facedown/empty/redistribution-stack styles exactly
  as before, untouched), while `dimmed` draws a new overlay on top of a
  real card's art. `renderGameView.ts`'s `handCardStyle()` sets
  `dimmed: cardState === 'illegal'` - the one caller of this style
  function, shared by both the play-phase legality state machine
  (`computeHandLegality`) and the redistribute-phase one
  (`redistributeCardState`), so both automatically get the new dimmer
  through the same `renderCardFan()` → `drawCard()` path. No other
  `CardStyle` caller (`playAreaStyle`, `logCardStyle`,
  `stackFilledStyle`/`stackNeededStyle`) has an "illegal" concept at all -
  once a card is played, legality is moot - so the hand fan is the only
  place this applies, confirmed by reading every `CardStyle`-producing
  function in the file.
- **New `drawIllegalDimmer()`** (`ui/cardComponent.ts`): a
  `Phaser.GameObjects.Graphics` shape, sized to exactly `dims.width x
  dims.height` (the same box every other card layer - backdrop, frame -
  is drawn into), filled with a flat neutral dark color
  (`0x000000` at `0.55` alpha - no color tint, no stripes, no text, per
  the already-approved hand fan spec in `suits-mp-screen-reference.md`:
  "illegal cards get a neutral dim (no LOCKED text/stripes)"). Its
  corners are chamfered via `fillPoints()`, not `fillRoundedRect()` - see
  "Key technical decisions" for why. Added once in the shared
  `drawCard()` compositor, not duplicated per caller.

## Key technical decisions

- **The card frame art's corners are NOT circular/rounded - they're
  straight 45deg chamfers, not a curve at any radius.** Measured directly
  off `card_frame_<deity>.png`'s alpha channel (all four Deities) rather
  than guessing: scanning inward from each edge near every corner shows a
  perfectly constant slope of exactly -1 (e.g. top-left: opaque pixels
  start at `(123, 18)` and reach the straight left edge at `(85, 56)` -
  `Δx = -38` over `Δy = 38`), which is the signature of a straight
  diagonal bevel, not an arc (an arc's slope changes continuously,
  flattening out near its tangent points - this doesn't). Consistent at
  ~37-39px on the shared 1024-wide reference canvas across all four
  Deities' frames, including the bottom-left corner (which also carries
  the baked-in rank-quadrant decoration at the same chamfer size).
  Per this task's own explicit instruction ("if the frame art doesn't
  actually have curved corners... report that rather than inventing
  curvature that doesn't match the real asset"): using
  `Graphics.fillRoundedRect()` with any radius would produce a soft
  circular curve visibly different from the card's actual sharp diagonal
  cut. Implemented the dimmer as a chamfered-corner octagon via
  `Graphics.fillPoints()` instead, using the measured ~3.7% of card width
  as the chamfer size (`CARD_CORNER_CHAMFER_FRACTION = 38 / 1024`) - this
  is a deviation from the letter of "use fillRoundedRect" but not from
  its actual goal ("the dimmer's silhouette matches the card's real
  shape"), which a rounded rect could not have delivered here.
- **`dimmed` kept separate from `alpha`, not layered onto it.** The task
  frames the old approach as "a flat `card.setAlpha(alpha)`... which
  fades unevenly depending on each card's own frame color" - in the
  actual current code, no caller ever set a non-1 `alpha` for illegal
  specifically (`handCardStyle()` never set `alpha` at all; the only
  illegal-specific values it computed, `fill`/`border`, fed the
  now-removed rim and a `fill` that was never used for real face-up cards
  in the first place - only facedown placeholders read `style.fill`).
  Worth stating plainly: illegal state had essentially no working visual
  signal on real card art before this task, not just an uneven one.
  Keeping `alpha` and `dimmed` as separate concerns means a future style
  that legitimately wants a translucent "ghost" card (via `alpha`) isn't
  tangled up with the illegal/legal distinction this task addresses.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Direct compositor verification** (temporary debug hooks - a
  `window.__debugGame` in `main.ts`, a `window.__drawCard` in
  `cardComponent.ts` - added, used, then fully reverted; `git diff`
  against `main` touches only `cardComponent.ts` and
  `renderGameView.ts`): built four cards side by side via the real
  `drawCard()` - legal, illegal, selected, partner - in the live booted
  scene. Confirmed no rim/outline on any of them, and the illegal card's
  dimmer overlay corners visually match the card frame's own chamfered
  corners with no gap or overflow.
- **Live gameplay screenshots** (real clicks, no debug hooks): required-
  suit situations came up naturally within the first few tricks and show
  off-suit cards clearly darkened (gold/teal cards dimmed against a
  purple-then-later-green required suit) while suit-matching cards stay
  full brightness, with zero rim/wireframe visible anywhere in the fan.
  Selecting a legal card shows it popped up and drawn above its
  neighbors, at the hand fan's enlarged pop-out scale, with no rim.
  Cross-checked one case by pixel-sampling a purple card's RGB average in
  a screenshot where it should be illegal (~21,9,27) against the same
  patch location in a screenshot where purple was the legal required
  suit (~45,22,57) - roughly half the brightness, consistent with the
  dimmer's 0.55 alpha black fill actually being applied, not just
  visually assumed from a compressed screenshot.
- `page.on('pageerror')` empty across every run; console errors limited
  to the same pre-existing baseline noise from prior tasks (a sandboxed
  Google Fonts request, one intermittent unrelated 404).

## Open questions

**Flagging per this task's explicit "stop and report rather than
shipping something unclear" instruction, not silently fixing or
ignoring it**: `computeHandLegality()`'s `'partner'` state (a same-rank
card highlighted as completing a Twin Awakening double once one card is
already selected) has **no working visual differentiation from
`'legal'` today, and this predates this task** - `handCardStyle()`
computed a different `fill` value per state, but `fill` was never read
for real face-up cards (only the removed rim's `border`, and
`border` was already identical for `'partner'` and `'legal'`:
`cardState === 'illegal' ? 0x2a2a30 : 0x55555f` treats every other state
the same). `colorFor()`/`textColor` (which does distinguish
`COLOR_PARTNER` cyan from `COLOR_LEGAL` white) is computed but was never
actually consumed by any card-drawing code. This task's scope was
specifically the rim and the illegal dimmer, not `'partner'` styling, so
nothing was changed here - but a player currently has no way to visually
tell a same-rank "partner" card apart from any other legal card in the
fan, only that tapping it behaves differently. Worth a follow-up task
(possibly: give `'partner'` its own dimmer-style overlay in an accent
tint, or a small badge) - `BRIEF.md` may need a line added if this
behavior is intentional and just needs a real visual treatment decided.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); the other three seat tags still don't use
`ui_player_nameplate.png` (deliberate, from an earlier visual pass); the
itch.io iframe canvas-scale fix, the asset-preload progress bar's
`PlayerGameScene` path, and the asset pipeline's downscale/recompress
output all still want a real-device/live-deploy glance.

## Next proposed step

Decide on a real visual treatment for `'partner'` state (see "Open
questions" above) - currently the only card-visual-state with no working
signal of its own.
