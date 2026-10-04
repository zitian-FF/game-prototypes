## Current milestone

Ground shadow and feet layers wired in, so the body reads as standing above the floor under the ring tilt. Builds on the merged logo, quieter perspective gym, tilted ring art and labelled HUD (PR #199).

## What was implemented

- `render/groundLayer.ts`: for each boxer, a code-drawn ground shadow (always falls the same way, whichever way the boxer faces) plus the separate `<body key>_feet` art layer, both drawn below the body. Used by `FighterView` and by `KoAnim` for the KO pose.
- Tune values in `tune.view` (panel folder "View", live in `?debug=1`): `shadowOffsetY` 8, `shadowAlpha` 0.3, `shadowSize` 1, `feetOffsetY` 5. The body stays at the sim position; only the shadow and feet are pushed down in screen Y.
- Earlier this session (already merged): per-character atlas groups with on-demand loading and a loading bar, centered menu, ring perspective (`tune.view.perspective`, `topScale`, `squash`), logo, quieter gym, tilted ring art with apron and turnbuckles, rounded labelled HUD.

## Key technical decisions

- Presentation only: no change to `src/sim`, hitboxes or tuned gameplay values. Hitboxes stay on the body.
- The procedural fallback (no art, or a missing feet frame) keeps its own drawn shadow and legs; the ground layer is hidden there. A missing `_feet` frame just skips the feet; the code shadow still draws.
- The shadow and feet sit at depth 9 / 8 inside the perspective container, so they tilt with the ring.
- The R2 bundle holds split bodies without baked shadow or feet, so the older fallback bodies no longer carry a shadow of their own.

## Open questions

- Are the offsets right? Defaults are a first guess; tune `shadowOffsetY`, `shadowSize` and `feetOffsetY` by eye.
- BRIEF.md does not mention the perspective, the shadow and feet layers, or the logo; it may need a line.

## Known issues

- Checked in desktop Chromium via Playwright (Training: idle, walk, punch; zero console errors). The KO shadow and feet were not exercised live: the KO path uses the same draw call but no KO was reached in the test run.
- Not checked on a phone, in Local VS, or online.
- The flying KO spins the body but the shadow just follows its path; it may look odd.
- Real-phone networking and controllers unverified. Existing Phaser bundle-size warning.

## Next proposed step

Play it, adjust the View values, then review the KO and check on a phone.
