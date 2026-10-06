## Current milestone
Combat tuning pass 2026-10-06: punch ranges, sweet/sour windows, penalties, punish counters, face-only stamina loss, torso twist.

## What was implemented
- Punch ranges (tune.json): Jab reach 42 / radius 6 (connects to 70 px), Cross 56 / 7 (85), Hook 31 / 12 (65), Uppercut 31 / 12 (65). Core (face) radius 11 to 15. The Jab's body band ends where the Cross face band starts (70), so the Jab is the range gauge.
- Late sour removed (0 frames) for every punch. Jab: startup 6, early sour 3, sweet 2. Cross: sweet 6. Hook: startup 10, early sour 1, sweet 3. Uppercut: recovery 16. Total punch length unchanged.
- Guard release penalty and post-dodge vulnerable window: 24 frames each.
- Punish: any punch that connects on a defender in guard release, the dodge tail or post-dodge window gets the counter bonus (1.5x damage and stun, double hit-stop, counter stars). Cross and Hook keep the startup counter.
- Defender stamina is lost only on face hits (the full-damage row) and sweet blocks; body hits drain none. Body hit damage stays at 50%.
- Rig: torso twist toward the striking arm (`view.puppet.torsoTwistDegrees`, 22), head follows 40 percent. Visual only. Hit flashes already split by zone (face row flashes the head, body row the torso).
- BRIEF.md updated; new `scripts/verify-punchies-combat-ranges.mjs`; older verify scripts updated for the new numbers.

## Key technical decisions
- Sim changes are two small edits in `resolveContact` (punish counter, no body-hit stamina drain); everything else is tune.json, which guests adopt from the host.
- Sweet face windows are small by design (face hits are meant to be rare): about 6 px for the Jab, 4 px for the Hook, 8 px for the Cross.

## Open questions
- Bots hardcode spacing around reach, so their whiff count roughly doubled in bot-vs-bot batches. They still finish matches, but need a spacing retune.
- Punish counters give Jab and Uppercut hits +2 counter stars; watch for star farming.
- BRIEF.md tutorial and reference overlay text were not rechecked against the new numbers.

## Known issues
- Not verified: real phone, online match with two real devices, hook arc visuals with the new timing.
- Headless two-peer rollback simulator: no mismatches (wifi and mobile profiles, one minute each).

## Next proposed step
Playtest the new ranges and penalties, then retune bot spacing and adjust numbers from feel.
