## Current milestone

The landing title has independently animated art layers instead of a flattened celestial scene.

## What was implemented

- Replaced the old plate with a dark starfield and mineral floor that contain no baked planets or orbit lines.
- Added separate blue, violet, and ochre planet sprites; each has its own position, size, and drift period.
- Added an independently rotating occult circle, two drifting particle depths, and subtle floor glints.
- Kept the approved logo and buttons unchanged.
- Reduced-motion preference now lowers motion amplitude and removes glint pulsing while keeping the title gently alive; hidden pages pause updates.

## Key technical decisions

- The four runtime WebP title assets total about 44 KB; Phaser graphics layers are drawn once and moved by transform updates.
- All motion periods and distances are stored in tune.json.
- Typecheck and production build passed. Two mobile browser frames showed planetary and circle movement; browser warnings and errors were empty.

## Open questions

- None.

## Known issues

- None found in the local title preview.

## Next proposed step

- Review the title motion in the merged itch.io build on a phone.
