## Current milestone
Shared fighter artwork and hitbox scale shipped as r0077 (PR #240).

## What was implemented
The existing 1.5x fighter scale now controls body/core/vulnerable hurtboxes, glove contact radius, punch reach, fighter separation and rope clearance as well as artwork. Character size proportions remain Marco 1, Mia 0.88, Bruno 1.12, with the dummy using its existing character scale. AI distance calculations and the debug overlays follow the same geometry.

## Key technical decisions
A pure geometry module supplies the shared scale to simulation and rendering. Character punch reach modifiers are applied before scale. Hurtboxes use defender size and glove/reach geometry uses attacker size; mixed-character separation uses both sizes. Online peers receive the same scale in the existing host tune snapshot. Damage, stamina cost, movement speeds and action timing remain unchanged. No asset rerender is needed.

## Open questions
None. The enlarged collision bodies and increased reach intentionally change close-range spacing, as requested.

## Known issues
Physical two-device online and phone/controller checks remain pending. Existing Phaser bundle size warning remains.

## Next proposed step
Geometry regression passes all character pairs and all four attacks at 1x, 1.5x and 2x, checking just-inside/just-outside contact, shared render scale, vulnerable/core radii, anchored dummy separation and rope clearance. Typecheck/build and series/online-readiness regression pass. Brave review confirms larger debug circles around the boxer and dummy with a clean console. Deployment succeeded. Live Brave review confirms r0077, training jab contact from the starting distance (star awarded), and a clean console. Continue physical two-device online and phone/controller checks.
