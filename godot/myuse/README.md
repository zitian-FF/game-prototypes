# Myuse Action Loop

A Godot 4.3 demo project: a procedurally rigged character plays a full
**idle → run → mid-air 360° spin → land → idle** loop on a timer.

No imported art is needed to run it — the character is drawn in code
(`scripts/myuse_rig.gd`) as a Node2D joint hierarchy (hips, knees, chest,
head, shoulders, elbows + a swaying hair mass), posed every physics frame
by `animate()`.

## Run it

Open the folder in Godot 4.3+ and press Play, or headless:

```
xvfb-run -a godot --path . --rendering-driver opengl3
```

Capture verification screenshots (saved to `captures/`):

```
xvfb-run -a godot --path . --rendering-driver opengl3 --quit-after 420 -- --capture
```

## Controls

`AUTO_DEMO = true` in `scripts/player.gd` plays the loop hands-free.
Set it to `false` for manual control: **A/D or arrow keys** to run,
**Space** to jump-spin.

## Files

- `scripts/myuse_rig.gd` — joint hierarchy + procedural poses per state.
  Joint names (`hip_n`, `knee_f`, `sh_n`, …) and the `animate()` contract are
  the stable interface; swap the drawing helpers for real sprites anytime.
- `scripts/player.gd` — CharacterBody2D, physics, state machine, demo driver.
- `scripts/main.gd` — scene assembly (sky, moon, hills, ground, camera).
- `scripts/capture.gd` — timed screenshot dumper for verification.
- Bonus artwork is preserved in the original downloaded ZIP and is not
  needed by this procedural demo or included in the repository.

## Retargeting your own art

Replace the `_limb()` / `_poly()` / `_circle()` calls in `myuse_rig.gd`
with `Sprite2D` nodes parented to the same joints, keeping each sprite's
pivot at its joint. The animation code doesn't care what the parts look like.

## GitHub Pages

The existing Pages workflow exports this project with official Godot 4.3
and the single-threaded web template into `dist/myuse/` after the Vite
build. Published URL: https://zitian-ff.github.io/game-prototypes/myuse/

Single-threaded export avoids requiring cross-origin isolation headers.
Canvas-item stretching preserves the 1280×720 scene on smaller screens.
The demo runs automatically and needs no keyboard or touch input.
