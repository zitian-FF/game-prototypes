## Current milestone
User approved merging the colourful UI, daily shop preview and pause/forfeit menu into the live WIP. Release validation and deployment are in progress. Earlier QA fixes remain included.

## What was implemented

Latest shop polish: all chest glove overlays removed; tokens retain the canonical glove. Chest artwork opens rewards/odds without extra [i] buttons. Slow rotating rays remain behind paid chests, static with reduced motion. Continuous pink HP remains.
Combat buttons and joystick now use solid enamel colours, thick outlines, highlight rims and extrusion. Debug/sync/fullscreen controls removed. A top-left hamburger opens Settings, red Return to Main Menu and Resume. Return requires confirmation. Solo scenes pause; multiplayer remains live with neutral local input while menus are open. Confirmed online exits send a forfeit before disconnecting; peers receive victory, including between rounds. Held touch inputs clear on opening.

## Key technical decisions
All transparent raster assets are stored in R2; latest public bundle verified byte-for-byte. Existing art preserved. Shared UI chrome is rendered in Phaser. Hitboxes, selection slide behaviour, stamina rules and reward pricing are unchanged. Menu is a separate foreground Phaser scene; solo scenes pause, multiplayer simulation/network continue. Local preview saves remain separate from production saves. User authorized publishing proto/punchies/shop-pulls-draft through the main branch and existing itch.io workflow.

## Open questions
Review the new visual direction, fourth fighter identity and final skin portraits/rigs. Daily ad cap and UTC reset remain configurable.

## Known issues
Real ads, secure production wallet, gameplay equip flow and ranked backend remain pending. Reward art/stats are placeholders. Physical device/controller and two-device network tests remain pending. Pause/resume, Settings, cancel and confirmed return were checked in Brave; automated menu lifecycle, shop and series checks pass. Existing Phaser bundle warning remains.

## Next proposed step
Verify the deployed version, shop and confirmed in-game return flow.
