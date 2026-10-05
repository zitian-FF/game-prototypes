## Current milestone
Expose boxer presentation sizes and offsets in the live View tuning panel.

## What was implemented
- Moved torso, head, glove and boot sizes, shoulder/hip/boot spreads, lead/rear boot offsets and head offset into `tune.view.puppet`.
- Added range, description and reset metadata for all twelve controls, including sweat droplet and highlight sizes.
- Puppet reads the live values each draw, including dodge ghosts and KO puppet rendering.

## Key technical decisions
- Kept every existing tuning value and all former size/offset defaults identical.
- Art registration, perspective, rig depth, gameplay and netcode are unchanged.
- Existing Tweakpane binding provides immediate adjustment, reset and JSON export.

## Open questions
- Owner/device review of the assembled rig remains useful before changing its proportions.

## Known issues
- No real-phone or online-match verification in this pass.
- Controlled renderer review in Brave exercised head/body flashes, lateral gait, sweat, and fly KO mid-spin/landing without console errors. This checks renderer inputs rather than hit-event routing or a complete match.
- The shared itch page served Firestorm Arena during this check, so it was not counted as Punchies verification.

## Next proposed step
Review the rig on a real phone and verify complete-match hit routing and online play. Typecheck and production build passed; Brave at 844x390 loaded Marco, Mia and Bruno without console errors, and a live head-size edit/reset worked. Existing tuning values were checked for equality.
