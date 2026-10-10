## Current milestone
Local roster placement and leg rig polish implemented; live build remains r0126.
## What was implemented
Reserved second row for Marco, Mia, Bruno, Roxy and Nadia; Tee top-left and other fighters in stable shuffled middle slots. Pointer and keyboard/controller selection use display order without changing saved character IDs. Tuner roster parity test is dynamic. Legs attach to rotating/scaling boot collars with an overlapping ankle layer. Forward/back and strafe steps blend continuously with smoothed direction changes. All ten current/planned fighters share a portrait size table, reviewed by visible head size with bottom anchoring across selection, VS, victory and reveals.
## Key technical decisions
Only rendering changes for the gait; combat tuning and movement speed unchanged. Unfinished Roxy/Nadia remain silhouettes until integrated into the playable catalog. No art uploads or live deployment in this task.
## Open questions
Nadia portrait approval and rig production; Roxy draft integration approval; Marco torso revision remains a separate local art draft.
## Known issues
Visual validation used actual Puppet fixtures for Marco, Mia and Bruno, not a complete combat playthrough. Tee collar correction remains unfinished.
## Next proposed step
Review the local rig changes and integrate approved character assets; then release the validated changes together.
