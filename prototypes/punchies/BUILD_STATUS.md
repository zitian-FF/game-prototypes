## Current milestone
Guard-release penalty and tight perfect guard on every legal raise.

## What was implemented
- Lowering guard starts a 12-frame Vulnerable penalty and blocks re-guarding; sweet hits take full vulnerable-row damage.
- Every legal guard raise begins a tight three-frame Perfect Guard window. Removed the separate 40-frame cooldown.
- Punch/dodge cancels, exhaustion and stun cannot bypass the guard-release penalty.
- Updated AI, defense reference, tutorial text, tune metadata and BRIEF.md for the new rules.

## Key technical decisions
- Guard penalty only starts on an actual transition out of guard; repeated releases or held guard during lockout do not restart it.
- The release tick counts as the first penalty frame. Hit-stop pauses penalty with the fight.
- Held guard may raise after the penalty ends; it cannot raise during the window. No added walking slowdown or attack/dodge lockout.
- Added deterministic guardPenalty state, replacing obsolete guardDownFrames/perfectEligible. Rollback snapshots already clone the complete state.

## Open questions
- Owner was offered timing choices; used 12 penalty frames and three Perfect Guard frames. BRIEF.md records the working timings and can be adjusted if requested.

## Known issues
- No real-phone or two-peer online-match verification in this pass.

## Next proposed step
Playtest guard timing against live opponents. Guard regressions verify full damage, exact lockout, fresh perfect guard, cancels, hit-stop, deterministic replay and AI compatibility. Stamina/dodge and zero-HP training regressions, typecheck and production build passed. Brave checked the reference overlay and actual game boot without console errors.
