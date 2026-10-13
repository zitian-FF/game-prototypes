## Current milestone
Approved Zombie and Tyke staging batch, following production r0154.

## What was implemented
Survival-only boss-add quotas 8/12/16/20/24, fighter-relative boss HP ramp, ordinary Zombie damage ramp, seeded real Cross attacks from wave 4, and schema2 checkpoints. Tyke's production-verified visual glove mirror is included. All earlier content and shared fighter tuning remain intact.

## Key technical decisions
Use production adaptation 9d79f534 as the feature base and integrate approved Zombie source 6ca4550. Preserve the staging namespace, 999-token Shop allowance and fixed reset epoch. Disable rating in the staged package. Old Survival checkpoints preserve personal bests but cannot resume under new balance.

## Open questions
User visual and gamefeel review remains ongoing; no extra acceptance gate is introduced.

## Known issues
Profile parity requires a separate focused correction for the compact-only Tee mask and the standard source-resolution fallback. No real Ranked pairing or mobile performance claim follows from this staging verification.

## Next proposed step
Publish the completed frozen stage batch after package/boot verification. Main reviews the next ready queue. Marco PR350 remains outside this batch.
