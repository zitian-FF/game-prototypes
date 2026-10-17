## Current milestone
Deploy Muse's Airship Battle 1v1 as Battleshield on GitHub Pages and link it from the prototypes index.

## What was implemented
Imported the procedural Godot 4.3 source, added a single-threaded Web export to the existing Pages workflow, and added the Battleshield hub link. Headless automated verification skips screenshot capture because no viewport image exists in that mode.

## Key technical decisions
Keep the explicit Godot import under godot/battleshield, isolated from Phaser prototype discovery. Preserve gameplay, balance, and artwork. Build web binaries in CI rather than committing them.

## Open questions
None.

## Known issues
This is Muse's initial vertical slice. Crew roles, runestones, harpoons, cargo, and flight modes are outside its current implementation. Landscape is recommended for the fixed tactical interface on phones.

## Next proposed step
Verify the public game and prototypes link after deployment.
