## Current milestone

Lobby invite links point to the published suits-mp itch.io page.

## What was implemented

- Added one invite URL helper in `src/net/lobbyCode.ts` and used it for the host lobby's Copy Link control.
- Removed an unused host-scene URL builder that still assembled links from the current page origin.

## Key technical decisions

- Invite links use `https://zitian-ff.itch.io/suits-mp?lobby=<code>` regardless of whether the host opened a local, GitHub Pages, or itch.io build.
- Room-code copying remains unchanged. `npm run typecheck` and `npm run build` pass; browser evaluation returned the itch.io URL for code `ABCDE`. A 390x844 browser screenshot was inspected, and no boot errors were reported.

## Open questions

- None for this fix.

## Known issues

- The canvas UI modal styling remains less detailed than the former CSS treatment. Multiplayer peer joining was not exercised in this local check.

## Next proposed step

- Review a copied invite from the deployed host lobby on a second device.
