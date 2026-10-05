## Current milestone

Component artwork exported and verified for Claude's runtime layering pass.

## What was implemented

- Added torso, gloves/forearms, head and owner-approved effects folders for all 105 body animation keys, including alt colors, dummy and KO.
- Preserved all 1365 previous PNG files byte-for-byte. All 672 body frames reconstruct pixel-exactly at zero offsets.
- Exported 630 folders / 4032 registered frames; packed into 21 sheets at most 2048px.
- Verified current main's fly and drop KO feet/shadow path in Chromium.

## Key technical decisions

- Same 256x256 canvas, origin (128,128), frame counts and existing character/alt grouping.
- Back-to-front composite: torso, gloves, head, effects. Hidden torso and arm underlap stays beneath opaque head coverage.
- Effects include baked stun stars, dodge streaks and perfect-guard marks. Inactive effects frames are transparent; Claude can omit baked stars when using runtime orbit stars.
- No FighterView, KoAnim, groundLayer, simulation or tune changes. Legacy body/feet keys remain available until replacement rendering merges.

## Open questions

- Claude will wire per-layer offsets and core/outer hit flashes, keeping hitboxes unchanged. Offset visuals require review after runtime wiring.

## Known issues

- All component animations load on demand, but current runtime still renders legacy body plus feet.
- Expanded ZIP is 13954263 bytes; per-character atlases are about 2.2 to 2.4 MB including JSON. Existing Phaser bundle-size warning.
- Real-phone networking/controllers were not tested; lobby sockets are mocked in the presentation test.

## Next proposed step

Claude fetches the R2 bundle and merges the export PR with the runtime layering implementation. Review shifted layers and hit flashes in game before removing legacy keys.
