## Current milestone
Tougher, busier waves: zombies have 4 HP (jab 2, cross 4, sweet or sour), a faster cross, and 50 zombies whose spawn pace and walk speed build through the 30 s. On branch `proto/punchies-playable/waves-and-hp`, not merged. The live itch build (mp-console slot) is the previous version (12 zombies, one-hit kills).

## What was implemented
- Zombie HP 4 with a small HP bar above each. Sweet hits do full damage (jab 2, cross 4) and score (head 2, body 1, per hit). Sour hits do half damage (`punch.sourDamageMult` 0.5), no score, no stagger, and the zombie still punches. A sweet hit that does not defeat a zombie staggers it back 25 units and interrupts its punch; a defeating hit knocks it off along the blow direction with one 360 spin and a fade.
- Cross sped up on request (startup 13 to 8, recovery 20 to 12, whiff recovery 12 to 8). Jab unchanged. The cross is now 29 frames from press to ready, the jab 19.
- 50 zombies per run (the maximum), always the same: spawn gap shrinks from 0.7 s to 0.35 s (first spawn 0.5 s, last about 26 s), walk speed rises from 200 to 320 lane units per second across the wave, 7 off-screen entry angles (up to 28 degrees) in a set order. No randomness, so every run is identical.
- Player damage look: red tint on Marco (no more solid red silhouette) and red screen-edge vignette instead of a full-screen red wash.
- Tests: sim tests cover damage values, stagger, two jabs to defeat, one cross to defeat, sour half damage, 50 spawns, shrinking gaps, rising speeds, identical runs, entry angles, last spawn timing, knock-off removal. Browser check adds two jab taps defeating a zombie and an HP and hit-look capture.
- Earlier work unchanged: puppet-rig art (Marco and zombies), gym floor backdrop, RETRY on the testing build (`PLAYABLE_RETRY`), `?debug=1` panel.
- Built size about 1.8 MB total uncompressed (Phaser is almost all of it), art about 0.2 MB.

## Key technical decisions
- The sim stays one dimensional (distance along the approach line plus a fixed bearing), so punch bands and timing are unchanged; only damage, HP, spawning and speed changed.
- "Subjected to sweet and sour hits" was read as the main game's rule: sweet = full damage, sour = reduced. Sour used to do nothing, so this is a change from the original brief (recorded in BRIEF.md decision 8).
- Points stay per sweet hit, so two jab head hits (4 points) out-score one cross head kill (2 points) even though the cross kills faster.

## Open questions
- Sour damage: half is my reading of "sweet and sour hits". Say if sour should do something else (zero as before, or a different fraction). The value is `punch.sourDamageMult` in the debug panel.
- Scoring balance: per sweet hit favours jabs. Options are scoring on the kill, or a bonus for a one-hit cross kill. Not changed without a go-ahead.
- Difficulty is a first guess. With 50 zombies and a 0.35 s end gap nobody can clear everything; check how it feels on a phone and tune `run.startGapSec`, `run.endGapSec`, `enemy.walkSpeed`, `enemy.walkSpeedEnd`, `enemy.windupFrames`.
- Presentation suggestions from ad research are in the session notes (hook, juice, combo, end card); none are built yet, and BRIEF.md out-of-scope items (audio, tutorial, hint hand) would need the user's go-ahead first.
- The itch Fullscreen setting was handed to Codex (thread 2b50dfe7); result not yet seen.

## Known issues
- Not tested on a real phone. Headless software rendering runs slowly, so the browser check waits on sim frames, not wall time.
- The 30 s end is verified by fast-forwarding the sim, not by waiting 30 real seconds.
- Hit sparks and score popups are tween-driven and not visible in paused screenshots; the damage vignette is checked by forcing it on.
- Fonts fall back to Arial where Arial Black is missing.

## Next proposed step
1. User reviews this branch (or the deployed build once merged) and answers the sour damage and scoring questions.
2. Then presentation work from the ad research, starting with the first-seconds hook, combo and kill-streak feedback, and a stronger end card.
