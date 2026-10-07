## Current milestone
Restore the gym floor perspective to the annotated reference, ready for deployment.

## What was implemented
Neutral floor projection preserves the source artwork's converging tile columns. Existing round zoom and steps-inclusive ring framing remain.

## Key technical decisions
Bypass the floor shader at neutral values, avoiding extra overscan and flattening. Reuse existing R2 art.
Typecheck, build and Brave local gameplay screenshot passed; console errors absent.

## Open questions
None.

## Known issues
Real-device and two-phone online checks remain pending; this change is presentation only.

## Next proposed step
Merge and deploy the floor correction, then verify the live framing.
