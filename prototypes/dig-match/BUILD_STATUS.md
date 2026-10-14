## Current milestone

BRIEF.md drafted and waiting for approval. No game code yet.

## What was implemented

- Nothing playable. `packages/dig-kit` 0.1.0 was extracted from dice-dig for
  this prototype to reuse (pillow blocks, cracks, sounds, button, intent bus,
  tune panel, RNG).
- `prototypes/dig-match/BRIEF.md` (draft).

## Key technical decisions

- dig-match will pin `dig-kit` to exactly 0.1.0.
- Deploys are manual (`.github/workflows/deploy-dig-itch.yml`), so the user
  decides which build goes live on itch.

## Open questions

- Gravity direction (proposed: down). BRIEF.md covers this and tap-to-collect.
- BRIEF.md was written from a discussion, not from a user-written brief, so it
  may need updating once approved or changed.

## Known issues

None yet.

## Next proposed step

Approve or change BRIEF.md, then build scope step 1 (swap-and-match board and
feel pass).
