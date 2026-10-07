## Current milestone
KO, compact results and first-round portrait clash implemented; release verification pending.

## What was implemented
First-round selected portraits slide inward around animated fire and VS before ROUND 1 / FIGHT. Showcase lasts 1.8 seconds, freezes combat and leaves round clock untouched; later rounds skip it. KO uses sequential KNOCK / OUT wipe-and-impact lettering with triple bell, gated on confirmed online results. Final victory/defeat/draw screen has rounded panel, animated heading, series score and polished buttons.

## Key technical decisions
Showcase timing is deterministic in sim ticks for both peers. Online rollback accepts the same first-round flag on both sides. Training/tutorial use no showcase. Preserve compact result pacing and existing KO body motions. Current portraits are reused; future skin asset selection is not implemented. Reduced motion removes slides, fire movement and impact scaling.

## Open questions
None for this task. Shop economy remains under discussion.

## Known issues
Physical two-device online and phone/controller checks remain pending. Existing Phaser bundle warning remains. Portraits currently represent base characters until skin ownership is built.

## Next proposed step
Typecheck/build and series, first-round freeze/timing, peer-hash, KO/result ordering, stamina and Canvas/WebGL effects checks passed. Brave portrait and compact victory/defeat review shows no errors. KO title cleanup is explicitly tested before results to prevent background-tab tween overlap. Publish and verify live.
