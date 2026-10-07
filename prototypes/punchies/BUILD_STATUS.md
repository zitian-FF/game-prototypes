## Current milestone
Approved character-selection presentation implemented and verified locally; preparing release.

## What was implemented
Large existing portraits facing the matchup centre, rounded blue/red panels, VS impact burst, bold names and nicknames, six segmented rounded stat bars, bottom portrait roster and staged confirmation. New gym background derived from the approved mockup as a separate raster. Selection changes slide the portrait/name/stat content in with a 260 ms Cubic.Out transition and roster lift. Reduced motion skips the interpolation.

## Key technical decisions
Phaser canvas UI in CharacterSelectView; scene still owns device inputs, selections and online ready state. Uniform 844x390 authored layout fits VIEW. Tapping selects; explicit confirmation advances the single-player steps. Stats remain live tune-derived values. Portrait crops are runtime frames and preserve source PNGs/default texture frame. Slide settings and metadata are in tune.json. New R2 backdrop is the only added archive entry; public bundle SHA256 98af4121b7a6f05a96855a84cd5c5aba080c64f2822dd6d583ed41006ffa9f9d verified. During upload, Remove all was incorrectly treated as clearing the completed queue and removed the previous object; the complete bundle was immediately restored and its public hash verified.
Typecheck, build and diff checks pass. Desktop and phone composition inspected; phone single-player selection-confirm-opponent-confirm-fight handoff passed. Keyboard selection verified. Fresh boot and selection console contain no errors.

## Open questions
None.

## Known issues
Real-device gamepad and two-phone online verification remain pending. The existing readiness protocol and device ownership were retained. Fresh-boot browser verification passed after asset packing completed.

## Next proposed step
Finish fresh-boot verification, merge the focused PR, verify the deployed screen and version.
