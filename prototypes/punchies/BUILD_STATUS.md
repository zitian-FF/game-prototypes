## Current milestone
Roster expansion QA complete; PR274 ready for review, unmerged.

## What was implemented
- Tyke Maison and Dragon replace daily fighter placeholders. Flaming Kunoichi adds a unique Mia portrait and rig.
- Starter alternate palettes begin locked in the skin pool; explicit acquisitions remain owned.
- Re-exported contaminated component slices from approved art, preserving outlines and removing neighbouring fragments. Corrected Dragon ribbon scale by length.
- Palette reward previews use actual recoloured portraits. Locked fighter instructions distinguish the welcome gift from daily purchases.
- Corrected R2 bundle uploaded and public-download SHA verified; unrelated assets remain byte-identical.

## Key technical decisions
- New fighter stats remain provisional Marco copies for user tuning; existing balance is unchanged.
- Art remains outside Git in R2. Sources, receipts and screenshots are in workspace outputs/roster-expansion-v1.
- Visual checks use production scenes and deterministic frame stepping for pose/reveal inspection, not a performance benchmark. Temporary QA controls were removed.

## Open questions
- User will tune Tyke and Dragon stats later.
- PR merge awaits user approval.

## Known issues
- Build retains existing large Phaser chunk and locale import warnings.
- No live code deployment performed by this handoff.

## Next proposed step
Review and approve PR274. Typecheck, production build and seven focused shop, roster, localisation, limb, geometry, palette and reward reveal checks pass. Brave checks covered eight-direction poses, actual combat, Kunoichi selection, reward reveals, daily chest locks and landscape phone layouts without console errors.
