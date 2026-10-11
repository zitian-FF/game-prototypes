## Current milestone
Roxy and Nadia have owner-approved distinct balance and archetype descriptions.
## What was implemented
Roxy is a close-range brawler with stronger, costlier hooks. Nadia has a lighter, faster Cross with five fatigue bars and unchanged maximum fatigue penalties. The tuner edits and selectively merges archetype descriptions, and English game labels use the saved localisation keys. Long character-select descriptions fit their available width.
## Key technical decisions
Preserve Base, all other fighter tuning, body proportions and workshop history. Archetype text is validated separately from numeric simulation data. Independent text changes merge without overwriting unrelated changes; conflicting edits are rejected.
## Open questions
Human playtesting should confirm matchup fairness and fatigue pacing.
## Known issues
Remaining machine-translated copy is not native-reviewed. Updated playstyle descriptions are English; existing translated nicknames remain. Compact delivery retains its mandatory 10 MB gate.
## Next proposed step
Merge and verify the game and tuner deployments, then playtest the approved builds.
