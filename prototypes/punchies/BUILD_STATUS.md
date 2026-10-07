## Current milestone
Character-selection portrait and panel corrections verified; preparing release.

## What was implemented
All portraits now fit and anchor using cached visible alpha bounds rather than transparent PNG edges. Bruno shares the same panel baseline as Marco and Mia. Both stat columns and long names have inset room within their panels. Mia's selection portrait has a smoother youthful adult face while retaining her serious expression, outfit, pose and outlined art style.

## Key technical decisions
Source registration stays unchanged; visible bounds are measured once per portrait with one canvas readback. Existing inward-facing mirroring and slide transitions are preserved. Only loose/portrait_mia.png changed in the R2 bundle; public-download SHA256 verified as 145184762d72cc6068c9e08d86b865d00973e79b9a2b5cd5386dfa6247d70f51. Built-in imagegen used for Mia's targeted portrait edit; master and prompt saved under outputs/selection-fixes outside Git. Typecheck/build and Brave screenshot reviews passed with clean console; Bruno and Mia reviewed on both sides and Marco baseline checked.

## Open questions
None.

## Known issues
Two-phone online and physical controller checks remain pending; this presentation-only change does not alter their simulation or inputs.

## Next proposed step
Merge focused PR and verify itch.io deployment.
