# Wave Motion Blast

Dragon's Super uses the existing `uppercut` input and Dragon star/stamina costs. Metadata identifies it as `wave-motion-blast` / `projectile`; it does not use Rising Upper damage normalization. It has 12 combat-frame startup and one projectile with base damage 25.

`super-config.json.waveMotion` defines authored world width 844, full-speed reference 60 frames, travel lifetime 68 frames, radius 12, guard chip 0.5 and guarded stamina share 0.4. Maximum speed is 844/60 world pixels per 60 Hz combat tick. Launch begins at half that maximum and accelerates linearly over 30 combat ticks, then stays at maximum. The integrated path has 851.03 world pixels of travel capacity before lifetime expiry, so the slower launch still covers a full authored width. DOM size, device pixel ratio, client camera zoom and viewport expansion never affect it. Startup follows the owner; the launch socket is body centre plus normal hurt radius along the facing vector. Aim and origin freeze at launch. Travel stops on the first real swept circle collision, including a block, Perfect Guard or dodge, or at the ring boundary/lifetime. It does not pierce or invent area damage.

Every unblocked contact has one full 25-point base budget with current emergency, captured dodge buff and normal Cross counter rules applied once. Guard takes half damage and drains 40% of the defender's maximum stamina. Drain uses the existing protected emergency-state function, clamps at zero and enters the ordinary exhausted state. Perfect Guard applies the standard attacker stun; a legal dodge avoids damage. No Super hit earns stars. Startup interruption, death and normal round/Survival resets clear the state without refunds. The owner can act after launch, but cannot replace an already active Wave with another Wave.

## Shared simulation / VFX contract

`Fighter.wave: WaveState|null` contains `{activationId, frame, startup, endFrame, originX, originY, fx, fy, speed, startSpeedRatio, accelerationFrames, radius, buffed, launched}`. `wavePosition(state, frame=state.frame)` in `sim/waveMotion.ts` integrates the canonical curve and returns world position and `startup`/`travel` phase. `waveVelocity` returns instantaneous world pixels per tick. Curve parameters are captured in deterministic state, not re-read by the renderer from live config. Hitstop freezes logical frames. VFX must use these helpers and the world parent, and include the player plus living Survival bosses independently of the displayed opponent.

The visual contract is a round core with **24 world-pixel outer diameter including its outline**, matching radius 12. Atlas 128×96 uses core centre (88,48), authored outer radius 24 and runtime scale 0.5; origin is (0.6875,0.5). The decorative back tail extends at most 40 world pixels behind the centre and has no collision area. Bright spirals remain inside the core. Total visual extent is at most 52×24 world pixels. No glow ring silently increases the hit area.

`waveLaunched` and `waveFinished` carry `{attacker, activationId}`. `waveContact` adds `{victimId,x,y,outcome:'hit'|'blocked'|'perfectGuard'|'dodged'}`. Contact coordinates come from the first swept collision. No speculative hit inference is needed. Stable-ID tie breaking makes coincident Survival targets deterministic. Standard combat events remain available, and Survival totals count applied unblocked hit damage only.

Rules revision is `sim-wave-accelerated-5`; old peers cannot pair with the changed simulation. Existing rollback serialization includes Wave state. The changed Super configuration also invalidates old Survival balance checkpoints. Legacy checkpoints can retain their best record and report the existing incompatible state instead of pretending to resume with a missing Wave field.

## Verification

`test-punchies-wave-motion.mjs` covers startup/costs, speed, exact modifiers, guard/PG/exhaustion, legal player dodge, first hit/no homing/bounds/death/hitstop, delayed-packet rollback and actual Survival player/boss projectiles. CODE X separately verifies normal Cross defenses, defender-facing diagonals and six-frame sweeps. No merge or deployment is part of this work.
