# Staging pull policy and one-time player-save reset

Owner-authorized next batch. No token grant, unapproved PR merge, publish or global package build by Logic.

## Compile-time build contract

- PUNCHIES_STAGING=on only for staging; unset/off production. Never inferred from portal=web, hostname, URL or QA flag. Define __PUNCHIES_STAGING__.
- PUNCHIES_SAVE_RESET_ID=punchies-reset-2026-10-12-super-v1 for this reset. Stable across retries, stage rebuilds, profiles and subsequent web/itch releases until a separately authorized reset; not version stamp, time or SHA. Define __PUNCHIES_SAVE_RESET_ID__. Unset disables reset. Nonempty ID with non-web portal is rejected at build configuration.
- Normal/itch: staging off, QA off, same reset ID. Staging: staging on, QA per Build's approved tooling, same ID in isolated namespace. Legacy TEST_BUILD token999 shortcut is disabled in all builds.
- asset-profile.json records staging boolean and saveResetId. Build must update its stage scripts/workflow to set explicit flags; QA1 alone does not permit repeat pulls or isolate storage. Build owns publication and standard/compact package validation.

## Purchases

Staging bypasses daily one-purchase cap only. Currency costs5/10, vouchers, owned IDs, frozen daily offers, shrinking odds and pool exhaustion retained. No token999 button, free currency, daily reroll or duplicate owned reward. Three daily skins can be bought successively with sufficient funds; one daily fighter exhausts its pool after purchase. Production paid daily cap unchanged. Shared dailyChestLocked helper drives sim-free shop logic and UI; staging subtitle explicitly labels repeat pulls.

## Storage and reset receipt

Production existing player keys are unchanged; staging uses punchies:staging:<suffix> for all registered keys, plus staging-isolated developer debug preferences. Same-origin stage cannot read/write/reset production player data.

Exact reset allowlist11: audio, shop collection/currency, tutorial, character/skin preferences, local keyboard/controller/touch inputs and bindings, language, first-run state, XP/progression, profile/alias/avatar, Survival checkpoint/PB, local anonymous rating identity/pending reports. Local rating reset does not wipe server database/history. Runtime tuning is not browser-persisted; reload uses built/latest synced data. Workshop files/credentials, other games and developer unlock preferences are not player-save keys and are preserved. No localStorage.clear or wildcard origin deletion.

New KEYS.resetReceipt is registered/preloaded but excluded from GAME_SAVE_KEYS deletion, including manual reset. Production marker punchies:save-reset:v1; staging punchies:staging:save-reset:v1. applySaveReset verifies allowlist deletion then marker readback. Same ID => already-applied, no repeat deletion. Failure => failed, no false success marker; next boot retries. saveResetReceipt() exposes id/status/staging/keys for Build receipt.

initPortal runs preload then reset before language/boot. Audio cache initializes defaults, reloads preferences only after reset, so stale preloaded audio does not survive. Web/itch storage path is synchronous after preload; portal SDK persistence limitations remain covered by adapter behavior, no backend deletion promise.

## Text / Super description

Format/Difficulty hints are semantic labels in all6 languages, no Tap prefix for those actions; saved keyboard/Xbox glyphs and other touch action hints retained. Added shop.staging_repeat_pulls and super.rising_upper_description across JSON/Sheet. Description: normal guard bypass, dodges/Perfect Guard stop it; no new ability. Art owns description panel layout. No damage/star-cost changes; latest main tuning and pending PR status preserved.

## Focused checks

Staging-reset test: production cap vs three paid staging pulls, real costs/no free tokens/no rerolls/no duplicate rewards/pool exhaustion; flag default and URL/web isolation;11-key namespace/reset/receipt/failure/unrelated storage; manual marker preservation; actual portal preload→reset→audio ordering. Shop/audio/profile/Super/input-hint/portal adapter tests and TypeScript/locale checks. Joint Art/VFX strict i18n follows final UI consumer patch; Build owns actual Brave/reset receipt, mobile/controller, artifact flags and release.
