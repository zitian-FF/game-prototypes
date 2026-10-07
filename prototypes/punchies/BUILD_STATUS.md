## Current milestone
Stamina follow-up implemented and tested locally; publication blocked awaiting explicit authorization.

## What was implemented
Punches no longer require sufficient positive stamina: they spend the remainder and enter emergency at zero. Emergency recovers at standing-still speed instead of walking speed. All four punch costs, dodge cost and guard drain increased by 20%. Tutorial/info text updated.

## Key technical decisions
Character cost and regeneration modifiers remain intact. Emergency remains protected until full with half damage and disabled guard/dodge. Positive insufficient stamina still rejects dodge. Incoming stamina damage and hit penalties are unchanged.

## Open questions
None.

## Known issues
Physical two-device online and phone/controller tests remain pending. Existing Phaser bundle warning remains.

## Next proposed step
Typecheck, production build, all-character emergency/low-stamina punches, exact 20% costs, geometry and series regressions passed. Brave local boot screenshot inspected with no console errors. Automatic approval review rejected pushing the new payload to the public repository; explicit approval was requested. Live remains r0078. After approval, push, merge and verify deployment.
