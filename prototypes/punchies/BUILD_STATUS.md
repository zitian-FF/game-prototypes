## Current milestone
Owner-triggered staging batch: Dragon Wave Motion Blast and revised CodeX.

## What was implemented
Consolidated Logic7a81e93 and local VFX95b2ffa integrated once against latest main0986a38. Wave startup12, base25, speed844worldpx/sec, first actual collision and ring bounds, 50% guard/dodge chip and 40% maximum-stamina hit. CodeX uses blockable normal Cross followups, target-front diagonals and six-tick travel. VFX shares canonical simulation positions; six locales carry the new Super wording.

## Key technical decisions
Resolve the old-base Survival conflict by keeping approved Zombie damage/Cross ramps, minimum windups and Jab/Cross retry semantics, while adding Wave state support. Keep all shared tune and source assets unchanged. Reuse cached prepared archives below80% budget; only code compilation/minification and packaging occur. Stage saves/999/QA remain isolated and rated play is disabled.

## Open questions
Owner visual/gamefeel review remains ongoing; this trigger is staging only.

## Known issues
No real Ranked service or production Worker compatibility rollout is claimed for the new sim-wave-motion-4 rules. Production remains r0155. The optional controlled VFX review is not a live combat test.

## Next proposed step
Publish this exact completed frozen staging source after focused collision/rules/flags, compile and Brave boot checks. Record phase timings and limits; no additional release without a new owner trigger.
