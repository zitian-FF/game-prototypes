## Current milestone

Logo, tilted-ring presentation and split feet exports completed on proto/punchies/layered-ring-art; R2 upload verified. Runtime feet/shadow wiring remains with Claude.

## What was implemented

- Extracted approved original logo pixels into alpha PNG; menu and boot/group loading display it with text fallback.
- Added near-side apron and turnbuckle layers, taller padded posts and highlighted/shadowed ropes; preserved flat ring floor footprint and existing keystone shader.
- Exported 105 matching *_feet folders; bodies have no baked ground shadow or feet. Total 210 folders / 1344 fixed 256x256 frames.
- Adapted browser checks for deferred character groups and added asset-layer contract verification.

## Key technical decisions

- Owner sketch never used as helmet design; Mia clothing/face revisions remain deferred.
- Existing per-character grouping retained. No simulation, tuning, FighterView or KoAnim edits.
- Feet keys append _feet to body keys, preserving registration/frame counts. Claude owns feet screen-Y and nonrotating ground-shadow wiring.
- Apron stays inside the flat camera before shader warp; near rope moves upward in presentation to expose skirt.
- Typecheck/build pass; 7 atlas sheets <=2048; alpha logo and 1344 layer frames verified. Playwright loads 210 configs on demand, checks 84 body poses, KO/results, mobile/tutorial, version/debug and zero errors. Separate art-free fallback passed. Final menu/ring captures inspected.

## Open questions

- New art PR needs owner merge decision after Claude feet/shadow integration review.

## Known issues

- Feet/shadow are exported but not drawn by current FighterView/KoAnim; Claude integration is outstanding.
- Ring/logo updates are not yet merged/deployed. Latest pre-change WIP deployment run 37220320885 succeeded.
- Real-phone networking/controller checks unverified; existing Phaser bundle-size warning.
- Previous R2 bundle retained in local outputs/punchies-assets-pre-layer-split.zip for rollback.

## Next proposed step

Claude wires separate feet and ground shadows, reviews the PR, then coordinates merge/deploy and live verification with owner.
