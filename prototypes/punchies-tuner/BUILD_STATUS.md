## Current milestone
Base raw-stat editor, version history, game-equivalent perceived stat preview and localised archetype editing implemented; PR remains open for review.

## What was implemented
- Five live coloured stat bars with Base at 80%, shared game formulas and a 100% cap.
- Archetype textbox with fixed localisation keys, persistent selective saves, conflict detection and English translation-sheet export.
- Base entry before the fighters, exposing raw core/punch/block/dodge stats without percentage comparisons.
- History tab and numbered timestamped revisions: initial v0 snapshot, then old/new values for every saved Base change.
- History persists in tune.json through local-file saves, exports and GitHub saves. No-op and fighter-only saves do not add Base versions.
- Tests for inheritance, history persistence, concurrent merges, failed saves, client history rewrite protection and future history-bearing game builds.
- Brave mock verification: v1 save, reload, v2 save, both revisions visibly retained, no console errors.

## Key technical decisions
- Base edits existing shared tune fields; every fighter continues to use its current multipliers/offsets. Base is not a playable fighter.
- Save generates history from actual latest file values after merge checks. GitHub retains its saved log rather than trusting client metadata.
- Exclude workshop metadata from simulation tune so future game rebuilds remain compatible.
- Existing loopback/credential protections remain; no live tune changes during development. PR auto-merge remains disabled.

## Open questions
None.

## Known issues
- External direct tune edits are not retroactively logged; GitHub still retains its separate commit audit trail.
- Native file picker permissions remain a manual check. File-save transactions are covered with mocks.
- Local companion is for a trusted PC only. Saved versions start with the first Base edit saved using the new workshop.

## Next proposed step
Review/merge the updated workshop PR, then use Base and History for real tuning saves.
