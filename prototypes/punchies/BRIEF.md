# Punchies - BRIEF

Top-down 2D boxing game for mobile landscape with touch controls. Online
1v1 PvP (lockstep over the repo's Trystero networking) plus a training
dummy for solo testing. This file combines the original handoff with the
decisions made in the planning round (2026-09-29).

## Scope
- Online 1v1 PvP. No AI opponent.
- Training dummy: static, toggle between idle and holding High Guard.
- One default character (orthodox stance).
- Out of scope: progression, cosmetics, extra characters, southpaw, AI
  difficulties.

## Controls (landscape, MOBA-style)
- Left: floating virtual joystick for movement. Boxer always faces the
  opponent.
- Right: main button split in two halves (left = Jab, right = Cross; each
  tap fires exactly the half touched), with arc buttons:
  - Hook: one button, alternates left/right automatically (cosmetic). The
    close-range tool: short reach but almost no jammed (early sour)
    window, and it chips damage through High Guard (anti-turtle). A
    Perfect Guard still negates it.
  - Guard: hold for High Guard.
  - Dodge: direction from joystick; neutral stick = backstep.
  - Uppercut: dedicated button that doubles as the Star Power meter.

## Punch frames
Startup -> Early Sour (active, fist extending) -> Sweet (active, full
extension) -> Late Sour (active) -> Recovery. Active frames are continuous
(no gaps). The fist travels outward during Early Sour; touching the outer
hurtbox doesn't stop it, and the hit resolves when the fist reaches the
core or full extension. The resolving frame decides sweet vs sour; whether
it reached the core decides the Normal vs Vulnerable row. A whiff adds
per-punch whiff recovery frames (punish window). All frame data, reach, damage
and stamina cost live in tune.json. Jab fastest/lightest/long reach; Cross
slowest/heaviest/long reach; Hook medium speed, moderate damage, shorter
reach.

## Defensive states
- Normal: idle/moving. Circle hurtbox with a smaller core inside it. The
  core is the FACE: a hit that reaches it uses the Vulnerable row (full
  damage on sweet); a hit that only reaches the outer ring (arms/body) uses
  the Normal row. (Changed 2026-09-29: the original handoff described the
  core as a reduced-damage zone.)
- Vulnerable: punch startup and recovery (including whiff recovery; not
  the active frames), dodge tail + post-dodge window, stunned, empty
  stamina. Core removed, hurtbox enlarged; every hit uses the Vulnerable
  row.
- High Guard: blocks, drains stamina while held. Zero damage always.
- Perfect Guard: hit lands within the first few frames of Guard. Applies
  to sweet and sour hits. Defender recovers stamina; attacker stunned.
- Dodge: i-frames, then a brief Vulnerable window.
- Punch hitboxes extend forward from the facing direction. No directional
  armour.

## Hit resolution
| Scenario | Stamina | Damage |
|---|---|---|
| Sweet vs High Guard | Both lose | None |
| Sour vs High Guard | Attacker loses | None |
| Sweet vs Normal | Defender loses | Reduced |
| Sour vs Normal | Both lose | None |
| Sweet vs Vulnerable | Defender loses | Full |
| Sour vs Vulnerable | Defender loses | Reduced |
| Any vs Perfect Guard | Attacker stunned; defender recovers | None |

## Counters
- Cross or Hook connecting during the opponent's Startup = counter: 1.5x
  damage, +1 Star total (not stacked with the sweet-hit star).
- Jab on Startup = normal hit that interrupts. Uppercut is never a counter.
- Distinct flash and sound.

## Star Power / Uppercut
- Sweet hits grant +1 star (not vs High Guard).
- Chain breaks (stars reset) when the player gets hit, whiffs, or lands a
  punch blocked by High Guard. No time decay.
- At 3 stars Uppercut is active: near-instant startup, hook reach, 2x sweet
  Cross damage, cannot be blocked or Perfect Guarded, can be dodged.
- Whiff: stars consumed and a long Vulnerable recovery.

## Stamina, Health, Stun, Fatigue
- Stamina spent by attacking, dodging, holding Guard. Moderate regen when
  not attacking, fastest with no input. Zero = forced Vulnerable.
- Health zero = KO (win condition).
- Stun meter builds from direct hits taken and from attacking into Perfect
  Guard; decays otherwise. Over threshold = stunned for base + overflow.
  Stunned: forced Vulnerable, cannot attack, can move/dodge with slower
  recovery. Meter resets when stun ends.
- Fatigue: repeating a punch type builds that type's counter (decays over
  time), reducing speed, recovery speed and damage.

## Training
- Dummy is static; a button cycles its stance: Normal, High Guard,
  Vulnerable. Its HP never refills until RESET.
- "i" button toggles the hitbox overlay plus a hit/hurt box table
  (frame data, hit table). Does not pause.

## Online
- 3-character room code; host screen shows the code, a QR code and a
  `?room=CODE` link that joins directly.

## Arena
Square ring (310x310 logical px).

## Match
Single 99-second round. KO wins; on timeout higher health percentage wins,
tie = draw.

## UI
All in-match elements (touch controls, health/stamina/stun meters, star
meter, fatigue indicator, timer) are drawn in the Phaser canvas. No React
or Tailwind. Lobby, menus and results follow current pipeline conventions
(confirm with the user before building them).

## Networking
Lockstep with input delay for v1 (rollback is a follow-up). Show a small
"waiting for opponent" indicator during stalls. The lockstep layer lives
inside this prototype, not a shared package.
