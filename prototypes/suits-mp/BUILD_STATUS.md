## Current milestone

Suits-mp room codes are three-character alphanumeric codes with lookalike characters excluded.

## What was implemented

- Changed code generation and validation from five characters to three.
- Removed 0/O, 1/I/L, 2/Z, 5/S, 6/G, and 8/B lookalikes from the allowed character set.
- Updated the join screen's copy, progress marks, and on-canvas keyboard; input stops at three characters.
- Validated invite-link codes before auto-joining and made the host check every candidate code before showing it.
- Updated the prototype brief to reflect the new code rule.

## Key technical decisions

- The 27-character alphabet permits 19,683 three-character codes. The host checks for an occupied code and retries up to five times.
- Invite links retain the published itch.io URL and use the shorter code.
- `npm run typecheck` and `npm run build` pass. Browser checks at 390x844 covered the join screen, allowed keyboard characters, three-character cap, valid/invalid codes, and a clear console.

## Open questions

- None for this change.

## Known issues

- Two hosts can still independently choose the same code after their initial occupancy checks. The shorter code space makes this more likely than before; the current Trystero room cannot re-check its code without disconnecting existing peers.

## Next proposed step

- Review the three-character code and invite flow on the deployed itch.io game with two devices.
