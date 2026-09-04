## Current milestone

Visual integration pass 1: centre-inlay reskin, play-area recess reskin,
and stone-and-gold control styling. Read the live GDD, the Game Production
Pipeline and Architecture doc, and (as required implementation input, per
the architecture doc's own Branch B workflow)
`Art Pipeline/Suits of Madness/Working/suits-mp-screen-reference.md`
fresh before touching code. Per that document's explicit authority rule,
this doc was **not** edited directly - ChatGPT/Codex is its sole editor;
proposed corrections are called out in their own section below, clearly
separated so they can be relayed to GPT afterward.

Confirmed directly from the screen-reference doc and the Export manifest
before starting: no new asset exists for the centre inlay's wells - only
`background_tabletop_stone.png` and the existing `deity_symbol_<god>.png`
files. The four wells are procedurally drawn (hex/circle shapes, glassy
gradient, coded), matching the same approach the play-area recesses
already used. No new asset need was found partway through; nothing was
substituted informally.

## Files/components changed

- `src/dom/overlay/GameOverlay.tsx` - centre inlay (turn-indicator wheel +
  Suit Cycle HUD), Menu/Set/Log button styling, local nameplate.
- `src/dom/overlay/GameOverlay.css` - stale comment referencing the
  removed outer-sigil-ring fixed (the shared `somCreep` keyframe itself is
  still used by `dom/lobby/LobbyFlow.tsx` and is untouched).
- `src/ui/renderGameView.ts` - `drawPlayAreaRecess()` restyled.
- `tune.json` - removed `outerSigilRingSpinMs` (see below).

## Each screen-reference element addressed

- **"Center inlay... the single biggest visual gap versus the approved
  preview"**: addressed. The legacy glowing-ring/floating-badge treatment
  (three nested colored-border circles + an animated spinning "outer
  sigil ring" with four 45°-rotated diamond marks) is replaced with one
  round carved-stone bezel (turn wheel) housing a round carved-stone
  inlay (Suit Cycle HUD), both styled via inset box-shadows and dark
  radial gradients instead of glowing borders - no diagonal
  stripes/diamonds, no colored UI-outline rings. The four badges became
  enlarged (26px → 42px), tightly-grouped "glassy well" shapes (hex for
  Chaos, circle for Cosmos - unchanged mapping, still per-god via
  `GOD_MOTIF`), each with a soft top-left highlight fading into a dark,
  faintly team-tinted floor. The center hub is a small plain stone recess
  - still no symbol, still no text label.
  - **The exact rotation/highlighting logic the doc flagged as "real
    interactive logic, not decoration" is untouched**: `useForwardRotation`,
    `useLastKnown`, the `starterIndex`/`suitIndex`/`turnSeatIndex`
    computation, and every `useState`/`useEffect` above the JSX are
    byte-for-byte the same as before this pass. Only the JSX/style values
    consuming `turnDeg`/`suitDeg`/`markerSeat` changed - sizes, colors,
    gradients, shapes - never which state drives which transform. The
    per-well counter-rotation (`rotate(${-suitDeg}deg)` on each symbol's
    own wrapper) is preserved exactly, just resized to match the larger
    wells (30px inner icon, up from 18px, same ~0.7 ratio).
  - `MARKER_OFFSET`'s four `{dx, dy}` values now equal a single
    `WELL_OFFSET` constant (30) instead of a hardcoded 46, since the
    lead-marker must track the wells' new (closer-to-center) positions -
    this is a size/position constant change, not a logic change; the
    marker still highlights whichever well sits at `markerSeat` via the
    same `translate()` technique.
- **Required Suit banner "deliberately NOT duplicated inside the center
  inlay"**: unchanged - still the only place the required suit is named,
  still not repeated in the inlay (confirmed by inspection; nothing in
  this pass added a symbol/text to the inlay's center hub).
- **Board background / play-area recesses ("procedurally-drawn... no
  recess art asset exists")**: addressed. `drawPlayAreaRecess()` (Phaser
  Graphics, canvas layer, untouched card slot/position/hit-target math)
  now draws a soft outer shadow, a top-darker/bottom-lighter gradient
  floor (`fillGradientStyle`), and a faint warm rim in the stone-and-gold
  palette - replacing the old flat black semi-transparent rect with a
  black stroke, which read as a UI panel rather than a sunken hollow in
  the stone.
- **Bottom row (Set/Log) + Menu button, "square controls matching the
  Play Card button's carved black-and-gold family"**: addressed, but not
  via `ui_action_slab.png` as originally attempted in the prior pass -
  see the discrepancy note below. All three now use a procedural dark
  inset-stone gradient with a clean gold border instead.
- **Player cluster name tags, "no real player-nickname data... 'Player
  N' is the only label that exists"**: unchanged - `seatLabels` is still
  the only source, no hardcoded names were added anywhere.
- **Hand fan interaction rules (selected-card lift, no "Selected" label,
  neutral illegal dimming, no LOCKED text/stripes)**: unchanged - none of
  `ui/cardComponent.ts`, `ui/handLegality.ts`, or the fan's own tap/z-order
  code in `ui/renderGameView.ts` were touched this pass.
- **Deity Card Dormant/Powered behavior, card compositing, Deity/rank
  semantics**: unchanged - `ui/cardArt.ts` was not touched.

## Runtime behavior explicitly preserved (verified, not just claimed)

Verified live against a running single-player-vs-bots game
(`npm run preview`, Playwright, portrait viewport):

- **Card selection**: tapped a legal hand card (found by probing several
  fan x-positions since trick 1's forced-opener legality only allows one
  specific card) - card entered the `selected` visual state and the
  action button enabled with the correct "Play Card / Follow \<suit\>"
  label.
- **Playing a card**: clicked the action button with a card selected -
  the turn phase advanced (`Play Card` → `Redistribute`), the required-
  suit banner and hand fan updated, "Waiting for Player N..." appeared -
  confirming the play actually committed through the host, not just a
  local visual change.
- **Sorting**: clicked the Set button - no error, hand fan re-rendered
  (toggled suit/rank order); clicked again to toggle back.
- **Opening Menu**: clicked the Menu button - `MenuModal` opened cleanly
  (no double-stack regression from the prior pass's bug).
- **Opening Rules from Menu**: clicked "The Rites" inside the open Menu -
  Rules opened with Menu correctly closed underneath (re-confirms the fix
  from the previous pass still holds after this pass's centre-inlay/
  button changes).
- **Opening the Redistribution Log**: clicked the Log button - "The
  Ledger" opened ("No tricks resolved yet." while trick 1 was still in
  progress).
- **Delegate-selection color cue**: *not* exercised live this pass (would
  need a Double-win to reach `selectDelegate` phase, not reliably
  reachable from bot-random play in the time available) - verified by
  inspection instead: the non-local seat-tag JSX block (the
  `delegate.staged` teal/gold gradient logic) was not touched by any edit
  in this pass; only the local "You" tag's own background line changed,
  and the local seat is never a delegate target. Flagged here rather than
  silently assumed.
- Browser console clean through the entire sequence above (aside from
  the known pre-existing Google Fonts sandbox-network failure and the
  same intermittent, previously-established-as-unrelated 404 seen in
  every prior task's checks).
- `npm run typecheck` and `npm run build` (repo root) - both clean.

## Asset filenames used

Only real, already-fetched R2 assets, per the Export manifest - no new
asset requests:

- `background_tabletop_stone.png` - unchanged use (already wired in the
  prior pass).
- `deity_symbol_cthulhu.png` / `deity_symbol_nyarlathotep.png` /
  `deity_symbol_shub_niggurath.png` / `deity_symbol_yog_sothoth.png` -
  now shown larger inside the reskinned wells (same images, same
  per-god/per-motif mapping as before).
- `ui_player_nameplate.png` - newly applied, to the local "You" tag only
  (see below).
- No use of `ui_action_slab.png` in this pass - see discrepancy below.

## Remaining visual discrepancies or ambiguity

- **`ui_action_slab.png` still isn't used anywhere.** The Export
  manifest describes it as the "carved black-and-gold primary action and
  square utility-button frame family," and the prior pass tried using it
  as the Menu/Set/Log background - but that asset is a wide bar (its real
  dimensions are roughly 1065×220, a ~4.8:1 aspect ratio, confirmed by
  inspecting the fetched file), and stretching it into a 52×52 square via
  CSS `background-size: 100% 100%` distorted it into a flat, washed-out
  gold box rather than a carved control (this is what the task's "no
  yellow box" instruction was describing). This pass replaces that with
  procedural styling for the three square buttons instead, per the same
  "no dedicated asset exists, draw it in code" principle already
  established for the wells/recesses. The Play Card action button (wide,
  ~154×56, a much closer aspect match to the real asset) still uses its
  own inline gradients too, unrelated to this pass - it was out of this
  pass's explicit scope (only Menu/Set/Log were named) and wasn't
  touched. Whether `ui_action_slab.png` should be wired into the Action
  button specifically (where its aspect ratio would actually fit) is an
  open question for a future pass, not resolved here.
- **`ui_player_nameplate.png` applied to the local tag only, not the
  other three seat tags** - per the task's own explicit instruction to
  use judgment and report rather than guess a compromise. The three
  non-local seat tags carry real delegate-selection state (a teal vs.
  gold gradient distinguishing `staged`/not-`staged`) that a naive image
  swap would still risk flattening, same concern as when this was first
  deferred. The local tag has no such state (you can't delegate to
  yourself) so it was safe to apply there. A tinted overlay
  (`rgba(20,16,8,0.15)` → `rgba(4,4,3,0.3)`, adjusted down from an
  initial too-opaque pass once screenshotted) sits over the real art so
  "Player 1 (You)" stays legible against its texture.
- Delegate-selection live verification not exercised this pass (see
  above) - preserved by inspection, not by a live Double-win test.
- The centre inlay's exact proportions (42px wells, 30px center offset,
  150px inlay, 168px outer bezel) were chosen to visually match the
  approved preview's "tightly grouped" look by eye, not measured against
  a pixel spec - no such spec exists for this element's internal
  geometry in any of the read documents.

## Proposed updates to suits-mp-screen-reference.md

**(Separated here specifically for relay to GPT/Codex, the document's
sole editor - everything above is for the user; this section is the
handoff.)**

1. **Center inlay section** - the "single biggest visual gap versus the
   approved preview" framing is now stale. The rotating-ring/floating-
   badge visual is gone; the centre inlay is now a round carved-stone
   bezel + inlay with four enlarged glassy hex/circle wells, matching the
   preview's direction. The *rotation/highlighting logic* this section
   correctly flagged as real (not decorative) is unchanged and still
   accurately described - only the "what's actually live" visual
   description needs updating. Affected code: `src/dom/overlay/
   GameOverlay.tsx`'s `turn-indicator-wheel` and `suit-cycle-hud` blocks;
   state relationships (`turnDeg`/`suitDeg`/`markerSeat`/`WELL_OFFSET`/
   `MARKER_OFFSET`) are unchanged from what the doc already describes.
2. **Board background section** - the play-area recesses are still
   procedurally drawn (no new asset), but the doc's own note that a
   dedicated recess texture "would be new work" remains accurate; only
   the recess's current visual treatment (was flat black, is now a
   gradient-shaded sunken hollow) changed. Affected code:
   `src/ui/renderGameView.ts`'s `drawPlayAreaRecess()`.
3. **Bottom row section** - should note that Menu/Set/Log use procedural
   stone-and-gold styling, not `ui_action_slab.png`, because that asset's
   real aspect ratio (~4.8:1, a wide bar) doesn't fit a square button
   without visible distortion. If a genuinely square carved-stone button
   asset is produced later, it could replace this procedural styling
   directly (same DOM structure, just swap the `background` value).
4. **New note worth adding**: `ui_player_nameplate.png` is now applied,
   but only to the local player's own seat tag - the doc's existing
   "known deliberate gap" entry for this asset should be updated to say
   *partially* applied, with the reason (delegate-staged color state on
   the other three tags) rather than "never applied."
5. **New note worth adding**: `tune.json`'s `outerSigilRingSpinMs` was
   removed (its only consumer, the old outer sigil ring, no longer
   exists) - if the screen-reference doc or any other doc lists tune keys
   anywhere, this one should come off that list.

## Key technical decisions

- **Every centre-inlay edit was a style-value change on an unmodified JSX
  skeleton** wherever possible (same divs, same `data-bind`/`data-ui`
  attributes, same conditional structure) specifically so the diff stays
  auditable against "did any logic change" - a reviewer (or GPT, reading
  the handoff above) can see the rotation math is identical by checking
  that no `useState`/`useEffect`/index-computation line changed.
- **Procedural over informal-asset-substitution for the square buttons.**
  The task was explicit that stopping to report beats improvising when a
  needed asset doesn't exist; misusing `ui_action_slab.png` at the wrong
  aspect ratio was exactly the kind of informal substitution to avoid,
  so it was replaced with the same procedural approach already
  established (and explicitly sanctioned) for the wells and recesses,
  rather than left as a visible defect or worked around with a hack.

## Open questions

- Should `ui_action_slab.png` be wired into the Play Card action button
  (where its aspect ratio fits), now that Menu/Set/Log no longer use it?
  Not resolved here - out of this pass's scope.
- Should a square carved-stone button asset be commissioned for Menu/
  Set/Log specifically, or is the procedural treatment good enough long
  -term? A product/art-direction decision, not resolved here.

## Known issues

Carried over, untouched by this pass: `advanceBlocker()`'s premature
`checkSuitCompletion()` call; the facedown-card masking leak in
`host/mask.ts`; Rules-modal content gaps (no Setup section, off-suit
hidden-identity nature unstated); the other three seat tags still don't
use `ui_player_nameplate.png` (see above, deliberate).

## Next proposed step

Relay the "Proposed updates to suits-mp-screen-reference.md" section
above to GPT/Codex so the screen-reference doc gets reconciled. Separately,
decide (product/art call, not code) whether `ui_action_slab.png` moves to
the Action button and whether the other three seat tags ever get a
nameplate treatment that preserves the delegate-staged cue (e.g. tinting
the art per-state rather than swapping backgrounds outright).
