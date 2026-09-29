# Punchies

Top-down boxing prototype. Menu: **Training** (you vs a static dummy),
**Host Online** (shows a 3-character room code + QR code) and **Join With
Code**. Opening the game with `?room=ABC` joins that room directly (that's
what the QR code encodes).

## Controls
Touch (landscape):
- Left half of the screen: floating joystick (touch anywhere to place it).
- Big split button: left half Jab, right half Cross.
- Arc buttons: Hook, Guard (hold), Dodge (direction from stick, neutral =
  backstep), Upper (lights up gold at 3 stars; the three dots are your
  Star Power).
- Red pips under JAB / CROSS / HOOK show that punch type's fatigue.
- Top centre (training): cycle the dummy's stance (Normal / High Guard /
  Vulnerable), RESET (the dummy's HP only refills on reset), MENU.
- "i" (top left): toggles the hitbox overlay and a frame-data / hit-table
  reference. The game keeps running.
- Online: a "waiting for opponent..." tag appears whenever the game is
  briefly held waiting for the other player's input (lockstep).

Keyboard (desktop testing): WASD / arrows move, J jab, K cross, L hook,
I uppercut, Space dodge, hold Shift to guard.

## HUD
Top bars per fighter: health (green, white trail = damage just taken),
stamina (blue, turns red when exhausted), stun meter (thin bar, yellow while
stunned). Timer shows `--` in training.

## Config
Every tunable lives in `tune.json`; `tune.meta.json` gives each one a
category, description and allowed range.

- **Built-in first:** the game always starts with the `tune.json` it was
  built with.
- **SYNC TUNE** (main menu, bottom right): fetches the latest `tune.json`
  from GitHub (`main` branch) for this session only, so you can edit it in
  GitHub's web editor and test without a new build. A broken or partial
  file is ignored value by value; the label shows what's loaded.
- **Online:** both players use the host's values for the match; the guest's
  own values come back afterwards.
- **`?debug=1`:** Tweakpane panel with every value grouped by category
  (Attack, Defense, HP & Stun, Stamina, Movement & Arena, Match & Online,
  Training) and section. Each value has a range-limited slider, a
  description, the value it started from ("was") and a reset link. "Copy
  JSON" copies everything to paste into `tune.json`.

## Fullscreen
The corner button goes fullscreen on Android and iPad. iPhone Safari
doesn't allow web pages to go fullscreen; the button explains "Share ->
Add to Home Screen" instead, which launches without browser bars (do it
from the game-only page, i.e. the QR-code link, not the itch.io page).

## Known issues
- Placeholder art (circles) and synthesised placeholder sounds.
- If the device can't hold 60 fps, the sim runs slower than real time
  instead of skipping ticks (max 5 catch-up ticks per frame).
- See BUILD_STATUS.md for open rule questions.
