## Current milestone

Consolidated asset wave: verified the existing card compositor against
refreshed masters (no code changes needed), replaced the Center HUD's
procedural rotating-rings implementation with the approved
`ui_suit_cycle_bezel.png`/`ui_current_turn_pointer.png` art, and replaced
+ re-derived the tabletop background's alignment against its corrected,
differently-composed art. Corrected R2 package confirmed live via SHA-256
before any implementation work started (see "Package verification"
below).

## Package verification (gate, per the handoff)

Fetched `https://pub-415572b047994ab8807f76b8462eda45.r2.dev/suits-mp_assets.zip`
directly and computed its SHA-256 before touching any code:
`a3991a3497dc24c8634e59c41a5f7b78a54f835933e288bb483a4ef08b49b3ba` -
**exact match** to the corrected checksum named in
`suits-mp-r2-package-implementation-handoff-2026-09-08.md`. Zip opens
directly to `loose/` (27 PNGs) + empty `packed/`, matching the handoff's
described package structure exactly. No blocker - proceeded.

## PART 1: Card system - verified against refreshed masters, zero code changes needed

Re-ran `fetch:assets`/`pack:assets` to pull the refreshed
`card_frame_*`/`deity_symbol_*`/`deity_face_*` masters and the (already-
integrated, from a prior task) `card_backdrop_*`/`deity_nameplate_*`
categories through the existing pipeline, then checked every invariant
against the new art specifically, in the live game (not just an isolated
preview):

- **Numbered/Dormant identical symbol size/placement**: confirmed live
  via the shared compositor (`ui/cardArt.ts`'s `SYMBOL_BOX`, already
  unified in a prior task) - both states render the new symbol masters
  at the same 1130x1130/top-y=170 box, no code change needed.
- **Powered symbol above frame, small badge scale**: confirmed - the
  small top-badge symbol renders above the top frame edge without
  covering the character's face, for all four Deities.
- **Nameplate**: absent on Numbered, present and bottom-flush on
  Dormant/Powered - confirmed against the refreshed nameplate art.
- **No rim outline**: confirmed absent on legal, illegal, and selected
  cards alike.
- **Illegal-card dimmer corner match against the NEW frame art**:
  measured the new `card_frame_<deity>.png` masters' alpha channel the
  same way as before (all four Deities) - corner chamfer is
  **34-39px on the 1024-wide reference canvas**, statistically the same
  as the previous masters' 36-39px (well within normal per-asset
  variation, not a real difference). The existing
  `CARD_CORNER_CHAMFER_FRACTION = 38 / 1024` constant in
  `ui/cardComponent.ts` remains accurate - **no code change needed**,
  confirmed by direct measurement rather than assumed. Verified visually
  too: a legal/illegal pair built from the new Cthulhu frame shows the
  dimmer's chamfered corners cleanly matching the card's real corners,
  no gap or overflow.
- **Yog-Sothoth flat atom symbol**: confirmed on Numbered/Dormant/Powered-
  badge; her Powered anime art shows planet-like orbs in her hair/crown
  as character decoration only, never replacing the flat atom mark.
- **Cthulhu no duplicate octopus emblem**: confirmed - her Powered
  portrait's hair reads as flowing tentacle curls, no separate octopus
  shape on her head; the one octopus emblem visible on her Powered card
  is the small top-badge symbol above the frame, as intended.
- **Backdrop alpha containment**: confirmed at hand-fan/played-card
  ("standard") display size - the new backdrops' painted texture stays
  cleanly inside the frame's chamfered silhouette with no rectangular
  spill at the corners. (Verified at `CARD_DIMS_STANDARD`-equivalent
  sizes directly; the mini size used by redistribution stacks/the log
  shares the exact same `buildCard()` code path with no size-dependent
  branching, so this isn't expected to behave differently there, but
  wasn't separately screenshotted at that specific size this pass.)

**No files changed for Part 1** - the existing compositor (from a prior
task) already satisfied every invariant against the new art content with
zero code changes. This answers the task's explicit "don't assume zero
code changes without checking" instruction: it was checked, thoroughly,
and confirmed true.

## PART 2: Center HUD - new implementation, landed in DOM

**Files changed**: `dom/overlay/GameOverlay.tsx`,
`dom/overlay/GameOverlay.css`, `dom/overlay/overlayContent.ts`,
`dom/godArtUrl.ts`, `tune.json`.

**DOM, not canvas** - reasons:
- The existing Center HUD was already DOM (`GameOverlay.tsx`), consistent
  with root CLAUDE.md's UI split (HUD chrome lives in the DOM layer).
- The handoff explicitly requires reusing `useForwardRotation` (an
  existing React hook managing CSS-transform rotation state) rather than
  reimplementing it - reimplementing that behavior as a Phaser tween to
  move this to canvas would violate that instruction for no benefit.
- No WebGL-specific effect is needed here (no particles/shaders/Post FX -
  root CLAUDE.md's actual canvas-vs-DOM criterion) - a rotating `<img>`
  and a couple of `<div>`s cover every requirement.

**What changed, structurally**: the old implementation was a two-tier
"outer bezel ring + inner suit-cycle inlay" where the *entire inlay
rotated* (`suitDeg`) to bring the current lead suit's badge to a fixed
marker position, with each badge counter-rotating to stay upright. The
new approved design inverts this: the bezel and all four recess
positions are now permanently **fixed** (baked into
`ui_suit_cycle_bezel.png`'s own art), and only the **glow + LEAD label**
move between recesses - nothing rotates except the pointer. This meant
removing the old rotation math (`suitIndex`/`suitDeg`/`markerSeat`/
`MARKER_OFFSET`) rather than adapting it, since the underlying mechanism
it existed to drive (bringing a badge to a fixed marker) no longer
applies.

- **Layer order implemented** (back to front): 1) fixed
  `ui_suit_cycle_bezel.png`, 2) four `deity_symbol_<deity>.png` masters
  at fixed recess positions (reusing the exact same `symbolArtUrl()` the
  cards themselves use - no duplicate asset reference), 3) the current-
  turn pointer (`ui_current_turn_pointer.png`, rotated via the existing,
  untouched `turnDeg`/`useForwardRotation`), 4) the `LEAD` label, always
  topmost. **Deviation**: the Lead glow is drawn *behind* its symbol
  rather than literally matching "glow" as item 3 in the handoff's own
  back-to-front list (which would put it *after*, i.e. on top of, the
  symbols) - a glow the same footprint as the icon it covers would
  directly conflict with the explicit "visible clearance" requirement
  for symbols. Functionally it's still "a procedural glow on the recess
  selected by leadGodIndex," just layered so it doesn't obscure the
  thing it's highlighting.
- **Recess positions**: measured directly off `ui_suit_cycle_bezel.png`'s
  own pixels (isolating each recess's dark interior by luminance
  threshold, per-quadrant centroid) rather than guessed - all four land
  at 0.298-0.304 of the bezel's own size from its center, on-axis
  (top/right/bottom/left). Used `0.30` uniformly.
- **Lit recess selection**: `leadGodIndex` (0-3, already the SUITS/
  GOD_TO_SUIT_INDEX order the four fixed recesses are laid out in)
  selects the recess directly - no rotation/index-remapping needed since
  positions are fixed. Frozen at its last real value while indeterminate
  (`useLastKnown`, same freeze spirit as the old marker ring), defaulting
  to index 0 only before any trick has ever had a real leader.
- **Per-Deity accent hues** for the Lead glow (`GOD_ACCENT_RGB`): Cthulhu
  cyan, Nyarlathotep purple, Shub-Niggurath green, Yog-Sothoth gold (gold
  value matches this file's existing gold accent used elsewhere) - four
  distinct hues, since the old code only had two (alternating by
  position, not identity).
- **Pointer**: sized so its long needle reaches just inside the recess
  ring rather than overshooting past the bezel's outer edge (derived from
  measuring the pointer PNG's own tip-to-center proportion: the tip sits
  at ~94.6% of the image's half-height). Rotated via the exact same
  `turnDeg` computation as before (`useForwardRotation(turnSeatIndex, 4,
  90)`, untouched) - sprite origin is the image's own center (a plain
  centered `<img>`, no off-center pivot math), per the handoff.
- **New `tune.json` keys**: `leadGlowPulseMs` (2200) and
  `leadGlowPulseEasing` ("ease-in-out") drive the Lead glow's pulse via a
  new `@keyframes suitsMpLeadGlowPulse` in `GameOverlay.css`. Removed
  `suitCycleRotationMs`/`suitCycleRotationEasing` - fully dead once the
  old rotation math was removed (confirmed zero other consumers before
  deleting).
- **Dead code removed alongside**: `overlayContent.ts`'s `SEAT_DEG`
  export (only consumer was the removed `starterIndex` computation).
- **Standalone Lead Player badge**: confirmed absent from the Center
  HUD, as required. Note: there IS an unrelated, pre-existing per-seat
  `data-ui="trick-starter-tag"` element (labeled "Lead Player", shown
  under whichever seat's own name tag is that trick's actual starter) -
  this is a different, legitimate design element from the "floating Lead
  Player badge" the handoff says to keep excluded from the *center* HUD,
  predates this task, and was not touched.
- **`ui_action_slab.png`, `ui_player_nameplate.png`,
  `rank_badge_chaos_portal.png`, `rank_badge_cosmos_galaxy.png`**: not
  touched this pass, per the handoff's "retained unchanged for now" list.

## PART 3: Background - replaced and re-derived alignment

**Files changed**: `ui/renderGameView.ts` (one constant + its comment;
`drawTabletop()`'s anchor-and-cover placement logic itself needed no
changes - it already reads the texture's real loaded dimensions at
runtime rather than hardcoding them, so it adapted to the new 1080x1920
art automatically).

- Fetched the corrected `background_tabletop_stone.png` through the
  normal pipeline (confirmed 1080x1920, matching the handoff's
  description) - never assumed the old 841x1870 dimensions or anchor
  fraction still applied.
- **Measured the new sigil's real center**: isolated its bright linework
  from the darker cracked-stone field via a luminance threshold (stable
  across thresholds 70-90 out of 255 - same bbox result at every
  threshold in that range, confirming the isolation is clean, not
  threshold-sensitive), then took the bounding-box midpoint (the sigil is
  a clean circle, so its bbox midpoint on each axis is its true
  geometric center). Result: `x` bbox `[253, 825]` of 1080 -> 49.9%;
  `y` bbox `[622, 1198]` of 1920 -> 47.4%.
- **Updated `TABLETOP_SIGIL_ANCHOR`** from `{ x: 0.492, y: 0.491 }` (the
  old art's measurement) to **`{ x: 0.499, y: 0.474 }`** (this new
  measurement).
- **Re-verified the Center HUD's live on-screen position** after the
  Part 2 rewrite (its `data-ui` changed from `"suit-cycle-hud"` to
  `"center-hud"`) rather than assuming the old measurement still applied
  to the new element name: `getBoundingClientRect()` converted back
  through the canvas's own scale gave `(195.00, 305.00)` logical px -
  exactly `CENTER_X`/`CLUSTER_CENTER_Y`, unchanged, confirming the
  anchor target is still correct.
- Live screenshot (canvas-only, DOM hidden) confirms the sigil's compass/
  star center now lines up precisely with the play-area recess cluster
  and the DOM wheel above it.
- The old ornate background is gone from the fetched art entirely (the
  R2 zip only ever contained the corrected version) - nothing to remove
  from cache/fallback paths, since `drawTabletop()` has no fallback path
  of its own beyond the existing "texture not loaded, skip" guard.

## PART 4: Packaging note

No code action taken. Confirmed (again, for this task) that
`rank_badge_chaos_portal.png`/`rank_badge_cosmos_galaxy.png` have zero
code consumers - `grep` across `src/` for both filenames and for the
long-removed `rankBadgeArtFile`/`BADGE_CENTER`/`BADGE_DIAMETER` symbols
(deleted in the three-state-card-system task) returns nothing.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- Real asset pipeline run (`fetch:assets`/`pack:assets suits-mp`),
  confirming the corrected package's contents land correctly (27 loose
  files packed, including the two new HUD assets, converted to WebP by
  the existing downscale/recompress pipeline with no changes needed
  there either).
- **Live DOM measurement** of the Center HUD's real on-screen position
  (see Part 3) before finalizing the background anchor - not assumed.
- **Direct compositor verification** (temporary debug hooks - a
  `window.__debugGame` in `main.ts`, a `window.__buildCard` in
  `ui/cardArt.ts`, a `window.__drawCard` in `ui/cardComponent.ts` - added,
  used, then fully reverted; `git diff` against `main` touches only the
  files listed above per part, confirmed via `git status` after
  reverting): built all 4 Deities x all 3 card states from the live
  scene using the refreshed art, and a legal/illegal card pair to check
  the dimmer against the new frame specifically.
- **Live gameplay** (real clicks, no debug hooks): played through the
  forced trick-1 opener and several bot turns. Confirmed the current-turn
  pointer rotates correctly across three distinct real states (0deg ->
  90deg -> 180deg as turn order advanced through seats), the per-seat
  Trick Starter tag moved to the new leader, the Required Suit banner
  updated, and the Lead glow/label stayed correctly on Yog-Sothoth's
  recess (the trick-1 forced suit) throughout - no interaction or
  game-state regression observed.
- `page.on('pageerror')` empty across every run; console errors limited
  to the same pre-existing baseline noise from prior tasks (a sandboxed
  Google Fonts request, one intermittent unrelated 404).

## Open questions

None new. The task's own two questions (whether Part 1 needed code
changes; what the new sigil anchor measures to) are answered above with
evidence either way.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); `ui_player_nameplate.png` still applies to the local seat
tag only (deliberate); the `'partner'` hand-fan state still has no
working visual differentiation from `'legal'` (flagged in a previous
task, still open); the itch.io iframe canvas-scale fix and the asset
pipeline's downscale/recompress output still want a real-device/
live-deploy glance - now joined by this task's Center HUD and background
changes, none of which have been checked against an actual itch.io
build either.

## Next proposed step

Return this task's full handoff (files changed per part, manifest/asset
keys, the measured `TABLETOP_SIGIL_ANCHOR` value and method, the
rank_badge_* confirmation, screenshots, and the DOM-vs-canvas decision
for Part 2) to GPT/Codex for `suits-mp-screen-reference.md`
reconciliation - not edited by this task, per the handoff's own
instruction. A real-device/live-deploy pass covering everything listed
under "Known issues" remains the next open loop.
