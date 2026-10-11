## Current milestone
PR #270 conflicts resolved against main 09d62d8; remains open for review.

## What was implemented
Preserved local GitHub saves, Base history and units while incorporating the current ten-fighter roster, counterWhiff, uppercut charge and push-derived stun fields. Updated workshop stat previews to the current 60% Base benchmark and durability formulas. Regression fixtures now tolerate existing Base history.

## Key technical decisions
Preserved main game UI, localisation and all owner tuning values. Workshop preview is read-only and tested against current roster formulas. Save verification uses a mock server without actual GitHub tuning writes.

## Open questions
None.

## Known issues
Native file-picker permissions remain manual. Existing build chunk-size warnings remain.

## Next proposed step
Review PR #270; merging and deployment remain separate actions.
