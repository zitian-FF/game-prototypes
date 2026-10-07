## Current milestone
Character portrait size hierarchy implemented; verifying release.

## What was implemented
Selection portrait heights now express Bruno largest, Marco medium and Mia smallest on both matchup sides, with the existing shared visible baseline and panel padding.

## Key technical decisions
Visible target heights are 189, 174 and 159 logical pixels respectively. The width limit keeps Bruno inside his portrait area. No art, stats, simulation or animation timing changes.

## Open questions
None.

## Known issues
Physical phone/controller checks remain pending.

## Next proposed step
Typecheck/build passed; Brave screenshot review confirms Marco taller than Mia and Bruno largest, with clean console. Merge and verify deployment.
