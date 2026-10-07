## Current milestone
Camera/effects synchronisation fix verified locally; preparing release.

## What was implemented
Corrected runtime effect adoption to listen for Phaser.Scenes.Events.ADDED_TO_SCENE instead of the nonexistent generic add event. Sparks, guard rings, damage numbers and hit labels now join the existing ring container and inherit its fitted scale, projection and camera movement. Full-screen overlays and HUD retain their existing separate rendering.

## Key technical decisions
One event-hook correction, with matching shutdown cleanup; no tuned values, art, simulation or network changes. Added scripts/test-punchies-effects-sync.mjs using the real Phaser DisplayList event contract to cover runtime depth adoption, shared opening/mid/end zoom transforms, screen-overlay exclusions, already-parented/destroyed objects and listener cleanup in Canvas/WebGL paths.
Typecheck and production build passed. WebGL browser review uses the actual FightStage and Effects with repeated uppercut/counter events, opening/reset zoom and impact shake: effects remain in the world container, labels track the dummy, console clean.

## Open questions
None.

## Known issues
Two-phone online and physical controller checks remain pending; this change does not alter their inputs or simulation.

## Next proposed step
Canvas and WebGL actual FightStage/Effects browser reviews passed with clean consoles. Merge the focused PR and verify deployment.
