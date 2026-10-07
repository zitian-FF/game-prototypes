## Current milestone
Stamina follow-up shipped in r0079 through merged PR #242 (282d1416).

## What was implemented
Punches no longer require sufficient positive stamina: they spend the remainder and enter emergency at zero. Emergency recovers at standing-still speed instead of walking speed. All four punch costs, dodge cost and guard drain increased by 20%. Tutorial/info text updated.

## Key technical decisions
Character cost and regeneration modifiers remain intact. Emergency remains protected until full with half damage and disabled guard/dodge. Positive insufficient stamina still rejects dodge. Incoming stamina damage and hit penalties are unchanged.

## Open questions
None.

## Known issues
Physical two-device online and phone/controller tests remain pending. Existing Phaser bundle warning remains.

## Next proposed step
Typecheck, production build, all-character emergency/low-stamina punches, exact 20% costs, geometry and series regressions passed. Brave local boot screenshot inspected with no console errors. User authorized publication. Deployment succeeded; Brave confirms live r0079 boots with no console errors. Next: playtest punch access, faster emergency recovery and increased costs.
