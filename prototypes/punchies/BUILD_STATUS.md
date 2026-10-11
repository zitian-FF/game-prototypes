## Current milestone
Epic and Legendary reward presentation implemented locally.
## What was implemented
Chest reward previews and pull reveals classify palette swaps as Epic in purple and fighters/unique skins as Legendary with animated prismatic lettering.
## Key technical decisions
Shared rarity mapping and styling keep both surfaces consistent. Reduced motion uses a static prismatic gradient. Animation is removed when its label is destroyed. Existing odds, prices and tuning are unchanged.
## Open questions
None for rarity classification.
## Known issues
Rarity terms use English fallback until added through the translation Sheet. This change is not deployed yet.
## Next proposed step
Include the validated rarity presentation in the next release.

Language settings: added compact canvas country flags for all six language options; verified layout in Brave with no console errors. Typecheck and build pass. Not deployed.

Tutorial: moved instruction panel from top+92 to top+8, keeping heading, body and skip/exit controls together. Verified ring clearance in Brave; build/typecheck pass. No text changes.

Selection fixes: confirmation/status changes no longer trigger card clash; fighter and skin art changes still do. Flaming Kunoichi uses one shared waist-framed runtime texture in all portrait screens, preserving source masters. Waist crop verified in Brave with no errors; build passes. Combat VFX now uses outlined bursts with weaker sour sparks and layered pre-fight flames; flame preview verified, full combat motion validation pending. Localisation approved corrections are frozen in Sheet and regenerated, with Cross=摆拳 and Epic/Legendary translated. Pending deployment.
