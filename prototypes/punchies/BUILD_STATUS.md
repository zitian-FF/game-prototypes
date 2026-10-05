## Current milestone
Straight jab/cross arms, snappy hook arcs, uppercut flames and slower foot gait.

## What was implemented
- Jab/Cross striking elbows straighten during extension; glove cuffs align to the actual forearm axis.
- Both hook hands wind up outward, snap through mirrored arcs aligned with the sweet-contact point, follow through and retract smoothly.
- Uppercut flame covers the striking arm/glove with an outlined orange/yellow/cream core, flicker and embers; fades during recovery.
- Gait phase changed from 0.35 to 0.21 radians/pixel (40% slower); older art fallback walking also runs at 60% of its former cadence.
- Added tuning metadata for cadence, hook motion and flame presentation; documented the animation rules in BRIEF.md.

## Key technical decisions
- Reused existing approved character parts. No redraws or R2 asset changes are needed.
- Pure presentation math is separate from combat simulation. Contact point, reach, damage, movement speed and combat timing remain unchanged.
- Cuff placement and glove rotation share the same forearm axis; hook elbows remain bent while straight punches fully extend.
- Flames are drawn in the puppet effects layer above the striking glove and clear during recovery.

## Open questions
- None for this animation pass.

## Known issues
- No real-phone or two-peer online-match verification in this pass.

## Next proposed step
Playtest at normal speed. Limb checks cover all characters, straight arms/cuffs, mirrored hook arcs and recovery continuity, sweet-contact alignment, flame coverage/expiry, cadence and read-only presentation. Typecheck and production build passed. Brave reviewed actual existing character rigs at contact, hook sequence, live punches and walking, plus game boot without console errors.
