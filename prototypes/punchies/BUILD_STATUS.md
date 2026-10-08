## Current milestone
Colourful UI and shared punching logo ready for review on the unpublished shop branch. Earlier QA fixes remain live via PR 248.

## What was implemented

Latest shop polish: removed glove overlays from all three chests (tokens retain the shared glove), added explicit [i] buttons for skin/fighter pull-odds bubbles, and slow rotating rays behind paid chests. Reduced motion keeps rays static. Pink continuous HP remains in this unpublished draft. Typecheck, build, shop model checks and Brave popup/visual checks pass; no console errors.
Light-blue ad chest, purple skin chest and gold fighter chest use one canonical red glove logo without the star. Token and chest base PNGs are blank; punchMark stamps the same logo asset on all of them. Menu, shop, fight buttons and character selection use bright enamel colours, thick outlines, bevels, lower extrusion and subtle grain. Selection stats and integrated pink HP meter are continuous, without segments. Daily chest limits, odds and reward popups remain functional.

## Key technical decisions
All transparent raster assets are stored in R2; latest public bundle verified byte-for-byte. Existing art preserved. Shared UI chrome is rendered in Phaser. Gameplay, hitboxes, selection slide behaviour, stamina rules and reward pricing are unchanged. Local preview saves remain separate from production saves. Branch proto/punchies/shop-pulls-draft remains unpushed and unpublished.

## Open questions
Review the new visual direction, fourth fighter identity and final skin portraits/rigs. Daily ad cap and UTC reset remain configurable.

## Known issues
Real ads, secure production wallet, gameplay equip flow and ranked backend remain pending. Reward art/stats are placeholders. Physical device/controller and two-device network tests remain pending. Existing Phaser bundle warning remains.

## Next proposed step
Review the shop, character selection and HP screenshots before merging this draft.
