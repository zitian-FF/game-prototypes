## Current milestone
Modern/Classic gameplay, presentation and tutorial integration complete; ready for the authorized staging batch.

## What was implemented
Modern contextual held Normal/Super controls, no stamina, automatic High Guard without PG, 12-frame collision-triggered dodge, one 0.8 damage factor, mode-aware input/rollback/network snapshots, per-side UI and saved preferences, dual tutorials and intro-only 25% HP increase. Duplicate Controls Credits removed; Settings Credits retained. Eleven new UI/tutorial labels are authored in six languages.

## Key technical decisions
Canonical modes bind before the first input sample. New user-facing matches default Modern; Classic bindings/tuning remain. Online peers validate the agreed pair and checksum; BO3 locks modes, while changes apply only to a later full set. Context thresholds use actual scaled fist reach. Modern raw analog input reaches canonical hysteresis; Classic deadzones remain unchanged. No roster additions or global HP changes.

## Open questions
None for the UI API. Final community character redraw approval remains outside this branch.

## Known issues
Physical Xbox/iOS and real two-device WebRTC smoke are not claimed. Deterministic mixed-mode two-peer/rollback, combat/UI/input/tutorial/first-play/localisation regressions and TypeScript pass. Native Sheet rows519-529 aligned. Full release/package validation belongs to Build.

## Next proposed step
Build integrates this complete source delta once into its authoritative edition/release layer and performs the authorized staging deployment.
