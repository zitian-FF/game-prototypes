## Current milestone
All workshop tuning fields display units; PR #270 remains open for review.

## What was implemented
- Stored-unit labels on every tuning control and units on effective values, Base comparisons and version history.
- Distinguished HP damage, stamina damage, stun damage, frames, added frames, pixels, rates, ratios and multipliers.
- Verified complete editable-field unit coverage, model regressions, typecheck and production build.
- Brave checked every fighter/Base category with no console errors and captured the labelled punch table.

## Key technical decisions
Stored fighter multipliers retain multiplier units; their calculated stats use gameplay units. Distances use logical game pixels; timing is measured in 60 Hz simulation frames. No numeric tuning values or save schema changed.

## Open questions
None.

## Known issues
Native file-picker permissions remain a manual check. Published tool awaits the implementation PR merge.

## Next proposed step
Review the updated workshop PR and use the unit labels while tuning.
