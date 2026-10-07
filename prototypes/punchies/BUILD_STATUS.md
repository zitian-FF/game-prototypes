## Current milestone
Approved integrated HUD and match presentation ready for release.

## What was implemented
Swept mirrored HP/STM/STUN bars around a clean hexagonal clock, diamond series sockets, unframed names beside shortened STM, and uppercut stars beside STUN with a dimmed-star pulsing UPPER overlay at full charge. Bottom-anchored portraits, gym-backed vibrating clash and oversized VS exit, KO-style FIGHT, and padded italic text.

## Key technical decisions
Phaser canvas only; no new art assets or dependencies. Upper pulse is tunable and steady under reduced motion. Preserve deterministic intro and combat timing. Ring fit clears the HUD. User approved publication on 2026-10-08.

## Open questions
None for this approved change.

## Known issues
Physical two-device online and phone/controller tests remain pending. Existing Phaser bundle warning remains.

## Next proposed step
Merge approved changes, verify itch deployment and live boot.
