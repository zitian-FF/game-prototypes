## Current milestone
Correct overhead dummy art, wooden guard poses, and continuous zero-HP training.

## What was implemented
- Replaced the dummy head/body textures: the head no longer has a sideways neck connector.
- Added mirrored wooden gloves on articulated wooden arms, with smooth Normal / High Guard / Vulnerable transitions; vulnerable and stunned arms hang down.
- Training opts out of match-end detection. HP clamps at zero, punches continue, and no automatic reset or KO event/sound occurs.
- Added glove/arm/pose controls under view.trainingDummy; existing tuning values are preserved.

## Key technical decisions
- The neck attaches beneath the head in the overhead view. Raw parts remain separate alpha images in R2.
- Only Training calls step with finishMatch=false; ordinary matches retain default KO/result behavior and state schema.
- Impact sounds remain enabled; suppressing KO events prevents defeat audio. Manual RESET still works.
- Head/body impact shake remains separate; the wooden arms follow the body layer.

## Open questions
- Owner was asked whether all impact sounds should be muted; default used is to retain impact sounds and suppress KO sounds only.

## Known issues
- No real-phone or online-match verification in this pass.

## Next proposed step
Review the dummy poses at play size. Typecheck and build passed. Brave renderer review showed all three poses without errors; simulation assertions verified continued ticks/hits at zero HP, no KO/reset in training, and unchanged ordinary KO behavior.
