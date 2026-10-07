## Current milestone
Clean gym props redraw uploaded to R2, ready for deployment.

## What was implemented
Redrew gym_props.png with existing shapes and outlined style, opaque solid colours and controlled material shading. Registration remains 1844x853 with transparent centre; title layout unchanged.

## Key technical decisions
Built-in image_gen redraw from prior alpha layer. Replaced only loose/gym_props.png in current R2 bundle; public SHA256 verified as 85a4825d3509706f7c0a9d63021283daa74a53d4998bf184dc35fdcbffc15cc9.
Asset pack, typecheck and production build passed. Artwork remains outside Git.

## Open questions
None.

## Known issues
Canvas fallback uses authored floor. Real-device and two-phone online checks remain pending.

## Next proposed step
Desktop title inspected with clean material fills and no browser console errors. Merge release notes to trigger deployment and verify live redraw.
