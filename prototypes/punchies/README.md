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
Every tunable lives in `tune.json`: frame data per punch (startup, sourEarly,
sweet, sour, recovery, whiffRecovery, reach, hitRadius, damage, staminaCost, staminaDamage,
stunBuild), hit table multipliers, guard, dodge, stamina, stun, stars,
fatigue, ring bounds (square), punchStartReachFrac, joystick, match length and training options.

Open with `?debug=1` for the Tweakpane panel: edit any value live, toggle
the hitbox overlay (green = hurtbox, blue = core, yellow/orange = sweet/sour
punch hitbox), and "Copy JSON" to paste back into `tune.json`.

## Known issues
- Placeholder art (circles) and synthesised placeholder sounds.
- If the device can't hold 60 fps, the sim runs slower than real time
  instead of skipping ticks (max 5 catch-up ticks per frame).
- See BUILD_STATUS.md for open rule questions.
