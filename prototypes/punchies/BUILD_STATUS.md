## Current milestone
Three runtime palette skins for every existing fighter, prepared for review.

## What was implemented
21 named palette skins across Marco, Mia, Bruno, G.P. Tee, Tyke, Dragon and Longan. Existing six palette IDs retain saved ownership with approved new names. Skin chest pool and selection use the expanded catalog; offer schema refreshed. Shared palette table recolours portraits and rig parts at runtime with cached textures. Updated the release-plan content inventory and English names.

## Key technical decisions
No new image downloads or R2 writes. Preserve source alpha, dimensions, registration, dark outlines and fighter stats. Material islands prevent rectangular colour seams. Retain the three original alternate recolour functions for their hair/skin details. Four upcoming fighter portraits are approval-only and excluded from this pool.

## Open questions
Rising Star, Ring Captain and Old Champ remain catalogued but artwork is pending; Claude has been notified.

## Known issues
Palette masks depend on existing source artwork and should be reviewed if that artwork changes. Existing Vite chunk and locale warnings remain. Changes have not been published live.

## Next proposed step
Review and merge the palette catalog; continue the four new fighter portrait design approvals separately.
