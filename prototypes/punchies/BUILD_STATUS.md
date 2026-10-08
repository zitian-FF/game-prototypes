## Current milestone
Approved presentation/HUD QA fixes deployed successfully via PR 248. Unpublished shop draft and ranked proposal ready for review.

## What was implemented
Tutorial upper sockets respect reveal stages, long player names fit and tutorial copy matches the new HUD. Local shop draft now uses three columns: ad reward 1 token, three daily skins at 5 tokens each, and one daily fighter at 10 tokens. Offers stay fixed after purchasing and exclude owned items at the next UTC rotation. Palette and unique skins have separate metadata, with unique portrait and rig art pending. The gifted-token welcome introduction and persistent isolated preview balance remain.

## Key technical decisions
Shop remains on proto/punchies/shop-pulls-draft and is not pushed or deployed. Costs and limits live in shop/draft-config.json. Local preview saves are isolated from gameplay saves. No ads, production unlocks or ranked services are connected. Ranked design proposal covers Bo3 outcome ratings, matchmaking, disconnects, settlement authority and leaderboard rules.

## Open questions
Review daily cap/reset timezone, fourth fighter identity and art/stats, and palette/unique skin art direction.

## Known issues
Final shop art/equip flow, secure wallet and real ad integration are pending. Physical device/controller and two-device network fault testing remain pending. Existing Phaser bundle warning remains.

## Next proposed step
Review the shop draft and ranked proposal before implementing production economy or ranked backend.
