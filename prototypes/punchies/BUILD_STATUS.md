## Current milestone
Restore the gym floor perspective to the annotated reference, deployed as 071026r0067 via PR #230.

## What was implemented
Neutral floor projection preserves the source artwork's converging tile columns. Existing round zoom and steps-inclusive ring framing remain.

## Key technical decisions
Bypass the floor shader at neutral values, avoiding extra overscan and flattening. Reuse existing R2 art.
Typecheck, build and Brave local gameplay screenshot passed; console errors absent. Live Brave training view verified with restored convergence and no console errors; deployment run 37583459052 succeeded.

## Open questions
None.

## Known issues
Real-device and two-phone online checks remain pending; this change is presentation only.

## Next proposed step
Floor correction complete; continue remaining approved art direction tasks when requested.
