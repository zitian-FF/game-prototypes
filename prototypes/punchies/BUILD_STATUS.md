## Current milestone
Approved combined compact release: Profile/Zombie UI, boss pressure and statistics, input navigation, and Tyke/Tee materials. Main cleared the polish hold after approved UI completion.

## What was implemented
Owned avatar selection persists without changing alias, titles, collection, or peer payload. Profile displays rating availability, XP and a passive 50-level ladder. Zombie entry preserves checkpoint confirmation; intermission/results display actual run partitions, damage, applied healing and personal best. Ordinary waves remain timed; bosses use actual scaled HP and end on defeat with bounded pressure progression. Hints follow meaningful last input and saved keys; touch editor handles/footer share one navigation layer. Tyke cuffs are hand-aware and Tee palettes protect hair, skin, red accents and highlights.

## Key technical decisions
Original owner dependencies973c24f/8b9da1/6c44f99/1599735/UI1609380 integrated atop materials/input and latestmain. Owner fixes address localization literals, avatar restart lifecycle and CJK wrapping. Compact/web AAC/M4A selected; source bitmaps/compression pins/tune.json/tune.meta.json/Worker unchanged. Final local package10,133,861bytes148files: art3,460,285 audio4,345,153 code2,328,423 under20,000,000. Inventory and geometry/part parity pass against preserved standard companion.

## Open questions
Physical Android, touchscreen/controller and mobile60fps validation unavailable. Controlled browser simulations validate transitions/presentation, not difficulty balance or played boss wins. KaiChen/proposed title-screen layout/Ranked followups excluded pending separate approvals.

## Known issues
Existing cold palette work remains a limitation. Browser avatar blank and CJK single-line shrink corrected/retested. QA uses real Brave WebGL production scenes with explicit fixture inputs/state injection; locale forced result transitions are layout evidence, not earned results. No new downloadable assets.

## Next proposed step
Merge/deploy one validated compact release; verify automatic version, exact CI bytes/profile, workflows and live itch boot. Publish consolidated receipt/screenshots and preserve material evidence/source/tuning constraints.
