## Current milestone
Approved title screen and shared layered gym/ring deployed via PR #226 on 7 October 2026; version 071026r0063. R2 bundle hash verified.

## What was implemented
- Primary Single Player button, Versus and Practice groups, Online Host/Join popup, Settings retaining local input setup, dedicated Credits panel; demo notice removed. Debug controls, SYNC TUNE and tune label retain the latest main branch debug-unlock gate; version stamp and fullscreen remain.
- Gentle logo pulse, stamped loading logo with continuously wrapping background pattern, snapshot crossfades on screen changes. Motion respects prefers-reduced-motion. Feel values have tune entries and metadata.
- Ring-free gym plus five registered alpha ring layers. Gameplay reassembles native rope and round-pad crops from the same master to fit its fixed camera. Rear rope stays behind boxers; near/side ropes sit in front. Character corner colours retained. Simulation, netcode, perspective shader and existing gameplay tuning untouched.
- New R2 bundle adds ten loose assets and leaves all prior entries byte-for-byte unchanged. Five-layer recomposition is pixel-identical to the isolated master. Art and zip remain outside Git under workspace outputs/title-screen-v1.

## Key technical decisions
- Runtime Phaser UI over separate artwork; no baked text/buttons in background.
- Crossfade uses an outgoing still over the live destination with normal scene shutdown, avoiding parallel simulation/network loops. Snapshot textures removed at transition shutdown.
- Typecheck/build and existing limb/immortal-training regressions passed. Brave inspected desktop/phone title, Credits, Settings, Single Player navigation and training arena; no console errors. Loading preview uses real ArtBootScene with a delayed local test response; completion clears all logo/background layers.
- No relevant newer shared-package change applies to Punchies.

## Open questions
- None blocking this update.

## Known issues
- Itch.io and GitHub Pages workflows succeeded. Published title loaded in Brave without console errors; latest main tutorial, bot spacing and debug gating preserved.
- Real-phone/two-phone online checks pending. Settings retains its existing input-picker panel. Character-select redesign, combat cues, KO brush lettering/bells and arena impact shake are separate approved follow-ups recorded in BRIEF.md.

## Next proposed step
Review character-select direction next. Uploaded bundle SHA256: 161bf9bd30387ab295f70d1b74d05be90d7925570cba11e99dfc1c3bbc701e22.
