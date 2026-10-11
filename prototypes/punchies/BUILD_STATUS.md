## Current milestone
Owner-authorized combined Elo and complete Zombie Survival release, under integration review.
## What was implemented
Casual private-room Elo client, bounded status presentation and SQLite Durable Object service are integrated with Zombie Survival simulation and checkpoint persistence. Production Survival scene and rig handoff remains required before publication.
## Key technical decisions
Preserve existing combat tuning. Deploy the rating Worker with the pinned configuration, capture its actual URL, then rebuild clients with PUNCHIES_RATING_URL. Keep the reviewed VFX pass separate until after this release.
## Open questions
Final production Survival handoff and deployed browser smoke are pending.
## Known issues
No live rating endpoint or completed combined release is claimed yet. Anonymous storage reset loses rating identity; agreed fake results and unreported disconnects remain accepted casual-rating limitations.
## Next proposed step
Integrate Art's production Survival commit and rig, run combined checks and profile validation, then merge and deploy the authorized release.
