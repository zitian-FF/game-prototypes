## Current milestone
Approved presentation/HUD QA fixes deployed successfully via PR 248. Unpublished shop draft and ranked proposal ready for review.

## What was implemented
Tutorial upper sockets respect reveal stages, long player names fit and tutorial copy matches the new HUD. Local shop draft has a gifted one-token fixed fourth-fighter pull, separate fighter/skin costs, capped preview ad rewards, collection ownership and persistent preview balance. Skin cards show portrait and rig palette studies.

## Key technical decisions
Shop remains on proto/punchies/shop-pulls-draft and is not pushed or deployed. Costs and limits live in shop/draft-config.json. Local preview saves are isolated from gameplay saves. No ads, production unlocks or ranked services are connected. Ranked design proposal covers Bo3 outcome ratings, matchmaking, disconnects, settlement authority and leaderboard rules.

## Open questions
Review placeholder costs, daily cap/reset timezone, fourth fighter identity and art/stats, skin direction and no-duplicate draft policy.

## Known issues
Final shop art/equip flow, secure wallet and real ad integration are pending. Physical device/controller and two-device network fault testing remain pending. Existing Phaser bundle warning remains.

## Next proposed step
Review the shop draft and ranked proposal before implementing production economy or ranked backend.
