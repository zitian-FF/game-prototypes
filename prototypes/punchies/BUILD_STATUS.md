## Current milestone
Punchies CrazyGames prepared for the explicitly approved itch Suits deployment; Punchies Master stays on staging.
## What was implemented
Complete CG11 edition and5+6 grid, Modern/Classic integration, separate save/cohort policy and a no-overwrite migration of existing itch saves into CG keys. Production flags exclude staging/QA controls. Existing reset epoch retained.
## Key technical decisions
Canonical editions: Punchies Master→staging; Punchies CrazyGames→zitian-ff/suits:html5; Punchies Beta→new Punchies - Beta Test page. Same source/prepared art; no extra CG staging route or new lossy compression. CI alone increments version after successful upload.
## Open questions
None blocks the authorized CG release.
## Known issues
Beta branch proto/punchies/free-community-preparation is local scaffolding, not a completed edition or public page. Actual CrazyGames portal ads/controller/iOS/two-device WebRTC are not verified by a desktop boot.
## Next proposed step
Deploy approved CG source to itch via the explicit once-only promotion workflow; confirm processing and actual live build. Keep Master staging pin1abdc04.
