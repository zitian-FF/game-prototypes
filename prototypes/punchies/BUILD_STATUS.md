## Current milestone
Standardize Tyke and Longan portrait waist framing, stacked on outsource content PR #280.
## What was implemented
Crop Tyke below his champion belt and Longan below his waistband at asset packing time. Reduce their selection portrait heights to 189 and 174 logical pixels respectively. All portrait consumers receive the same waist crop.

Release-plan decisions remain documented in docs/release-plan.md; this release implements the approved roster/art/UI updates.
- G.P. Tee moved from a free Shop claim into the daily fighter chest pool; the welcome claim panel, its strings and its test cases are gone.

- Fixed keyboard and controller fighting: the pause button (depth 220) counted as an open modal, so every fight scene ignored keyboard and controller fight input and only touch worked. The pause button is now excluded from the modal check (`PAUSE_BUTTON_DEPTH` in `ui/menuNav.ts`).

- First launch flow: easy fight (Marco vs Bruno, jab and cross only, best of one, cannot lose, skippable), then the Rising Star reveal, one free skin chest (Shop button badge) and "Welcome to the Ring". See BRIEF.md.

- Settings has RESET SAVE (two confirmations, wipes all saved keys, reloads); with ?debug=1 the Shop has a DEBUG: 99 TOKENS button.

## Key technical decisions
Keep original full-resolution R2 masters untouched. Pack the top 86% of Tyke and 75% of Longan, preserving retained pixels and alpha exactly with lossless WebP. Existing fighters and rigs are unchanged.
## Open questions
None.
## Known issues
- First launch flow was checked in headless Chromium with keyboard and mouse only; touch play on a real phone and the reveal with final Rising Star art are untested.
- `scripts/test-punchies-runtime-palettes.mjs` fails locally ("no duplicate palette textures shipped") when the fetched art does not match the repository state; it is not part of the deploy workflow.
Not merged or deployed. Existing Vite locale/chunk warnings remain.
## Next proposed step
Review and merge the stacked changes. Brave selection review has no console errors; typecheck/build and pixel-preservation regression pass.
