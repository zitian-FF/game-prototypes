## Current milestone
Fairer zombie waves, diagonal approaches and a final knock-off, plus a RETRY button for the testing build. Art refresh: the playable now uses the current Punchies look (puppet-rig boxers from the trimmed R2 art, zombies as enemies) with a gym floor backdrop and new UI treatment (boxing ring removed 2026-10-12). The live build on the former mp-console itch slot is still the first version (deployed 2026-10-08) until this branch is merged.

## What was implemented
- New small puppet rig (`src/view/Rig.ts`): head, torso, glove and boot images with two-segment arms and legs drawn in code, gait, torso twist on punches, hit snap and flash, limp pose. Left glove and boot are the right ones flipped. Rig numbers copied from the main game into this prototype's `tune.json` (`view.rig`), so main-game changes do not move it.
- Fixed wave: `run.zombieCount` (12) zombies on an even schedule from 0.5 s to 22 s, entering from 5 off-screen angles in a set shuffled order (no randomness, so every run is identical). The last zombie is resolved by about 25 s. Zombies walk a straight line to Marco, face him, and queue (only the front one is hit or attacks). Marco turns to face the front zombie.
- Defeated zombies fly along the final blow direction, spin once (360 degrees), fade out and are removed.
- RETRY button on the end screen for the testing build only: build switch `PLAYABLE_RETRY` (on by default, set `PLAYABLE_RETRY=0` for an ad build), `?retry=0` hides it for a preview. The CTA stays a no-op placeholder.
- Marco is the player, zombies are the enemies (wind-up is the right fist pulling back, strike extends it, knocked off goes limp and spins away).
- Scene: gym floor backdrop only (middle slice of the landscape image; no ring, ropes or mat), rounded JAB and CROSS buttons with glove icons, red gloves as HP, starburst on sweet hits, Punchies logo on the end screen.
- `scripts/prepare-art.mjs` rewritten for the new zip layout: copies only marco and zombie parts, glove icons, logo and the gym floor (12 textures, 198 KB), byte for byte with no resizing or re-encoding, as `PRODUCTION_STANDARD.md` asks. The old frame-compositing path is removed. It also fails loudly if the art's mirror metadata ever disagrees with the flips the runtime assumes.
- Without art (or art not yet fetched) the same rig runs on generated coloured placeholder shapes, checked in the browser test.
- Test hook `pause` added (only with `?test=1` or debug) so a frame can be captured; `verify.mjs` now also captures a mid-punch frame and a knock-off frame.
- Rules, tuning values for the game feel, CI workflows and the deploy workflow are unchanged.
- Built size: 1.78 MB total uncompressed (JS 1.50 MB, almost all Phaser, 0.33 MB gzipped; art 0.20 MB).

## Key technical decisions
- The sim stays one dimensional: a zombie has a distance along its approach line plus a fixed bearing, so punch bands, timing and scoring are unchanged. Only positions and facing use the bearing.
- The sim no longer uses randomness (no seed): spawn timing, entry angles and leave side are derived from the zombie's index.
- The old composited frames came from layered per-action exports that the main game no longer uses; the rig is how the main game draws boxers now, so the playable follows it. The rig is a copy, not an import (decoupled from the main game, per BRIEF).
- No ring: the user asked for the gym floor only, so the lane has no ropes, mat or circle. The floor is shown from the source file via a runtime frame (middle slice), so it is never re-encoded.
- The playable uses the standard `punchies_assets.zip` only. The compact portal profile in `PRODUCTION_STANDARD.md` is not used here.
- Hit effects are code-drawn so no extra art is needed.

## Open questions
- Wave size (12) and the 22 s last spawn are first guesses for fairness; the maximum score is 24 if every zombie is a head hit. Tune in the debug panel after a playtest.
- Marco turning to face the front zombie is a visual choice (position stays fixed); say if he should always face straight up.
- Jab sour distance is still 44 (the approved brief table); the main game's own rules would make a jab sour below about 77.5. See the earlier note in BRIEF.md.
- Zombie variants (different heads or colours) are possible from the zip but only one zombie look exists; add variety only if the user wants it.
- Available but unused art: portraits, ring and arena layers, music. Left out to keep the size down and the scope as briefed.

## Known issues
- Not tested on a real phone. Headless software rendering runs slowly, so the browser check waits on sim frames, not wall time.
- The 30 s end is verified by fast-forwarding the sim, not by waiting 30 real seconds.
- Hit sparks and score popups are tween-driven and are not visible in the paused screenshots.
- itch.io portrait embed settings were handed to Codex earlier; their result has not been confirmed in this session.
- Fonts fall back to Arial where Arial Black is missing.

## Next proposed step
1. User reviews the screenshots or the branch build and says whether to open the PR.
2. Merging to main redeploys to the mp-console itch slot, replacing the current live build.
