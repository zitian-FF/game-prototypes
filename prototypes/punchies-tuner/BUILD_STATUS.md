## Current milestone
Workshop includes per-punch counter flags and exhausted guard/dodge tuning from main PR #306. PR #270 remains open.

## What was implemented
- Counter Startup and Counter Recovery on all four punch tabs, with explicit 0/off and 1/on units and shared-rule descriptions.
- Exhausted Chip Mult in Block and Exhausted Efficacy in Dodge, using current metadata ranges and defaults.
- Save/roundtrip/conflict and unit coverage tests for the new fields.
- Typecheck, production build, model/unit/history/HTTP/display/tune-guard checks passed. Brave verified counter controls and both exhausted settings with no console errors.

## Key technical decisions
Counter flags remain shared punch rules and compare with Base. All new numeric fields participate in selective saves and Base history. Preserved owner-approved tune values, history and archetypes. No state-readability production work.

## Open questions
None.

## Known issues
Native file-picker permissions remain manual; published workshop awaits the PR merge.

## Next proposed step
Review the updated workshop and tune counter/exhausted rules.
