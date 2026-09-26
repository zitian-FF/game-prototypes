## Current milestone

Layered title art has been added to the landing screen.

## What was implemented

- Added a blue-black cosmic mineral background and a separately moving moon, each compressed to WebP.
- Added independent faint orbital-circle and drifting dust layers using Phaser graphics.
- Kept the approved logo and button artwork unchanged and revealed the title art behind the landing controls.
- Added reduced-motion and hidden-page handling for title animation.

## Key technical decisions

- The two new image assets total about 30 KB and are imported through Vite so they ship with the game build. BootScene loads them before the landing screen.
- The motion layers are drawn once and animated with transforms. Their periods and travel distances live in tune.json.
- Typecheck and production build passed. A 390x844 browser screenshot was inspected and the browser reported no errors.

## Open questions

- None.

## Known issues

- The image-generated background is a flattened plate; its distant built-in celestial details remain static. The foreground moon, orbit, and dust are independently animated.

## Next proposed step

- Review the title composition on the deployed itch.io build and tune the layer positions or motion if needed.
