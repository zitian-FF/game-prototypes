## Current milestone
Approved Punchies roster, art and UI update is live on itch.io.
## What was implemented
Published Tyke, Dragon and Longan fighters, Flaming Kunoichi and McClassic unique skins, locked starter palette rewards, runtime recolouring and mirrored asset optimization, selection/VS polish, softer buttons and player-only training selection. Tyke and Longan portraits are waist-framed. Seven-fighter tuning workshop is live on GitHub Pages. Concurrent release-plan notes are retained in docs/release-plan.md.
## Key technical decisions
R2 masters remain intact; packed portraits crop below belt/waistband. Cosmetic skins share fighter stats. Longan remains a provisional Marco baseline. Consolidated release commit 72420ca; itch build stamp 091026r0105. Fixed outdated deployment test stubs, shop test clock, canonical localization roster checks and Windows test path handling.
## Open questions
Longan's final stats await user tuning.
## Known issues
Minute original matte RGB may remain in preserved antialiased edges. Existing Vite locale/chunk warnings remain.
## Next proposed step
User playtest the live release. Both game and Pages deployment workflows succeeded; live seven-fighter roster, cropped Longan portrait and workshop core values verified in Brave with no console errors.
