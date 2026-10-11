## Current milestone
Mobile skin-selector polish is validated in PR335; merge approval pending.
## What was implemented
Selected fighters show a dedicated skin strip, large previous/next buttons with press feedback, a larger name and separate X/N counter. One-skin arrows are disabled.
## Key technical decisions
44 by 38 logical-pixel hit areas replace glyph-only targets. Preserved latest main stat readouts and tuning. No new localization keys.
## Open questions
Explicit approval to merge PR335 and deploy is required by automatic review.
## Known issues
This selector change is not live yet.
## Next proposed step
Merge and deploy once approved. Typecheck/build/localization checks pass; Brave 640 by 360 preview verified Default 1/2 to Hotshot 2/2 pointer cycling and clean console.
