## Current milestone
Every fighter property compares with Base; existing PR #270 remains open for review.

## What was implemented
- Moved body proportions to individual fighter Defense tabs; Base keeps shared scale and radii, with relative size benchmark 1. Individual size changes no longer version Base; old logs remain readable.
- Replaced Marco benchmarks with current effective neutral Base values for core, punches, Defense, block and dodge.
- Difference from Base shows signed absolute and percentage differences and refreshes while editing.
- Added coverage for neutral Base geometry, uppercut damage, live Base changes, all optional punch fields and independence from Marco edits.
- Verified typecheck, production build, model/display tests and every comparison category in Brave with no console errors.

## Key technical decisions
Base uses unit multipliers, zero added frames and unit body proportion, while retaining shared fighter scale. Base tables remain raw. No tuning values changed.

## Open questions
None.

## Known issues
Native file-picker permissions remain a manual check. Implementation is not yet merged into the published tool.

## Next proposed step
Review the updated workshop PR and tune against Base.
