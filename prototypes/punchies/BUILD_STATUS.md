## Current milestone
Emergency stamina recovery and smaller normal headshot zone shipped in r0078 through merged PR #241 (7bafc1e).

## What was implemented
Zero stamina now triggers emergency recovery until full stamina. The red bar and existing sweat effect show the state. All incoming contact uses the vulnerable/headshot row. Punches remain available without stamina spend and deal half damage with existing multipliers. Guard and dodge attempts flash stamina and are refused. Normal headshot core radius is reduced by one-third (15 to 10 before character scale); outer body radius and punch reach remain unchanged. AI avoids illegal defence and can attack during emergency. Tutorial and info text describe the rules.

## Key technical decisions
The existing deterministic exhausted flag now denotes emergency recovery. Regeneration uses normal walking rate times the character regeneration modifier and continues during actions, stun and hit-stop. Protected spend/gain helpers prevent attacks, incoming stamina damage or bonuses from altering the meter. Damage uses a pre-contact snapshot of both attackers' emergency states so same-tick trades do not depend on resolution order. Old recovery threshold/speed values were removed; emergencyDamageMult is exposed in tune. Uppercut still requires stars and stun restrictions remain.

## Open questions
None. The follow-up headshot request reduces normal-state core size while retaining emergency headshot rules.

## Known issues
Physical two-device online and phone/controller checks remain pending. Existing Phaser bundle size warning remains.

## Next proposed step
Head/body spacing boundary tests pass for all character pairs and all four attacks at 1x/1.5x/2x. Typecheck/build and emergency, shared geometry, series/online-readiness and Canvas/WebGL effects regressions pass. Emergency tests cover all characters, full-only exit, continuous recovery, punch/guard/dodge behavior, exact-zero entry, positive low-stamina refusal, protected incoming hits and half damage with fatigue, buff and counter multipliers. Brave review confirms smaller inner headshot circles inside unchanged outer body hitboxes, plus the emergency red bar/recovery pose, with clean consoles. PR #241 is merged and itch.io deployment succeeded. Brave live review confirms r0078 boots into fullscreen and training renders correctly with no console errors. Next: user playtest of emergency stamina and head/body spacing, then revisit the rewards shop proposal. Physical two-device online and phone/controller verification remain pending.
