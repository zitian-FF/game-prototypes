## Current milestone
FIGHT timing aligned with the locked round intro; validated for review.
## What was implemented
FIGHT plays for 260 ms during the end of the existing countdown, with a dedicated 80 ms fade. ROUND clears before it. Controls unlock and the bell sounds at the existing fight start tick.
## Key technical decisions
A cosmetic fightCue event precedes gameplay go. No extra round delay, no tuning changes to punches or movement, and KO fade remains unchanged.
## Open questions
Merge and deployment approval is pending.
## Known issues
The browser timing preview is still being verified. Automated frozen-input and online synchronization checks pass.
## Next proposed step
Review and merge the timing fix. Typecheck and full build pass.
