## Current milestone
Authorized combined compact/web reset and SUPER release, with completed single-confirm roster controls. Candidate r0151; no publication claim until upload and live verification.

## What was implemented
Shared SUPER timing, star feedback/meter effects and localized descriptions; Nadia torso0.79 and Marco base torso0.88; one Confirm commits fighter and current owned/render-ready skin. Saved combat bindings provide contextual keyboard skin/difficulty/format controls, with dedicated Confirm/Back and device ownership. Xbox uses A/B, LT/RT skins, X/Y difficulty and RB format.

## Key technical decisions
Stable web-only save reset epoch punchies-reset-2026-10-12-super-v1 clears the11 registered player keys once, preserves its receipt and unrelated data, and runs after preload before audio/language boot. Production STAGINGoff/QA0; staging STAGINGon/QA1/STAGING_QA1 with isolated saves and paid daily-cap bypass only. Production debug module is replaced at resolution time. Local production9985759bytes148files; staging10149833bytes152files. Art3460285/audio4345153 unchanged; compression pins unchanged. Locale mode frozen-reviewed-committed-locales when Sheet URL absent; strict477-key checks remain.

## Open questions
Physical controller, touchscreen/Android and mobile60fps not proven. Browser input includes explicitly synthetic Xbox. Marco balance PR350 remains separate.

## Known issues
Existing cold palette limitation persists. Controlled WebGL fixtures prove render/input/reset behavior, not difficulty balance or earned combat outcomes. Six locale actual roster frames synchronized to rendered language;21 actual Training pose frames cover Nadia base and Marco base/Rising Star with real texture keys. Actual production reset, second-boot persistence, paid purchase and stage isolation/repeat pulls pass.

## Next proposed step
Merge the reviewed release and verify exact automatic itch version, CI sizes and public staging SHA354e702. Keep palette architecture/title mockup/Kai/unique Supers/Ranked identity work excluded. Preserve reset epoch across retries and later builds until another explicitly authorized reset.
