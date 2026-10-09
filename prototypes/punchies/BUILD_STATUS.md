## Current milestone
Character selection chrome refreshed and verified locally; awaiting review.

## What was implemented
- Replaced full-width gold roster border with a compact recessed navy shelf that hugs short rosters and retains the long scrolling row for larger rosters.
- Player selection borders use blue/red highlights; roster labels use matching navy material.
- Replaced spiky VS burst with an enamel matchup emblem, subtle blue/red rim, bevel and soft shadow.
- Added gentle 2.5% VS pulse using existing menu timing, disabled for reduced motion and cleaned up on scene shutdown.

## Key technical decisions
- Native Phaser graphics keep the emblem sharp without additional image downloads.
- Selection state, ownership, skin controls and game balance remain unchanged.
- Separate selection-chrome branch stacks above the asset optimization branch.

## Open questions
- Pending user review and merge approval for the stacked changes.

## Known issues
- Existing build warnings for Phaser chunk size and locale imports remain.
- Changes are not deployed live.

## Next proposed step
Review the saved preview and merge after earlier roster/optimization changes. Typecheck, production build, roster and localisation tests pass. Brave landscape phone and default viewport screenshots inspected; selection highlights and controls work, with no console errors.
