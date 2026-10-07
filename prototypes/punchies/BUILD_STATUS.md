## Current milestone
Round-start zoom deployed and verified on itch.io as 071026r0066 via PR #229.

## What was implemented
- 900 ms smoothstep camera presentation at first fight draw and training Reset.
- Final top outer red rope sits 3% below the top UI strip; lowest opaque steps pixel sits 5% above screen bottom. Master anchors y110/y1131 verified from source alpha.
- Ring-world elements and gym backdrop move together; UI remains fixed. Authored ring aspect preserved.
- Zoom duration exposed in tune metadata. Reduced-motion jumps to final framing.

## Key technical decisions
- Presentation-only transform; no simulation timing, combat geometry or networking changes.
- Restart detection limited to initial draw or tick reset near zero; ordinary corrections do not replay the opening.
- Source art reused without R2 changes.
- Typecheck/build passed; Brave final framing inspected without console errors. Reset opening/reference and settled frames inspected. Live Brave training framing inspected with full steps visible and no console errors; deployment run 37581999065 succeeded.

## Open questions
None blocking this update.

## Known issues
Real-device and two-phone online checks pending. Existing Canvas gym shader limitation remains.

## Next proposed step
Round-opening zoom complete. Continue remaining approved art direction work when requested.
