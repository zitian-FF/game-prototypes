# Tee SUPER: CODE X staging prototype

Gameplay input/save/tune identifiers stay `uppercut`. Only Tee selects `code-x`; other fighters retain Rising Upper. `fighterSuper()` supplies closed name/description keys, mechanic and existing starCost. No fighter stats, stamina prices or star requirements changed.

Activation consumes Tee's existing SUPER stars and stamina at start, then animates/resolves a standard Jab (its normal reach, fatigue, sweet/sour, head/body, guard, Perfect Guard and dodge rules). Only actual HP reduction confirms the pair, including a damaging sour hit; chip, zero-damage contact, zero-HP training targets, dodge, miss and Perfect Guard do not. No implicit refund. The Jab does not recharge SUPER stars.

The two immutable tracks cross the original confirmed target center at +/-45 degrees from Tee's activation action vector. They do not home, retarget or teleport. Track points are striking-glove/contact centers; the shadow body trails behind that origin. Use `codeXTrackPosition(track, state.frame)` for the exact visual point/phase. Physics sweeps that same point between frames with the existing Cross hit radius. Each valid living entity gets at most one contact attempt per shadow, independently dodgable. Dead targets are skipped, including death after the first hit; other crossed Survival targets remain eligible. No AI shadow entities are created. Ledgers cap at32 victim IDs per track, above the current arena population/spawn budget.

Each connected shadow deals ONE standard sweet Cross budget, not Rising Upper's cost-normalized formula. The normal Cross character/tune damage, captured Cross fatigue and activation dodge buff apply once; current emergency multiplier and contact counter multiplier apply once. Shadows use normal Cross Guard/Perfect Guard rules and do not award stars. Standard Cross push/hit stun/stun meter/hitstop apply independently. The pair is never summed into one hit.

## Timing options for owner staging review

A, implemented coherent X prototype: 18 combat-frame telegraph, 6-frame sweep, second sweep4frames later, then12frames recovery (40frames at current tuning). Launch extends telegraph if needed to at least6frames beyond the strongest ordinary Jab hit stun. The actual legal-input test proves an early post-jab dodge evades both X passes. A player hit by shadow one may remain in standard Cross hit stun for shadow two; this is an inherent two-hit combo, not an undodgeable forced-damage lump. Every crossing still has independent geometric/dodge checks. The timing proposal is for staging review, not a final production balance decision.

B, alternative only: 40-frame stagger would create a post-first-hit action window but separates the visual X and extends the move to roughly1.3seconds. It is not the implemented schedule.

## Canonical state / events

`Fighter.codeX` is null or `{activationId, frame, endFrame, targetId, targetX, targetY, tracks:[track0,track1], buffed, crossFatigueMult, hitIds:[ids0,ids1]}`. Track `{startX,startY,endX,endY,startFrame}` is immutable. `activationId` is the deterministic jab-confirm sim tick. `frame` advances once per active combat step, and pauses with hitstop. `endFrame` is captured at launch; clear/finish on schedule or attacker death. Survival resets it at wave transitions. State is included in existing JSON rollback snapshots/hash, and its static timing/config is included in Survival balance identity.

Events: `codeXLaunched {attacker,activationId,endFrame,targetId,targetX,targetY,tracks}`, `codeXContact {attacker,activationId,shadow,victimId,x,y,outcome:'hit'|'dodged'|'blocked'|'perfectGuard'}`, `codeXFinished {attacker,activationId}`. Ordinary hit/dodged/sweetImpact events remain for existing audio/symbols. Survival wraps the events with stable entityIds; tracks continue at their locked points even if the original target dies. No speculative visual damage inference. Renderer cleanup must also run when a scene/round ends. The renderer is VFX-owned and remains a staging integration dependency.

Focused tests: CODE X applied-damage confirmation/quality/spend, activation guards/dodge/miss, two independent Cross budgets, current emergency/fatigue/buff/counter once, moved/dead targets, two-shadows-per-victim dedupe, real Survival arena/stats, legal post-jab dodge, hitstop, fixed completion, deterministic replay and delayed-packet rollback/network hash. Existing Super, feedback, Survival, series, TypeScript and strict six-language localization checks pass. No production build/deployment was triggered.

Approved update: tracks start at the target’s front-left/front-right diagonals in its facing frame captured on Jab confirmation, then cross to opposite rear diagonals. Travel is twice as fast over the same distance. Normal block costs and Perfect Guard stun affect the actual Tee owner; guarded/PG crossings never fabricate hit damage.
