## Current milestone
Runtime top-down puppet rig for Marco, Mia and Bruno, plus portraits on the character-select panels.

## What was implemented
- `src/render/puppet.ts`: draws each boxer from static part images (head, torso, gloves, boots) with skin-coloured arms and legs generated in code (2-segment IK, elbows and knees bend outward).
- Gait follows movement relative to facing, with a strafe blend (boots yaw, shorter stride) at sideways angles.
- High Guard puts the gloves above the head; otherwise gloves sit below the head.
- Head and torso flash separately depending on which zone was hit.
- Exhausted shows sweat droplets, dodge shows afterimages plus speed lines, stun shows the spinning stars and a slump.
- Mia's ponytail is sliced from her head master by `art/prepare-assets.mjs` and sways separately.
- Alt-colour parts for mirror matches are hue-shifted at runtime (`makeAltParts`).
- `scripts/pack-assets.js` runs an optional per-prototype `art/prepare-assets.mjs` hook that downsizes parts to WebP (about 90 KB for all parts).
- Character-select panels show the selection portrait (falls back to the live preview if the texture is missing).

## Key technical decisions
- Parts live in the R2 zip under `parts/<char>/` and are never committed. If they are absent, the puppet reports failure and the existing layered art draws instead, so CI stays safe.
- Sim is untouched; the rig is presentation only.
- The knocked-out loser is now drawn by the puppet too (limp, spinning on a fly KO, sinking on a drop); the baked `_ko` frames remain as the fallback and for the dummy.
- `prepare-assets.mjs` renders Mia's slice before measuring it (the first version stretched her head and ponytail horizontally); cut moved to 43% with a 5% overlap.

## Open questions
- Puppet sizes and offsets are constants in `puppet.ts`; should they move to `tune.json` `view` for the Tweakpane panel?
- BRIEF.md was not consulted for the portrait layout change; it may need a line if the panel layout is meant to be specified.

## Known issues
- The rig is live (parts are in the main zip). Mia culling/size fixed; confirm on device.
- Not verified: phone rendering, body-zone flash on the puppet, strafing gait visuals at sideways angles, fly-style KO with the puppet (drop KO checked), online matches with puppet.
- Sweat droplets are small.

## Next proposed step
Check the live build on a phone, then tune sizes and offsets, and move the constants into `tune.json`.
