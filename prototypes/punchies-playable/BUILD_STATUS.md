## Current milestone
Over-the-top screen effects, on request. On branch `proto/punchies-playable/vfx`, stacked on `proto/punchies-playable/audio` (PR #355), which sits on `presentation` (PR #354), which sits on `waves-and-hp` (PR #353). None is merged; the live itch build is the earlier version (12 zombies, one-hit kills, no sound, plain effects).

## What was implemented
- New effects module (`src/fx.ts`), all drawn in code with four generated particle textures, no art files:
  - Sweet hit: layered starburst, expanding shockwave ring, streak lines along the blow direction, flying zombie goo and sparks, smoke, comic word (POW! body, BAM! head, K.O.!! on a defeat), screen flash, camera shake, zoom punch and a small rotation jolt. A defeat is the biggest (second ring, about 2x particles, 70 ms hit-stop). Sour hits get a small puff and ring.
  - Smoke and spark trail behind a zombie flying off.
  - Taking a punch: red embers, ring and burst, OUCH!, red flash, strong shake and an 80 ms hit-stop.
  - Whoosh streaks on every punch (heavier for the cross).
  - Combo call-outs scale with tier (colour, size, confetti from both sides, flash, shake); combo counter changes colour by tier; score pop is bigger.
  - HORDE INCOMING and FINAL RUSH pulse the screen edges red.
  - End card: confetti for a finish, embers and a red flash for an overrun.
  - Call-out text shrinks to fit the screen width (found when "UNSTOPPABLE!" ran off the edges).
- `tune.json` `fx` block (`intensity` 1, `shake`, `particles`, `flash`, `zoomPunch`) and `view.hitStopMs` 70, all in the debug panel. Intensity 0 turns the effects off, 2 doubles them. Particle emitters are capped (220 alive each, 320 for confetti).
- Browser check adds frozen-frame captures mid-explosion (defeat, taking a punch, a tier-3 combo) and asserts that a defeat produces a burst of particles (79 alive in the test). The scene is paused about 100 ms after the event to inspect it.
- Earlier work unchanged: generated sound and mute toggle, combo and call-outs, damage numbers, 4 HP zombies, 50 zombie paced wave, puppet-rig art, RETRY (testing build), `?debug=1` panel.
- Built size about 1.9 MB total uncompressed, no new files.

## Key technical decisions
- The effects are presentation only: no sim or rule change.
- One master dial (`fx.intensity`) plus per-kind multipliers, so the over-the-top default can be turned down without code changes if it hurts readability or phone performance.
- The camera zoom punch and rotation jolt move the whole screen, including the HUD and buttons, for about a quarter second; taps in that window map through the camera transform and are still accurate to a few pixels.

## Open questions
- Phone performance is untested. This is the biggest risk of the pass: many particles, additive blending and full-screen flashes on a low-end phone. If it stutters, lower `fx.particles` or `fx.intensity` first; the particle caps are there for this. A real-device check is needed before an ad network build.
- Readability: at the default strength the comic words and flashes can cover the zombies for a moment during a busy wave. Judge on a phone and dial `fx.intensity` down if needed.
- Music is still out of scope (BRIEF.md). Combo multiplier or kill-based scoring and sour damage (half) remain undecided; the hint hand and fake-fail opening remain out of scope.
- The itch Fullscreen setting was handed to Codex (thread 2b50dfe7); result not yet seen.

## Known issues
- Not tested on a real phone or heard on a real device (iOS Safari audio in particular).
- Headless software rendering runs slowly, so the browser check waits on sim frames and frames are frozen to inspect effects; the 30 s end is verified by fast-forwarding the sim.
- Fonts fall back to Arial where Arial Black is missing.

## Next proposed step
1. User plays the build on a phone and tells me whether the effects are too much, not enough, or slow; adjust `fx.intensity` or the caps.
2. Decisions on the combo multiplier, sour damage and music.
3. Merge order: PR #353, #354, #355, then the effects PR. Merging redeploys to the mp-console itch slot.
