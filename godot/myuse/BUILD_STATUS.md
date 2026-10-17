## Current milestone
Publish the downloaded Muse Godot animation loop to GitHub Pages.

## What was implemented
Imported the original procedural Godot source. Added a single-threaded Web export to the existing Pages workflow at `/myuse/`, responsive canvas stretching, and a portable capture output directory.

## Key technical decisions
Godot 4.3 matches the downloaded project. The import stays under `godot/myuse` outside the Phaser prototype discovery path. CI builds the web binaries; unused bonus artwork stays in the original local ZIP. Animation code and timings are preserved.

## Open questions
None.

## Known issues
The imported demo uses a procedural character, not the bonus AI spritesheet. It is an automatic animation demo; manual controls require changing AUTO_DEMO in the source.

## Next proposed step
Verify the published Pages URL after deployment completes.
