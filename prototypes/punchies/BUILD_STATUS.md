## Current milestone
Approved pending art release: public R2 bundles verified; merge and deployment in progress.
## What was implemented
Captain Eagle portrait and complete rig with anchored scarf, covered limbs and canonical mirrored gloves/boots. Approved Bruno portrait repair, locked-roster icon and ten overhead torso replacements. Captain is in the fighter chest pool and tuner. Tee retains her existing live torso.
## Key technical decisions
Captain uses provisional Marco stats; existing tuning is unchanged. Lossless originals archived to Drive 1bH0muAJAID4VUQAiAYW_25yKhyjJLjZo. Both public R2 downloads match prepared SHA-256 hashes. Standard ETag updated to f3f637072d769d7f2929fa8a55ca1bc8. Fresh standard and compact builds pass integrity and parity checks at 16,804,365 and 9,809,654 bytes.
## Open questions
Nadia redesign needs portrait approval before rig production. Her hair will be a compact braided bun, distinct from Mia's ponytail. Roxy's approved portrait is retained for rig preparation.
## Known issues
Tee collar correction remains unfinished after image tool rejection. Captain tuning is provisional. Profile/progression screens remain separate work.
## Next proposed step
Verify deployment, then review Nadia portrait and prepare Roxy's rig using the approved portrait. Test-build scaffold (owner request): src/testBuild.ts exports TEST_BUILD (true) and TEST_TOKENS (999); the Shop shows a "TEST: 999 TOKENS" button in the itch test build without ?debug=1. Removal list in docs/release-plan.md section 8b. The test scaffold must be switched off (TEST_BUILD false) before the final build. Translations in the build (owner direction): no runtime fetch. The deploy workflow has a "Pull translations from the sheet into the build" step that runs for release builds (TEST_BUILD false) or when the pull_translations input is set; it downloads the sheet CSV (I18N_SHEET_URL variable), validates it and writes locales/*.json into the workspace so Vite packs them. A release build fails if the download fails. A live-sheet runtime loader (PR 314) was reverted. The translation sheet is private and holds only the first 254 of 376 strings. The CI download needs the sheet shared (link sharing or publish to web) and the I18N_SHEET_URL variable set; until then use the Brave CSV download and `i18n-sheet.mjs import`. Machine translations need review before the final build.
