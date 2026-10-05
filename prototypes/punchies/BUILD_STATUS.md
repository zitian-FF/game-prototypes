## Current milestone

Layered renderer is merged in PR204; lean exports are ready for Claude.

## What was implemented

- Removed 98 obsolete non-KO body keys; retained all KO bodies, feet and component layers.
- 532 folders /3416 frames. ZIP reduced from 13954263 to 9772979 bytes; atlas sheets from 21 to 14.
- All 672 zero-offset composites remain RGBA-exact against the preserved reference ZIP; 749 retained legacy PNGs are byte-identical.

## Key technical decisions

- Fixed 256x256 canvas and registration remain unchanged. Existing packer handles tight trim bounds and deduplication.
- No runtime, packer, perspective, simulation or tune edits. This branch incorporates main's merged renderer.
- Group PNG+JSON bytes: bruno1485045, bruno_alt1512525, dummy1569586, marco1482645, marco_alt1510544, mia1530972, mia_alt1586727.

## Open questions

- Owner clarification pending: expressive character art for UI portraits/key art only, or also in-game sprites. BRIEF.md may need this scope recorded.
- Mia face/clothing changes remain deferred. Layer cut-quality review is pending owner feedback; cleanup does not claim to fix cuts.

## Known issues

- Groups remain above Claude's 1.2 MB target. Claude owns lossless WebP/packer follow-up.
- Typecheck/build and exact-composite checks pass. Brave menu/training loads Marco, Mia and dummy without console errors. Full automated pose/KO test was not rerun; only Brave automation is authorized on this PC.
- Existing Phaser bundle-size warning. Real multiplayer/phone play unverified.

## Next proposed step

Claude reviews lean exports, considers lossless WebP, and deploys the smaller bundle. Await owner art scope and cut inspection before redrawing characters.
