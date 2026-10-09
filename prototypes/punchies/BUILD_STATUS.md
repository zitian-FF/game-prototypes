## Current milestone
Independent standard and compact asset profiles for Punchies portal builds.

## What was implemented
One codebase builds either profile for web, CrazyGames, Poki or Playgama. Separate staging folders, prepared R2 archives, SHA-256 checks and output directories prevent profile mixing. Standard retains current art and MP3 music; compact uses smaller portraits/backgrounds and full-length AAC music. A CI matrix saves both builds and verifies content parity. Existing 21 palette skins, unique skins, fighters and gameplay are retained.

## Key technical decisions
Compact portraits fit within 768px at WebP Q78; backgrounds and all ring layers fit within 960px at Q72. Already-small fighter parts remain byte-identical for registration and palette masks. Atlases keep frame geometry; lossy output is used only when smaller. Music is AAC 64kbps stereo 44.1kHz, with the original full duration. Budgets are 20 MB standard and 10 MB compact. Isolated builds measure about 16.15 MB / 9.44 MB. The standard WIP workflow remains standard. Portal selection is separate from asset profile. Compact fails if its recorded standard-source art ETag or music hash becomes outdated.

## Open questions
No new creative or gameplay decisions. Four forthcoming portrait-only designs remain outside these builds pending approval and integration.

## Known issues
Compact textures deliberately lose fine detail. Browser playback and rendering were checked in Brave; other portal integrations use existing mock checks, without a live portal submission or multiplayer peer. Existing pending unique reward artwork is unchanged. Normal Vite locale/chunk warnings remain.

## Next proposed step
Use the compact CI artifact for portal submission after listening/visual review. Regenerate compact archives from original masters whenever approved standard assets change, then update source identity and archive checksums together.
