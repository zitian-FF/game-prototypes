## Current milestone
Authorized focused title/profile entry follow-up after live121026r0151. No additional gameplay scope.

## What was implemented
The top-right260x72 card shows the owned saved avatar, actual alias, level/title and XP; one interactive target opens Profile. The136x32 native language/flag selector is anchored bottom-right. Removed obsolete profile.menu text and duplicate entry. Readiness callbacks are generation guarded and refresh on resume without per-frame rebuilding.

## Key technical decisions
Art1b392b1 integrated on live151. Preserve exact stable web reset epoch punchies-reset-2026-10-12-super-v1, production staging/QAoff, stage isolated keys and ratedplay disabled. No new ZIPs/assets/compression/tuning changes. Strict476-key locale check and Sheet roundtrip pass; Logic verified obsolete nativeSheet row deletion and surrounding rows/formulas.

## Open questions
Physical controller, touch hardware and Android/mobile60fps remain unproven. Synthetic Xbox fixture is explicitly labeled; seeded identity/progress verifies rendering and refresh, not earned progression.

## Known issues
Existing cold palette limitation remains; pending approved palette/Kai/Ranked/CodeX/VS work is outside this focused batch. Actual Brave WebGL desktop and640x360 six-locale captures, saved Tee avatar, real Profile picker/return, keyboard activation, synthetic XboxA/B, alias/title/XP refresh and native language popup pass with no console errors.

## Next proposed step
Build one combined compact production/stage pair, verify existing save receipts preserve state, then publish the authorized follow-up and verify exact automatic version, bytes/profile, stagingSHA and live title layout. Future CodeX/newmechanic work stays stage-first after ownersREADY and Main trigger.
