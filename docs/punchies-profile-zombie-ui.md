# Approved Profile and Zombie UI

Owner-approved five mockups implemented with actual game data. No new raster assets.

- Profile uses the saved owned avatar, local alias, equipped title, live rating service state (unavailable is never zero), level, XP, daily cap and match record.
- Avatar picker enumerates owned fighter/skin pairs only. Save failure keeps the picker open. Unique/palette art uses the existing skin texture path; missing textures fall back visually without changing ownership.
- Full 50-level ladder is passive and vertically paged with wheel, swipe, and shared keyboard/controller scroll buttons. Reached denotes attained level, not reward delivery or collection ownership. No Claim/grants/milestone edits.
- Zombie entry preserves resume and new-run checkpoint confirmation. Corrupt/incompatible/empty checkpoints have honest non-resume states.
- Intermission and results use actual total defeats, ordinary zombies, derived boss defeats and applied damage. Counters are not summed twice. Results portrait visible waist is anchored to screen bottom.
- Boss HUD keeps the separately approved untimed actual-health wing. Save errors remain visible; no successful exit is faked.
- Localization: six locale files; Sheet rows491–506 new entries and row403 instructions updated and verified. No unrelated table changes.

Dependencies already integrated locally: 973c24f, 8b9da1, 6c44f99, 1599735. Cherry-pick the UI-only final commit after these original commits; do not duplicate prerequisite local SHAs.

Focused checks: TypeScript; profile-avatar persistence/ownership/storage failure; Survival deterministic counters/boss/checkpoint regressions; progression UI compatibility; profile-zombie scene harness (844x390,1033x390,844x532) for ladder, skin cycle, failure/retry, modal depths, checkpoint states and hit bounds. Locale placeholder check and diff check.

Limits: harness is not physical touch/controller/browser rendering. Build owns consolidated renderer/device/performance/package validation. No direct build or deployment triggered. New title-screen profile entry is a separate approval mockup; Kai is independent and remains unintegrated.
