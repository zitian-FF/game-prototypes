## Current milestone
Two-part training dummy with independent impact shake.

## What was implemented
- New overhead padded tan dummy body and head, separate alpha sprites in R2.
- TrainingDummy renderer overlaps the neck connection and draws no limbs.
- Head hits shake the head; body hits and blocks shake the torso, including absorbed hits.
- Seven presentation controls under view.trainingDummy expose sizes, head overlap, shake duration/frequency/displacement/angle.

## Key technical decisions
- Hit-zone routing uses the existing vulnerable/head and normal/body hit rows. No gameplay tuning, hitbox, stance or netcode changes.
- High Guard retains existing blocking behavior without glove sprites; the training stance label remains its indicator.
- Oscillation decays over 300 ms and only changes sprite transforms; ground shadow and fighter position stay fixed.
- R2 main bundle retains every existing entry and adds two small WebP sprites. Verified upload/download SHA-256: 59AD5C48BE61BDD111FB2FC99A182EE3FB8B5F3052F7DB7C7A33228EA545401C.

## Open questions
- Owner review of the dummy proportions and shake strength at play size.

## Known issues
- Real phone and online matches were not tested. Legacy art remains the fallback if new dummy textures are unavailable.

## Next proposed step
Play the new dummy in training and adjust View > view.trainingDummy if desired. Typecheck/build passed; Brave at 844x390 loaded the new dummy without errors. Controlled renderer assertions passed for finite idle transforms, independent head/body reactions, settling after shake duration, and unchanged fighter state.
