## Current milestone
Workshop synced with the seven-fighter roster and owner-approved tune changes through main 9ce9087. Implementation remains in PR #270 for review.

## What was implemented
- Defense category exposes shared hurt/core/vulnerable radii, fighter scale and per-fighter body proportions with current ranges and descriptions.
- Effective reach, collision radii, Marco deltas and perceived bars follow tuned proportions; Base remains the 80% benchmark.
- Preserved raw Base history, local/GitHub selective saves, archetype localisation and the latest game character-selection layout.
- Updated regression coverage for draft geometry, versioning, all seven fighters and new roster archetype exports.
- Verified typecheck, production build, workshop HTTP/file/model/history/display tests, geometry, localisation/export and tune guard. Brave confirmed live size updates, all seven raw proportions, Base at 80% and no console errors.

## Key technical decisions
Use current main tune.json and metadata without changing owner-approved values. Read perceived stats from the supplied draft, not a hardcoded proportions table or global live tune. Body proportions and fighter scale are Base geometry values and version with raw Base changes. Existing PR remains unmerged.

## Open questions
None for this tuner update. Progression/profile screens and portal work remain separate tasks.

## Known issues
Physical file-picker permissions remain a manual check. Existing translations need review when English archetype wording changes. Real balance saves are not performed during development.

## Next proposed step
Review the workshop PR and use Defense to tune body size alongside collision radii.
