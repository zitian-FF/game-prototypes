## Current milestone
Emergency stamina recovery implemented and committed locally; publishing awaits explicit user approval.

## What was implemented
Zero stamina now triggers emergency recovery until full stamina. The red bar and existing sweat effect show the state. All incoming contact uses the vulnerable/headshot row. Punches remain available without stamina spend and deal half damage with existing multipliers. Guard and dodge attempts flash stamina and are refused. AI avoids illegal defence and can attack during emergency. Tutorial and info text describe the rules.

## Key technical decisions
The existing deterministic exhausted flag now denotes emergency recovery. Regeneration uses normal walking rate times the character regeneration modifier and continues during actions, stun and hit-stop. Protected spend/gain helpers prevent attacks, incoming stamina damage or bonuses from altering the meter. Damage uses a pre-contact snapshot of both attackers' emergency states so same-tick trades do not depend on resolution order. Old recovery threshold/speed values were removed; emergencyDamageMult is exposed in tune. Uppercut still requires stars and stun restrictions remain.

## Open questions
None. Normal-state headshot geometry is unchanged; the request changes emergency-state hit rules.

## Known issues
Physical two-device online and phone/controller checks remain pending. Existing Phaser bundle size warning remains.

## Next proposed step
Typecheck/build and emergency, shared geometry, series/online-readiness and Canvas/WebGL effects regressions pass. Emergency tests cover all characters, full-only exit, continuous recovery, punch/guard/dodge behavior, exact-zero entry, positive low-stamina refusal, protected incoming hits and half damage with fatigue, buff and counter multipliers. Brave review confirms red bar and recovery pose with clean console. Automatic approval review rejected the public GitHub push twice, requiring explicit authorization for this payload/destination. A user approval request is pending for push, PR merge and the existing itch.io deployment. After approval, publish proto/punchies/emergency-stamina and verify the release.
