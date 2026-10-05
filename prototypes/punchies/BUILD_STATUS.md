## Current milestone
Full-cost stamina rejection and independent dodge penalty / follow-up buff.

## What was implemented
- Unaffordable punches/dodges do not execute or remain buffered; empty stamina flashes red on both mirrored HUD bars.
- Dodge stamina cost 12 → 14.4; Hook base reach 35 → 28.
- Dodge penalty lasts 14 vulnerable frames, reduces walking speed by 60%, and blocks re-dodging.
- Follow-up damage buff lasts a separate six frames and is consumed by the first punch.

## Key technical decisions
- Rounded the requested 12 × 1.2 vulnerable frames to 14 whole simulation frames; existing stunned duration multiplier remains.
- Validate character-specific costs before changing stars, fatigue, punch hand or damage buff; reject even during hit-stop.
- Simulation emits staminaRejected; HUD owns the 300 ms presentation flash. New feel values have tune metadata.
- Buff timing starts with all six frames intact after dodge completion.

## Open questions
- Owner was offered six versus eight follow-up buff frames; used six for an immediate follow-up. BRIEF.md now records six and can be adjusted if requested.

## Known issues
- No real-phone or online-match verification in this pass.

## Next proposed step
Playtest the short follow-up window. Typecheck/build, comprehensive stamina/dodge simulation checks, and prior training regression passed. Brave reviewed the actual HUD's mirrored empty-area flashes and actual game boot with no console errors.
