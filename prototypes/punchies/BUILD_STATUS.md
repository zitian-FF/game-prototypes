## Current milestone
Runtime palettes and obsolete asset removal, stacked on UI PR #278.
## What was implemented
Palette portraits and rigs keep their existing cached recolouring. Removed unused mirror-match part generation; base atlas groups now serve same-character matches. Excluded legacy starter alternate animation folders and duplicate loose palette textures from builds. Saved 4,688,226 bytes (12 files) from the packed bundle.
## Key technical decisions
Base and unique artwork remains in R2 as source masters; no R2 overwrite required. Palette ownership, skin IDs, colours and stats remain unchanged. Builds omit redundant palette assets. Unique skins retain separate art.
## Open questions
None.
## Known issues
Not merged or deployed. Existing Vite locale/chunk warnings remain. Legacy baked animation fallback uses base colours; current palette presentation uses the live layered rig.
## Next proposed step
Review and merge the stacked changes. Typecheck/build, starter recolours, roster, caching and asset optimization regressions pass. Brave palette comparison and Scarlet Spark selection/training rig checked with no console errors.
