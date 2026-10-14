## Current milestone
CrazyGames 5+6 roster UI ready for shared edition integration.

## What was implemented
CG-only centered two-row selector, larger touch targets, row navigation and aspect-correct headshots. Master roster and shared portrait/skin/confirmation behavior retained.

## Key technical decisions
Build owns edition.ts and manifest-ordered CHARACTER_IDS. UI gates on CRAZYGAMES_EDITION; no portal or URL inference and no second allowlist.

## Open questions
None for the grid contract. Community key-art visual review remains independent.

## Known issues
No actual CG release/package, physical Xbox or two-device test claimed. Focused helpers and local Brave fixture validated. Build validates the complete edition artifact.

## Next proposed step
Build integrates this small UI commit with its authoritative edition source and packages/stages the completed CrazyGames edition.
