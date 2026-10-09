## Current milestone
Training roster flow and dummy portrait complete; verified locally and ready for review.

## What was implemented
- Main-menu and tutorial Training entries open player-only roster selection.
- Player selects an owned boxer and skin; the opponent is a fixed noninteractive dummy with a dedicated portrait.
- Training hides match format/difficulty controls and starts with the selected boxer/skin.
- Removed the in-training character selector; stance and reset remain.
- Dummy portrait created through CODEX Outsource's separate CLI workflow, inspected, alpha verified and uploaded to R2. Public bundle SHA matches and unrelated entries are unchanged.

## Key technical decisions
- Reuse the existing roster flow and ownership checks. The dummy never becomes a playable roster ID.
- Training selection persists P1 boxer/skin. Training validates ownership on entry.
- Portrait remains outside Git at loose/portrait_training_dummy.png in R2; build uses lossless optimization.
- Separate training-selection branch stacks above the earlier selection-chrome work.

## Open questions
- Pending user review and merge approval for stacked changes.

## Known issues
- Existing Phaser chunk size and locale import build warnings remain.
- Code is not deployed live. Tutorial route was inspected and compiled; browser testing exercised the main-menu route.

## Next proposed step
Review the training preview and merge after earlier changes. Typecheck/build, roster/training ownership handoff, localisation and pixel/alpha optimization checks pass. Brave confirmed the dummy cannot take focus, selected Mia enters Training, character button is absent and portrait placement is correct, with no console errors.
