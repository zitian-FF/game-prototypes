## Current milestone

Ring perspective trial: the ring is drawn with a slight tilt while the sim arena stays a flat square.

## What was implemented

- `render/perspective.ts`: the ring floor, ropes, posts, boxers, KO animation, hit effects and P1/P2 tags are gathered into one container drawn through a keystone shader (far edge narrower, picture vertically squashed). HUD, buttons, touch controls and screen-space overlays stay flat.
- `tune.view`: `perspective` (1 / 0), `topScale` (0.90, far edge width relative to the near edge) and `squash` (0.85). Panel category "View", live in `?debug=1`. Set `perspective` to 0 to turn it off.
- Wired into `FightStage`, so Single Player, Local VS, Online, Training and Tutorial all get it.

## Key technical decisions

- Presentation only: no change to `src/sim`, hitboxes, reach, positions, input mapping or the hit-box overlay maths. Joystick up still moves along the flat world axis.
- A shader on one container warps everything at once (placeholder shapes and art alike) instead of projecting every draw call. Container children draw in list order, so the container is sorted by depth each frame.
- Hit effects spawned during a fight join the container when their depth is 60 to 75; depth 76 and above is treated as screen-space.
- WebGL only. The Canvas renderer has no post effects, so the ring simply stays flat there.
- The online host's tune is adopted by the guest for a match, so the host's `view` values apply to both screens.

## Open questions

- Is the strength right? Defaults are a first guess; tune `topScale` and `squash` by eye. Perspective makes vertical distances look shorter than they are (a vertical jab looks shorter than a horizontal one at the same real reach).
- BRIEF.md has no mention of perspective; it may need a line if this stays.

## Known issues

- Checked in a desktop Chromium via Playwright (Training, hits and a whiff popup, zero console errors). Not checked on a phone, in KO, online, or in Local VS.
- Existing Phaser bundle-size warning.

## Next proposed step

Play it, adjust the View values, then decide whether the perspective stays on by default.
