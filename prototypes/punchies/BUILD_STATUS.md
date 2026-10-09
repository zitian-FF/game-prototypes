## Current milestone
Roster expansion implemented in isolated branch; draft awaiting browser verification before merge.

## What was implemented
- Tyke Maison and Dragon replace daily fighter placeholders; ownership unlocks selection.
- Flaming Kunoichi added as unique Mia skin with separate portrait and full parts.
- Cyan Rush, Violet Resolve and Golden Veteran start locked and enter palette chest pool. Existing explicit acquisitions preserved; implicit free availability removed.
- New fighter tune entries and metadata use Marco values provisionally, with no existing balance changes. New fighter names/quotes have English fallback keys.
- Daily offers schema 4 refreshes stale offers once.
- Neckless torso parts, corrected Dragon portrait and glove backs, split cloth tails, normalized feet exported into R2. Additive upload preserved existing entries; public download SHA verified.
- Regression tests updated for acquisition, mirror skins and new character limb math. Windows paths normalized in localisation audit.

## Key technical decisions
- Reuse fighter-five/six placeholder positions with new stable fighter-tyke/fighter-dragon reward IDs.
- Skin palette rendering remains cosmetic; STARTER_SKINS list now identifies palette recipes only, never free ownership.
- Tyke body proportion 1.18, Dragon 1.0; shared render/simulation scaling preserved.
- No PNG or zip assets committed. Art is in existing R2 punchies_assets.zip; exported sources and receipt in workspace outputs/roster-expansion-v1.

## Open questions
- User will tune Tyke and Dragon stats later; current values are placeholders copied from Marco.

## Known issues
- Browser automation kernel fails at startup with Windows sandbox helper refresh error for both Brave and user-authorized Chrome. No browser screenshots, console boot check or live assembled-rig verification completed.
- Do not merge until visual checks confirm head/torso overlap, hands, feet and cloth animation at game scale.

## Next proposed step
Restore desktop browser automation, verify character selection / shop acquisition / actual combat rigs, then finalize PR and merge on approval.
