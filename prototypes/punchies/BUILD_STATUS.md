## Current milestone
G.P. Tee welcome fighter, long-row roster locks and equipped skin flow implemented on proto/punchies/tee-roster-skins for review. Previous live UI/shop/menu release is r0086 (origin/main 0e8c6a1). This new code has not been merged or deployed.

## What was implemented
Tee has a new outlined portrait, overhead head/torso, fingerless left/right fists, boots and two independent flowing ponytails. The right fighter panel offers her as FREE until claimed, then restores the daily fighter chest. The left earn-token panel is always available. The welcome claim spends no tokens; existing fighter-four owners retain access. Initial high power/speed and low HP/stamina/stun stats are tunable. Roster remains one horizontal row, with separate player cursor locks for unavailable fighters. Select a fighter, cycle owned ready skins with left/right or touch arrows and X/N, then confirm readiness; Back returns to browsing. Palette outfits update portraits, versus intro, rigs, KO, rounds, rematches and training. Unique skin resolution supports distinct portrait/rig asset sets. Successful fighter/skin pulls now darken the shop and animate a full-height portrait, hold it for 2.6 seconds, then reveal the reward name and an acknowledgement button. Rewards persist before presentation; shop pointer and keyboard/controller controls are blocked until acknowledgement. Reveal timers/tweens clean up on shutdown and respect reduced motion.

## Key technical decisions
Skins are cosmetic and do not alter sim character IDs/stats. Preferences remain separate for P1/P2/AI; online local preferences use P1 regardless of peer side. Local VS uses the device's shared collection; online each peer advertises its available roster and cursor. Missing unique artwork is excluded from skin cycling rather than displaying the base art as a unique. Tee is a regular gloved fighter with no boxing helmet/mitts. Static parts preserve overlaps and alpha; runtime skin limbs and tail layers assemble them. R2 bundle verified SHA-256 c6334fbc5078b82c4e7358cb94a3a4c0163c582b1f9e2fe047b166d6b58d6765, with existing artwork preserved. No binary art is committed.

## Open questions
Review Tee's art and initial stat balance. Unique skin portraits/rigs and future daily fighters still need final designs. Daily ad limit and UTC reset remain configurable.

## Known issues
Real rewarded ads, authenticated wallet/ownership, ranked/MMR and leaderboards are deferred by the user. Other daily fighters and unique art remain explicit shop draft placeholders. Physical controller/device and two-device network tests remain pending. Typecheck, production build, roster/shop ownership and persistence, geometry, emergency stamina, Bo3, menu/forfeit, dummy, limb and reward reveal lifecycle regression checks pass. Existing Phaser chunk-size build warning remains.

## Next proposed step
Review the local Tee/roster/skin preview, then merge and publish if approved. Complete unique skin artwork before enabling those skins in the roster.
