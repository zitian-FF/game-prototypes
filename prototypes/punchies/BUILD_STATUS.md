## Current milestone
Approved HUD and presentation released as r0083; training toolbar clearance follow-up ready.

## What was implemented
Integrated swept HP/STM/STUN bars, hexagonal timer, diamond round-win sockets, names beside STM, uppercut stars and pulsing UPPER over dimmed full-charge sockets. Improved clash, FIGHT and italic clipping. Training controls move to the left sidebar to clear the new HUD.

## Key technical decisions
Phaser canvas; no new art or dependencies. Pulse is tunable and reduced motion uses a steady label. Preserve combat and deterministic round timing. PR #246 merged and itch deployment succeeded.

## Open questions
None for the approved release.

## Known issues
Physical two-device and phone/controller checks remain pending. Existing Phaser bundle warning remains.

## Next proposed step
Publish training toolbar clearance and verify the live release.
