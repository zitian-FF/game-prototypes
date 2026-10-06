## Current milestone
Approved title screen and shared layered gym/ring implemented locally; R2 upload pending Brave extension file access.

## What was implemented
- Primary Single Player button, Versus and Practice groups, Online Host/Join popup, Settings retaining local input setup, dedicated Credits panel; demo notice removed. Existing debug controls, SYNC TUNE, tune label, version stamp and fullscreen remain.
- Gentle logo pulse, stamped loading logo with continuously wrapping background pattern, snapshot crossfades on screen changes. Motion respects prefers-reduced-motion. Feel values have tune entries and metadata.
- Ring-free gym plus five registered alpha ring layers. Gameplay reassembles native rope and round-pad crops from the same master to fit its fixed camera. Rear rope stays behind boxers; near/side ropes sit in front. Character corner colours retained. Simulation, netcode, perspective shader and existing gameplay tuning untouched.
- New R2 bundle adds ten loose assets and leaves all prior entries byte-for-byte unchanged. Five-layer recomposition is pixel-identical to the isolated master. Art and zip remain outside Git under workspace outputs/title-screen-v1.

## Key technical decisions
- Runtime Phaser UI over separate artwork; no baked text/buttons in background.
- Crossfade uses an outgoing still over the live destination with normal scene shutdown, avoiding parallel simulation/network loops. Snapshot textures removed at transition shutdown.
- Typecheck/build and existing limb/immortal-training regressions passed. Brave inspected desktop/phone title, Credits, Settings, Single Player navigation and training arena; no console errors. Loading preview uses real ArtBootScene with a delayed local test response; completion clears all logo/background layers.
- No relevant newer shared-package change applies to Punchies.

## Open questions
- Brave's ChatGPT extension needs Allow access to file URLs enabled before the upload tool can select the validated R2 zip. Owner notified. Do not merge/deploy until the art upload is verified.

## Known issues
- New presentation is not deployed yet; production remains version 061026r0061.
- Real-phone/two-phone online checks pending. Settings retains its existing input-picker panel. Character-select redesign, combat cues, KO brush lettering/bells and arena impact shake are separate approved follow-ups recorded in BRIEF.md.

## Next proposed step
Upload and hash-verify the additive R2 bundle, merge the title-presentation branch, verify deployment in Brave, then review character-select direction.
