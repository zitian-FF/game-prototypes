# Punchies - BRIEF

Top-down 2D boxing game for mobile landscape with touch controls. Online
1v1 PvP (rollback netcode over the repo's Trystero networking) plus a training
dummy for solo testing. This file combines the original handoff with the
decisions made in the planning round (2026-09-29).

## Scope
- Local VS: two players on one screen, each on their own input device
  (added 2026-09-30); an INPUT button next to it picks devices.
- Online 1v1 PvP, plus Single Player vs an easy AI (added 2026-09-30 at
  the user's request; previously out of scope).
- Training dummy: static, toggle between idle and holding High Guard.
- One default character (orthodox stance).
- Out of scope: progression, cosmetics, extra characters, southpaw, AI
  difficulties. (Easy AI only.)

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

## Keyboard / controller (fixed layouts)
- Keys (left): WASD move, J jab, K cross, L hook, I uppercut, Space dodge,
  Shift hold guard.
- Keys (right): Arrows move, Numpad 1/2/3 jab/cross/hook, 5 uppercut,
  0 dodge, Numpad Enter hold guard.
- Controller: left stick / D-pad move, X jab, Y cross, B hook, A dodge,
  RB/RT hold guard, LB/LT uppercut.
- On-screen touch controls hide once a key or controller is used and come
  back on the next screen touch.

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
  Anti-mash: a raise only gets a Perfect Guard window if guard was down
  for at least `guard.perfectCooldownFrames` first (re-raising sooner
  still blocks normally).
- Dodge: i-frames, then a brief Vulnerable window. A punch thrown within
  `dodge.buffWindowFrames` after a dodge ends is powered up
  (`dodge.buffDamageMult`, 1.5x).
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
  damage, +2 Stars total (`stars.counterGain`; not stacked with the
  sweet-hit star). Changed from +1 on 2026-09-30.
- Jab on Startup = normal hit that interrupts. Uppercut is never a counter.
- Distinct flash and sound.

## Star Power / Uppercut
- Sweet hits grant +1 star (not vs High Guard).
- Chain breaks (stars reset) when the player takes a sweet hit, is
  Perfect Guarded, or gets stunned. Sour hits taken, punches blocked by
  High Guard and whiffs keep the chain (changed 2026-09-30 / 2026-10-03).
  No time decay.
- At 3 stars Uppercut is active: near-instant startup, hook reach, 2x sweet
  Cross damage, cannot be blocked or Perfect Guarded, can be dodged.
  Always resolves on the Vulnerable row, even on the outer ring
  (2026-09-30): sweet 2x Cross, sour 1x Cross.
- Uppercut whiff: stars consumed and a long Vulnerable recovery.

## Stamina, Health, Stun, Fatigue
- Stamina spent by attacking, dodging, holding Guard. Moderate regen when
  not attacking, fastest with no input. Zero = forced Vulnerable ("low
  stamina"), which lasts until stamina climbs back to 30; regen is much
  slower during that state.
- Vulnerable means "no guard": every hit uses the full-damage Vulnerable
  row, no crit bonus. Guest's view is not mirrored.
- Health zero = KO (win condition).
- Stun meter builds from direct hits taken and from attacking into Perfect
  Guard; decays otherwise. Over threshold = stunned for base + overflow.
  Stunned: forced Vulnerable, cannot attack, can move/dodge with slower
  recovery. Meter resets when stun ends.
- Fatigue: repeating a punch type builds that type's counter, reducing
  speed, recovery speed and damage. Per type: Jab 4 bars, Hook 3, Cross 2,
  each with its own per-bar penalty (full bars = same max penalty). Whiffs
  count. A type's fatigue only decays after ~1 s without throwing it
  (decay pause). A fatigued throw shows a subtle grey "tired".

## Tutorial
17 guided steps (move, jab, cross, sweet/sour range, hook, guard, perfect
guard, dodge, dodge power-up, stamina, face vs body, punish, counter,
stars & uppercut, stun, fatigue, final KO), UI revealed only as needed,
progress remembered, linear with SKIP.

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
Single 99-second round, opened by a READY... GO! countdown
(`match.introSec`, 2 s; nobody can act until GO, the timer starts at GO). KO wins; on timeout higher health percentage wins,
tie = draw.

KO animation (visual only, all modes including Training; decided
2026-09-30):
- Drop: finished by a Jab, chip damage, or any sour hit (sour Cross/Hook
  included). The loser slumps flat where they stand, in slow motion.
- Fly: finished by a sweet Cross or Hook, or any Uppercut. The loser is
  knocked along the blow to the ropes in slow motion and sits down
  against them.
- Meanwhile the winner's last punch plays out its recovery in slow motion.
  The result screen waits until the animation ends. Timings in the KO
  tune category.

## Hit feedback
Judged from the local player's side. Landing a hit: bright directional
Tekken-style spark along the punch direction, white flash on the opponent,
damage number, light shake. Taking a hit: orange/red spark, red screen
edges, stronger shake, vibration (Android), duller sound. Counters get a
bigger spark: "COUNTER!" when you land one, "PUNISHED!" when you take one;
the text shakes as it fades. Optional hit-stop (`hit.hitstopFrames`, off
by default) freezes the fight logic briefly, in sync online.

## UI
All in-match elements (touch controls, health/stamina/stun meters, star
meter, fatigue indicator, timer) are drawn in the Phaser canvas. No React
or Tailwind. Lobby, menus and results follow current pipeline conventions
(confirm with the user before building them).

## Networking
Rollback netcode (replaced the v1 lockstep on 2026-09-30 after lag on
mobile data): small fixed input delay, the opponent's input is predicted
and corrected by re-simulation when it arrives. The game only stalls when
the opponent is further behind than the rollback window; show a small
"waiting for opponent" indicator during stalls. The netcode lives inside
this prototype, not a shared package.
