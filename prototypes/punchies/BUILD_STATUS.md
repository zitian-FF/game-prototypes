## Current milestone

Stun stars now circle the head in a true circle and are drawn with the art too. Next: a layered boxer (head, gloves, body, feet, round shadow) with a slight Y offset per layer for depth; waiting on the owner's go and on art.

## What was implemented

- `FighterView.drawStun`: three five-point stars orbit the boxer in a true circle (radius BODY_R + 4, scaled by the character), each also spinning on its own axis, drawn on an overlay above the body sprite. Used by both the art path and the procedural fallback.
- Before this, the stars only existed in the procedural fallback with a flat ellipse orbit, so with the art loaded there were no stun stars at all.
- Already merged this session: on-demand art loading with a loading bar, centered menu, ring perspective (`tune.view`), logo, quieter gym, tilted ring art, rounded labelled HUD, and the ground shadow plus separate feet layer (`render/groundLayer.ts`, `tune.view.shadow*` / `feetOffsetY`).

## Key technical decisions

- Presentation only: no change to `src/sim`, hitboxes or tuned gameplay values.
- The stars live in their own graphics overlay at depth 12 inside the perspective container, so they tilt with the ring and sit above the body (depth 10) and below the HUD.
- Orbit speed and radius are fixed in code for now (one lap about 2.6 s); they can move to `tune.view` if wanted.

## Open questions

- Layered boxer: body frames currently carry the head (helmet) and the gloves baked in. Separate head and glove layers need new art from Codex. Proposed order top to bottom: head, gloves, body, feet, round shadow, with head, body, feet and shadow each offset in Y. Unknown: whether gloves get an offset too, and the offset sizes (would be `tune.view` values).
- BRIEF.md does not mention the perspective, the shadow and feet layers, the logo or the stun stars; it may need a line.

## Known issues

- Checked in desktop Chromium via Playwright with a temporary low stun threshold and short start distance (not committed): stars circle the dummy's head, zero console errors. Not checked on a phone, in KO, Local VS or online.
- The KO shadow and feet (previous PR) are still not seen live.
- Real-phone networking and controllers unverified. Existing Phaser bundle-size warning.

## Next proposed step

Confirm the layering plan, then ask Codex for head, glove and body-only layers and wire the per-layer Y offsets.
