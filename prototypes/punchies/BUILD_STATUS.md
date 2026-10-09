## Current milestone
Standardize Tyke and Longan portrait waist framing, stacked on outsource content PR #280.
## What was implemented
Crop Tyke below his champion belt and Longan below his waistband at asset packing time. Reduce their selection portrait heights to 189 and 174 logical pixels respectively. All portrait consumers receive the same waist crop.
## Key technical decisions
Keep original full-resolution R2 masters untouched. Pack the top 86% of Tyke and 75% of Longan, preserving retained pixels and alpha exactly with lossless WebP. Existing fighters and rigs are unchanged.
## Open questions
None.
## Known issues
Not merged or deployed. Existing Vite locale/chunk warnings remain.
## Next proposed step
Review and merge the stacked changes. Brave selection review has no console errors; typecheck/build and pixel-preservation regression pass.
