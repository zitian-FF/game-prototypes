## Current milestone
Restore full-window itch launch and match gameplay ring to the approved title master.

## What was implemented
- Restored itch.io Click to launch in fullscreen and Landscape settings; persisted values checked after reload and Run game checked in Brave.
- Gameplay now uses the same five full registered alpha layers as the title, including red/blue post bases, apron and steps. Removed the gameplay-only rope/cap reconstruction.
- Fits the whole ring, fighters and effects below the HUD, restoring the artwork aspect without a second perspective warp. Simulation, combat tuning and netcode unchanged.

## Key technical decisions
- Presentation transform maps the fixed simulation floor to the authored floor, keeping rendered fighters and hit effects aligned.
- HUD and controls stay at their existing screen positions. Far ropes remain behind fighters, near ropes/apron in front.
- The complete ring also uses a world container under Canvas renderer; procedural fallback retains the existing WebGL perspective behavior.
- Typecheck and build passed. Brave phone-layout training screenshot inspected; no console errors. R2 art unchanged.
- No relevant newer shared-package change applies.

## Open questions
None blocking this fix.

## Known issues
Real-phone/two-phone online checks pending. Character-select and combat/KO presentation follow-ups remain separate.

## Next proposed step
Merge and verify the published ring fix, then resume the remaining art direction work.
