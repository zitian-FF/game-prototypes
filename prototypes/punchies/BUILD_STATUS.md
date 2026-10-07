## Current milestone
Title floor/ring perspective and layered props deployed as 071026r0069 via PR #232.

## What was implemented
Apply shared projected floor to title. Project its registered ring layers to the same vanishing point. Composite transparent gym_props.png around the perimeter, with menu and ring clear.

## Key technical decisions
Reuse registered ring art and shared projection function. Existing equipment retains its outlined style in a separate alpha layer, avoiding old floor seams. Added only loose/gym_props.png to the current R2 archive; public SHA256 verified as 171438d568c6a629bc1575382889c77589f9416c779261789fc7ece9ae6e97dc.
Typecheck/build passed; Brave desktop/phone title and training inspected without console errors.

## Open questions
None.

## Known issues
Canvas fallback retains authored floor perspective. Real-device and two-phone online tests pending.

## Next proposed step
Publish responsive props fit: contain scaling keeps equipment visible in taller windows. Taller-window Brave title inspected without errors.
