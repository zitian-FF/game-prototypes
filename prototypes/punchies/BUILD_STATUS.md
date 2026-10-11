## Current milestone
Fighter-specific single-charge uppercuts approved for live release.
## What was implemented
Each fighter fills a one-, two-, three- or four-star meter for one uppercut; firing empties it. Longan earns a weak one-star uppercut (8 HP damage). Tyke earns a four-star finisher (36 HP damage, 6-frame startup, 26-frame recovery). All ten fighters have uppercut stats matching their playstyles. AI, HUD and touch controls use the fighter requirement; the tuner exposes whole-star requirements. Tutorial copy describes the single-charge rule in all six languages.
## Key technical decisions
Retain normal-guard bypass and existing Perfect Guard/dodge defenses. Preserve Base's three-star benchmark and all other punch/core tuning. Requirements are integer stars from 1 to 4. Uppercuts earn no replacement stars. Add real-simulation charge, cap, consumption, damage and guard-bypass tests to deployment verification.
## Open questions
Human playtesting should evaluate frequent Longan pressure and Tyke's earned burst across matchups.
## Known issues
Existing machine-translated copy is not native-reviewed. Compact delivery retains its mandatory 10 MB gate.
## Next proposed step
Verify live deployment, then playtest the experimental roster and refine uppercut values in the tuner.
