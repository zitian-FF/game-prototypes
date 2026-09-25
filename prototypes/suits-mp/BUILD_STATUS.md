## Current milestone

Fullscreen DOM overlay alignment corrected for itch.io's letterboxed viewport.

## What was implemented

- Pinned Phaser's DOM overlay container to the game parent origin so its copied canvas margin is applied once during Scale.FIT centering.
- Reproduced the original 74px canvas/DOM offset on the deployed itch.io game at 523x1280; verified the fix locally at 523x1280, 390x844, and 844x390.
- Opened the Menu modal in the tall viewport and confirmed it is centered over the canvas.

## Key technical decisions

- Kept the fixed 390x844 logical game layout. The fix only aligns Phaser's DOM layer with its canvas after viewport centering and resize.

## Open questions

- The open-center nameplate and darker, list-based lobby are working mockups awaiting visual review; their new layout and art are not part of this code change.

## Known issues

- Local browser verification saw one external font request denied by the sandbox. Local art loaded and no page exception was observed.

## Next proposed step

Review the fullscreen overlay alignment in the deployed prototype, then review the separate open-center nameplate and lobby working mockups before implementing them.
