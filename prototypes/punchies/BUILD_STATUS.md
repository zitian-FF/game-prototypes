## Current milestone
Readability and demo polish after the combat tuning pass: longer hit flashes, no hit or hurtbox rings in normal play, demo notice and credits on the main menu.

## What was implemented
- Hit flash length is now `view.flashMs` (260 ms, was a fixed 110 ms), with a Tweakpane slider. Head and torso still flash separately.
- Removed the red vulnerable ring around the boxer and the sweet/sour ring on the gloves in normal play (art, puppet and fallback drawing). The debug hitbox overlay (debug mode) is unchanged. The yellow power-up ring (dash buff or full stars) stays.
- Main menu: demo notice and credits, bottom left ("DEMO BUILD. Features, balance and art may change." / "Created and designed by ZeeTea." / "Built together with Claudia and G.P. Tea.").

## Key technical decisions
- Presentation only; sim and combat tuning untouched.
- Without the rings there is no on-screen cue for the vulnerable state or sweet/sour timing; a replacement indicator is proposed to the owner and not built yet.

## Open questions
- Which replacement cue for the vulnerable state (options sent to the owner)?
- The hub page (index.html) has no demo notice; the notice is on the Punchies main menu only.

## Known issues
- Not verified on a real phone.
- Bot spacing still needs a retune after the range changes (see previous pass).

## Next proposed step
Pick and build the vulnerable-state cue, then retune bot spacing.
