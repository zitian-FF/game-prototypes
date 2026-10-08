## Current milestone
Correcting G.P. Tee rig and stats after live r0087 feedback. Fix branch proto/punchies/tee-rig-fix; user has authorized pushing finished updates to live.

## What was implemented
Tee now shares Mia's .88 world/hitbox proportion and portrait sizing, with a smaller jacket/head/hand silhouette. Her right-facing fingerless fist assets use zero rotation offset rather than the boxing mitts' 90-degree offset; cuff registration follows the asset's forward dimension. Broad hair fans replaced by thin individual white and black strands, registered by length with separate roots and animated sway. Tee's step cadence is 20% faster at equal travel. Power is 5% below Bruno for each punch; startup/recovery match Mia for each punch; stun resistance lowered to .55. HP/stamina remain .75 and movement 1.20 (Mia 1.15).

## Key technical decisions
Render and simulation geometry share the same Mia-sized proportion. Tee-specific visual registration/timing values live in tune.json and metadata. Fist/cuff math is shared and explicitly tested across both hands and facing angles. Slender tail assets normalize by width so thinning them cannot inflate their length. Existing art preserved; only Tee's two tail entries changed in R2. Public bundle SHA-256 f15af8c3a28849304375ab11292706750933f95d1fff3f7bba643ab749ea2f53 verified.

## Open questions
Review the smaller silhouette and revised balance through playtesting.

## Known issues
Other daily fighters and unique skin art remain draft placeholders; real ads, authenticated ownership, ranked/MMR and leaderboards remain deferred. Physical controller and two-device multiplayer tests remain pending. Geometry tests now include Tee and verify equality with Mia; limb tests include all four characters and Tee's cuff/axis and stat targets. Typecheck and production build pass; existing Phaser chunk-size warning remains.

## Next proposed step
Publish the tested correction, then verify the live version and assembled Tee.
