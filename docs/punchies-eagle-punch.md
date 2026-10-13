# Eagle Punch canonical contract

Captain's Super has 50 combat-frame windup, base damage 40, a 12-frame body dash and 18-frame recovery. An entirely missed punch retains the standard Cross whiff tail. Existing Captain Upper input, charge cost and stamina cost are spent once, with no Rising Upper cost/damage normalization. The normal dodge **distance** reference ignores exhausted dodge reduction: `2 × characterDodge.speed × characterDodge.frames / 60`, currently 180 world pixels before ring clipping.

Walking input is held during windup. Facing may track a target before launch; launch captures a unit heading, clipped body-radius ring endpoint and distance. Dash increments actual body position by the committed ray delta; it never homes or jumps to a predicted endpoint. Normal hit locks, crowd separation, push and ring clamps still apply. A hit can therefore impede the motion; it never catches up by teleporting. No `DodgeState`, invincible frames or hurt-radius exemption is created. Startup and recovery use standard punch vulnerability; active frames remain ordinarily hittable. A damaging startup hit or ordinary meter stun cancels through the existing punch path without refund.

The actual visible Cross glove, from shared `punchFist`, sweeps between its previous and current world positions. Only physically intersected victims are hit. Stable IDs record one hit **per victim per activation**, with a bounded 32-entry ledger; Survival may hit multiple distinct path intersections and never invents area damage. Normal guard is bypassed, Perfect Guard cancels the action and stuns Captain, and dodge works. Explicit base 40 receives captured dodge buff, current emergency and standard contact counter factors once; no ordinary Cross fatigue or legacy Upper power compounds it. The Super does not earn stars.

## State and helpers

`Fighter.eagle: EagleState|null` contains `{activationId,frame,startup,dashFrames,endFrame,launched,fx,fy,distance,dashProgress,startX,startY,endX,endY,bodyX,bodyY,previousFistX,previousFistY,hitIds}`. It accompanies a real `PunchState` Cross with `eagleSuper:true` and `baseDamage:40`.

`sim/eaglePunch.ts` exports `EAGLE_PUNCH`, `eaglePhase(state)`, `eaglePosition(state)`, `eagleDashDelta(state)` and `eagleEndpoint(...)`. `eaglePosition` returns the **actual physics-owned body position** and startup/dash/recovery phase, not a theoretical location ahead of the actor. Render the real glove using `punchFist` and the fighter's current pose. Hitstop freezes logical clocks. `endFrame` includes a whiff tail when applicable; interrupted actions clear immediately. Wave motion and CODE X geometry are unchanged by this refinement.

`eagleStarted`, `eagleLaunched` and `eagleFinished` carry `{attacker,activationId}`. `eagleContact` adds `{victimId,x,y,outcome:'hit'|'perfectGuard'|'dodged'}`. There is no normal-block contact outcome. VFX should charge during startup, attach directional fire to the actor/glove during the dash and clean up on finish, interruption, death, result and scene shutdown. Impact effects must use actual contact coordinates; a dodge is not a damaging impact. No new audio or fullscreen effect is required.

State, captured geometry and ledger serialize through existing rollback/hash paths. Simulation rules revision is `sim-eagle-punch-6`. Changed Super configuration invalidates old Survival balance checkpoints, while their personal best can remain available through legacy shape validation.

## Focused checks

`test-punchies-eagle-punch.mjs` exercises held 50-frame windup, base 40, normal hop distance, costs, all damage modifiers once, normal guard/PG/dodge, incoming damage in every phase, ring/fixed aim/no blink, hitstop, delayed rollback and actual Survival multi-victim dedupe. Browser preview and VFX implementation are separate; no publication is included.
