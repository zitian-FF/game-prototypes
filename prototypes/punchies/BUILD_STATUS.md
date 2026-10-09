## Current milestone
CrazyGames is the default portal for both asset-profile commands and CI.

## What was implemented
Standard and compact commands now default to CrazyGames; explicit portal overrides remain available. Push-triggered CI uses CrazyGames too. Standard and compact builds share one codebase and support web, CrazyGames, Poki and Playgama with separate verified assets and root entry points. Both profiles and their parity checks passed CI; standard WIP deployed successfully. Art production now has a single standard in art/PRODUCTION_STANDARD.md, linked from the art README and repository agent instructions. It covers lossless masters, source lineage, stable registration, palette reuse, encoder settings, regeneration, byte budgets and review evidence.

- Release plan section 8 specifies progression (Boxer Level, daily XP cap, milestone chest vouchers, earn-only Veteran skins, titles), the profile screen and alias, and titles shown in online fights. Not built yet.

- Progression logic (PR 1): Boxer Level, XP rules with a hard daily cap, milestone chest vouchers (free skin chest every 5 levels, free fighter chest every 10), titles by level, earn-only Veteran skin rewards (skipped until the items exist). Awarded at the end of vs AI, online, local VS and the first fight; the result is placed in the scene registry as `lastAward` for the result screen. No screens yet (Codex builds them). The Shop's free chest flag became counts (`freeSkinChests`, `freeFighterChests`, old save migrates).

- Profile and alias logic (PR 2): alias rules and storage, generated default, platform name hook, `localWireProfile`, validated peer profile on the online hello (`NetSession.peer`), `sideProfiles`. No screens yet. Offensive word list is empty. The online hello was not exercised between two real devices.

## Key technical decisions
Standard portraits fit within 1280px at WebP Q90; compact portraits fit within 768px at Q78, with backgrounds/ring layers within 960px at Q72. Fighter parts remain byte-identical and atlases preserve geometry. Both profiles retain all fighters, unique skins and 21 palette skins. Standard music is 128 kbps MP3; compact music is full-length 64 kbps AAC stereo 44.1kHz. Hard package budgets are 20 MB / 10 MB; portrait production targets are 200 KB / 100 KB with an existing hard limit below 1 MB. Isolated builds measure about 16.15 MB / 9.44 MB. New approved art must update the lossless archive and both prepared profiles, with SHA-256 inventories and current source identity.

## Open questions
No new creative decisions. Four forthcoming portrait-only designs remain outside the current runtime builds pending approval and integration. Pixel-art conversion is not part of the compression standard.

## Known issues
Compact deliberately loses fine detail. Brave rendering/playback and mock portal checks passed; other browser engines, live portal submission and multiplayer peers were not tested. Decoder success does not replace a listening review for new audio. Existing pending unique reward artwork and Vite locale/chunk warnings remain.

## Next proposed step
Apply the production standard to the next approved art delivery: archive masters, regenerate both profiles, verify source hashes, check visuals and report category sizes and remaining budget headroom.
