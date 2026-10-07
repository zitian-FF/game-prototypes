## Current milestone
Requested larger ring framing, centered training dummy and gym floor alignment ready for release.

## What was implemented
- Uniform authored-ring enlargement anchored to measured outer red rope centers (master y110 and y927). Top gap 3% below the 59px UI strip; bottom gap 5% above screen bottom. Values exposed in tune metadata.
- Training dummy starts at the exact simulation ring midpoint after initial entry, Reset and character changes.
- Gym floor inverse projection reduces baked column convergence to match the authored ring plane. Existing R2 artwork reused; title background unchanged.

## Key technical decisions
- Scale all ring-world elements together so fighters, effects and collision positions remain aligned. UI stays fixed.
- Rope framing can crop lower apron/steps, as required by the specified near-rope screen margin.
- WebGL gym projection overscans source to avoid blank edges. Canvas fallback retains the original gym artwork.
- Typecheck/build, diff check and immortal-training regression passed. Brave training preview inspected with no console errors.

## Open questions
None blocking this update.

## Known issues
Real-device and two-phone online verification pending. Canvas renderer does not support gym projection shader.

## Next proposed step
Merge and verify live framing, then continue remaining art direction work.
