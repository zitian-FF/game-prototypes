## Current milestone
Owner-authorized complete Zombie Survival and casual Elo release; combined local checks passed, publication pending.
## What was implemented
Casual private-room Elo client, bounded status presentation and SQLite Durable Object service; complete Zombie Survival entry, solo roster/skin choice, timed combat, independent Zombie rig, boss waves, healing, checkpoint resume, save failure/retry and pause controls. Existing combat tuning is unchanged.
## Key technical decisions
Integrate only Survival production UI and rig commits, excluding obsolete Ranked and unrelated progression. Rating identity and pending reports use registered portal storage. Both art profiles preserve existing entries and share identical Zombie parts and mirror aliases. Deploy Worker first, capture its actual URL and rebuild clients afterward. VFX remains a subsequent isolated release.
## Open questions
The 33 Survival translations use English fallback while reviewed Sheet formulas resolve. A deployed two-peer fight remains a release smoke requirement.
## Known issues
Anonymous storage reset loses the rating identity. Agreed fake results and unreported disconnects remain accepted casual-rating limitations. Local review harness mocks saves and controller buttons; it is not physical-device or live-service evidence.
## Next proposed step
Merge the reviewed combined release, deploy and validate the rating Worker, configure the actual service URL, publish clients and verify the live game before continuing VFX.
