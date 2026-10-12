# Approved minimal Survival boss HUD

Art branch: proto/punchies/boss-hud, base 9bd64f0. Release as a combined batch with Logic's boss completion/pressure changes, not independently.

Presentation: existing unused opponent pink health wing, actual boss name/current/max HP, quiet wave+defeated line above, localized BOSS clock. Player bars, hamburger touch area and ring geometry stay unchanged. Ordinary-wave HUD stays unchanged. Incoming bosses show a localized incoming label and no invented health bar/value. Boss death is owned by Logic's wave-clear path; this UI must not be used as a substitute for functional completion rules.

The stored spawn max HP is authoritative for display; do not use generic fighter maxHealth when Survival scales bosses. No illustrative 156/220 tuning is introduced. Timer font changes only on boss-mode transitions, not every frame. No new bitmap assets.

Focused HUD checks cover the boss wing/name/number gap, incoming no fake HP, defeated state, ordinary-clock restore at 640/844/1200 logical widths. These are renderer-mock source checks, not physical mobile/browser proof. Build owns final compact gameplay visual/responsiveness and combined regression.

Localization: two fixed-string keys survival.boss_clock and survival.boss_incoming added in en/ja/ko/zh/es/ar and readback-verified in Punchies Translations rows 489–490, columns A:H. Existing Sheet formatting copied from row488 only; no unrelated cells/formulas changed. URL: https://docs.google.com/spreadsheets/d/1Ua6JvvNEWImzblS7gOBA_OoEucaqFkx7Mok12awch1g/edit

Broader Zombie/Profile/Ranked designs are outside this approval.

Logic prerequisite: 8b9da1ad43d4606209d3fe04d76ddddfd0b57950 (cherry-picked locally as 4ebc00c). Art's final commit contains only UI/tests/locales, not Logic changes. Adapter consumes exact view.waveMode/view.boss incoming/alive/defeated currentHP/maxHP snapshot; no closest-zombie or generic fighter HP lookup.

Final focused checks: test-punchies-boss-hud.mjs and test-punchies-hud.mjs passed; i18n-sheet check and TypeScript passed. Fonts change only on mode transitions. No full build/global regression/browser gameplay validation performed; Build owns combined validation.
