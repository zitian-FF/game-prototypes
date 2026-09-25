## Current milestone

Suits-mp prepares its packaged game assets during initial boot, before the landing or invite flow appears.

## What was implemented

- Added a Boot scene that loads the asset manifest and all current loose images before entering Landing or Connecting.
- Extended manifest loading to include packed atlases if the art pipeline adds them later.
- Removed the asset-loading progress screen from HostGame, PlayerGame, and Tutorial so starting a round does not launch a second texture load.
- Kept a simple Waiting for the host message in PlayerGame until its first masked state arrives.
- Moved load failure and retry handling to Boot.

## Key technical decisions

- The packaged manifest is the source of truth for startup assets. In the current build it lists 40 optimized images; boot also requests the manifest itself.
- `npm run typecheck` and `npm run build` pass. At 390x844, the browser loaded 41 asset requests before Landing, and that count stayed at 41 after entering Single Player and Tutorial. Screenshots were inspected and no page errors were observed.

## Open questions

- None for this change.

## Known issues

- The startup progress percentage can briefly move backward when the manifest finishes and adds its images to the loader queue. Loading now happens before the first playable screen.

## Next proposed step

- Review the initial loading experience on itch.io on a phone or slower connection.
