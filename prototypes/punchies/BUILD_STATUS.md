## Current milestone

Steps 1-3 of the plan done: deterministic sim core, training mode, and
in-canvas touch controls + HUD. Playable solo against the dummy, deployed
to the Current WIP itch.io slot. Online PvP (step 5) not started.

## What was implemented

- `src/sim/`: pure, deterministic 60 Hz fight sim (no Phaser/DOM). Punch
  phases, full hit-resolution table, core vs outer hurtbox, counters,
  jab/any-damage startup interrupt, Perfect Guard, High Guard stamina
  drain, dodge i-frames + vulnerable window, stars / chain breaks,
  uppercut (unblockable, whiff penalty), stamina regen tiers, exhaustion,
  stun meter with overflow duration, per-type fatigue, KO, 99 s timer with
  health-% decision / draw. Input buffer (tune.input.bufferFrames).
- `src/input/intents.ts`: intent layer; sim reads a quantised FrameInput
  per tick. Touch and keyboard bind to it.
- `src/ui/TouchControls.ts`: floating joystick, split Jab/Cross button,
  Hook/Guard/Dodge/Uppercut arc buttons, star pips on Uppercut, fatigue
  pips on punch buttons. Multi-touch.
- `src/ui/Hud.ts`: health (with damage trail), stamina, stun meters, timer.
- `src/render/`: placeholder boxer view, hit FX (sweet spark, sour puff,
  counter flash + shake, block/perfect-guard rings, callout labels), DPR
  handling (capped 2x, camera zoom, Text resolution).
- `src/audio/sfx.ts`: WebAudio placeholder cues (distinct counter sound).
- Training scene with dummy IDLE/GUARD toggle and RESET; dummy health
  refills after a pause; KO resets after 1.5 s.
- tune.json with every tunable; Tweakpane via ?debug=1 with nested
  folders, hitbox overlay toggle and Copy JSON. Version stamp.

## Key technical decisions

- Sim uses only IEEE-exact math (+ - * / sqrt, no trig) so lockstep peers
  stay bit-identical. Verified: two runs of 3000 ticks with pseudo-random
  inputs produce identical state.
- Contact geometry: punch hitbox is a circle at attacker + facing * reach.
  In Normal stance, overlapping the core uses the Normal row; only
  clipping the outer ring uses the Vulnerable row. Because boxers always
  face each other, this means a max-range "tip" hit deals full damage and
  a hit at ideal range hits the core (reduced).
- Any damaging hit interrupts an opponent's punch in Startup (not only
  jabs); counter bonus applies only to Cross/Hook.
- Uppercut consumes all stars on use (hit or whiff); whiff adds
  `whiffExtraRecovery`. A guarding target takes an uppercut as Normal.
- Perfect Guard stun on the attacker is a short stagger
  (`perfectGuardAttackerStunFrames`) plus stun meter build; only a
  meter-triggered stun resets the meter when it ends.
- Guard cannot be held while exhausted; punching/dodging needs stamina > 0.
- Training dummy has infinite stamina by default (tune.training) so GUARD
  mode doesn't break its own guard within seconds.
- Fighters render with plain Graphics each frame; no React/Tailwind.

## Open questions

- Normal-stance core geometry (see decisions): is "tip hits deal full
  damage" intended? BRIEF.md may need updating to pin this down.
- Uppercut on hit: should it consume stars (current) or keep them?
  BRIEF.md only says whiff consumes them; may need updating.
- Sour vs Normal (no damage): currently does not count as "getting hit"
  for the defender's star chain. BRIEF.md may need updating.
- Does an Uppercut against a guarding opponent use the Normal row (current,
  reduced damage) or always Vulnerable (full)? BRIEF.md may need updating.
- Lobby/menus/results screen conventions after the React removal (asked
  to confirm before step 5).

## Known issues

- All tune numbers are first-pass placeholders; none were set by playing.
- On slow devices the sim runs in slow motion rather than dropping ticks.
- Not yet verified on a real phone (only Playwright mobile emulation).
- Deployed via the Current WIP itch.io slot (`deploy-wip-itch.yml`,
  formerly suits' project); the itch page title/description still say
  "suits" until renamed on itch.io.

## Next proposed step

Playtest training on a phone and tune. Then step 5: landscape lobby
(host/join code, reusing mp-core identity + TURN), lockstep layer with
measured input delay, redundant input packets, desync hash, and the
"waiting for opponent" indicator.
