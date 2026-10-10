## Current milestone
Release tested material, hand, gait and combat-audio polish against Claude's PR309 combat rules.
## What was implemented
Semantic palette masks; Rising Star handedness; distance-driven leg gait; procedural swing and sweet/sour contact audio; movement/defense cues; removal of result stinger. Tuner displays derived per-character hit/block/sour stun, current counterWhiff flags, hit rules and exhausted settings.
## Key technical decisions
Preserve latest tune.json and tune.meta.json unchanged. Use lock instead of retired pushLock. Art drafts are excluded.
## Open questions
None for this code release.
## Known issues
Approved Bruno portrait repair, Captain Eagle integration, new lock artwork and torso overhaul remain separate pending art work. Profile/progression UI remains pending. Frame-advantage preview is not yet implemented.
## Next proposed step
Verify deployed build, then finish approved art integration and progression UI.
