## Current milestone

Fixed the stone tabletop background's alignment: its circular ritual-sigil
motif now lands exactly on the DOM-layer center wheel (the turn indicator
+ Suit Cycle HUD), instead of being centered on raw canvas dimensions
(which sit noticeably below where the wheel actually is).

## What was implemented

- **Diagnosis first, per the brief**: confirmed - via a live runtime
  inspection of a booted `HostGameScene` (a temporary debug hook, removed
  before finishing; `git diff` against `main` touches only
  `ui/renderGameView.ts`) - that `background_tabletop_stone` was already
  loading correctly (`scene.textures.exists()` true, correct 841x1870
  source dimensions, hash present in the manifest) and already being
  drawn as a real `Image` game object with correct size/visibility/alpha.
  A canvas-only screenshot (DOM overlay hidden) further confirmed the
  sigil was visibly rendering. **The texture was not actually broken.**
  Re-ran the real asset pipeline (`fetch:assets`/`pack:assets`) and a full
  production `npm run build` as an extra check - both correctly include
  and hash the file; the itch.io deploy workflow runs the identical two
  commands, so there's no reason to expect a different outcome there.
  See "Open questions" for the one caveat this doesn't rule out.
- **The real, measurable problem was alignment**: the old code drew the
  image at `(CENTER_X, HEIGHT / 2)` - literal canvas center - stretched to
  `WIDTH x HEIGHT`. The DOM wheel (`GameOverlay.tsx`'s
  `[data-ui="suit-cycle-hud"]`) is not at canvas center; it's pinned to
  `(CENTER_X, CLUSTER_CENTER_Y)` = `(195, 305)`, which sits well above
  vertical center (`HEIGHT / 2` = 422) because the canvas has more UI
  below its midpoint than above it (hand fan, Required Suit banner, seat
  bar). Measured this live rather than assuming the shared constant was
  still accurate: read `[data-ui="suit-cycle-hud"]`'s
  `getBoundingClientRect()`, converted back through the canvas's own
  bounding rect and CSS scale into canvas-logical coordinates, and got
  `(195.0, 305.0)` - an exact match, confirming `CENTER_X`/
  `CLUSTER_CENTER_Y` (already shared between `renderGameView.ts` and
  `GameOverlay.tsx`, per their own comments) are the right anchor target
  and haven't drifted from the DOM's real position. With the old code,
  the background's own circular motif rendered about 117px too low -
  visually landing in the hand-fan/bottom-bar area rather than the wheel,
  which very plausibly reads as "the background isn't doing anything
  noticeable" even though pixels were technically present.
- **`ui/renderGameView.ts`**: replaced the inline
  `setDisplaySize(WIDTH, HEIGHT)` stretch with a new `drawTabletop()`
  helper and a `TABLETOP_SIGIL_ANCHOR = { x: 0.492, y: 0.491 }` constant
  (the measured fact given for this task - not derivable from the image's
  raw pixels, so it's a named constant with a comment, not computed).
  `drawTabletop()`:
  - Reads the texture's actual loaded width/height at runtime
    (`scene.textures.get(key).getSourceImage()`) rather than hardcoding
    841x1870, so a same-named art replacement of a different size (art is
    overwritten in place, never versioned, per root CLAUDE.md) can't
    silently throw this alignment off again.
  - Computes one uniform scale (aspect ratio always preserved, never
    stretched per-axis) as the max of four "does this edge still cover
    the canvas from the anchor" ratios - the standard
    `background-size: cover` technique, generalized to an anchor point
    that isn't the image's own center.
  - Sets the image's origin to the anchor fraction and positions it
    directly at `(CENTER_X, CLUSTER_CENTER_Y)`, so Phaser handles the
    anchor-to-target alignment natively rather than hand-computing a
    top-left offset.
  - The result crops/letterboxes the image's edges as needed (confirmed
    the bottom-edge constraint dominates given the wheel's position, so
    the image's own top portion is the most cropped) rather than
    force-stretching, per the brief's explicit suggestion.

## Key technical decisions

- **Anchor-and-cover, not stretch-to-fit.** A flat `setDisplaySize(WIDTH,
  HEIGHT)` can only ever line up an image's center with one fixed point
  (canvas center) - it has no way to also honor a specific anchor
  fraction that isn't 50/50, and the wheel's real position isn't 50/50
  vertically. Anchoring by origin and computing a covering scale keeps the
  aspect ratio intact (no stretching) while guaranteeing both "the sigil
  lands exactly on the wheel" and "no background gaps at any canvas edge."
- **Read the DOM position live rather than trusting the shared constant
  by inspection alone** - the brief explicitly asked not to assume canvas
  center, and by extension not to assume any other constant is still in
  sync without checking; measuring confirmed it is, but that's a fact
  worth having evidence for rather than asserting from source comments.
- **Read texture dimensions at runtime, not hardcoded** - matches the
  established pattern from the three-state card compositor
  (`ui/cardArt.ts`'s `placeContain()`), which reads `image.frame`'s real
  dimensions for the same reason: art is unversioned and overwritten in
  place, so hardcoding today's pixel dimensions is a latent bug waiting
  for the next art refresh.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Pre-fix runtime diagnosis** (temporary debug hook, removed): confirmed
  `background_tabletop_stone` texture exists, loads at the correct native
  size, and is drawn as a visible, correctly-sized `Image` - i.e. the
  "is it actually rendering" question was answered definitively before
  touching any code, per the brief's explicit instruction not to just
  re-confirm the code path exists.
- **Live DOM measurement**: `[data-ui="suit-cycle-hud"]`'s
  `getBoundingClientRect()`, converted through the canvas's own scale back
  to logical coordinates, measured at `(195.00, 305.00)` - confirming the
  real on-screen wheel position used as this fix's target anchor.
- **Before/after screenshots**, canvas-only (DOM overlay hidden) and full
  composite: before the fix, the sigil's bright circular center sits
  visibly below the wheel/play-area cluster, down near the "Lead
  Player"/bottom-bar area; after, the sigil's concentric rings radiate
  outward from the exact same center as the DOM wheel, in both the
  canvas-only and full-composite views.
- `page.on('pageerror')` empty; console errors limited to the same
  pre-existing baseline noise from prior tasks (a sandboxed Google Fonts
  request, one intermittent unrelated 404).

## Open questions

None from `BRIEF.md`. One honest caveat on the "is it actually loading"
question: this was verified against the local dev server and a local
production `npm run build`, both of which correctly fetch, pack, and
serve the asset - matching exactly what the itch.io deploy workflow runs.
The actual live itch.io deployment itself was not re-checked (no access
to it from this environment) - if the reporter's original observation was
specific to that deployed build rather than local dev, this fix still
applies (it doesn't touch the loading path at all, only alignment), but
worth a live-deploy glance next time someone is there anyway.

## Known issues

- Carried over, untouched by this task: genuine gameplay verification of
  off-suit masking via real bot/human play is still pending; Rules-modal
  content gaps (no Setup section, off-suit hidden-identity nature unstated
  in the copy); the other three seat tags still don't use
  `ui_player_nameplate.png` (deliberate, from an earlier visual pass); the
  itch.io iframe canvas-scale fix and the asset-preload progress bar's
  `PlayerGameScene` path both still want a real-device/live-deploy
  re-check (see their own prior `BUILD_STATUS.md` entries, now superseded
  by this rewrite - the underlying carried-over facts are unchanged).

## Next proposed step

None specific to this task. The live-itch.io-deploy glance noted above
(covering this fix, the iframe canvas-scale fix, and the asset-preload
progress bar together) is the one open loop across recent suits-mp tasks
that only a real device/network can close.
