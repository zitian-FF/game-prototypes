## Current milestone
Punchies active asset cleanup and conservative 20 MB package budget

## What was implemented
Archived full-quality art, original audio and historical parts to verified Google Drive backups. Replaced the active R2 art/audio ZIPs with inventoried, hash-verified cleaned sources. Retained all seven fighters, McClassic and Flaming Kunoichi, palette recolours, registered ring layers and reachable fallbacks/effects. Added persistent mirror aliases, lossless WebP atlases and a CI package budget gate. Deleted the backed-up historical parts ZIP from R2 after owner approval; the dashboard confirmed success.

- Settings has RESET SAVE (two confirmations, wipes all saved keys, reloads); with ?debug=1 the Shop has a DEBUG: 99 TOKENS button.

## Key technical decisions
Drive archive: https://drive.google.com/drive/folders/14OJLKjyM0pDSUxsb_vDDkFtMYRqZuj02 . Active art ZIP 9,876,345 bytes; active audio ZIP 8,304,732 bytes. Full WIP package 16.50 MB versus 30.28 MB original. Portraits are at most 1280px and under 1 MB; largest current portrait 186,414 bytes. Atlas pixels and ring registration remain lossless. Music retains full duration, stereo and 44.1kHz, encoded at 128kbps. No tune, skin design or simulation changes.

## Open questions
None for the cleanup scope.

## Known issues
Existing draft unique rewards Rising Star, Ring Captain and Old Champ still have pending artwork; they were not replaced or fabricated. Online multiplayer behavior was covered by existing mock-based checks, not a live peer session. CrazyGames' 20 MB threshold is mobile initial download; the new guard conservatively covers the entire shipped package.

## Next proposed step
Retain the verified Drive archive. Keep the package budget gate in the WIP deployment workflow for subsequent content additions.
