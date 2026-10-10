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
Verify deployment, then review Nadia portrait and prepare Roxy's rig using the approved portrait. Test-build scaffold (owner request): src/testBuild.ts exports TEST_BUILD (true) and TEST_TOKENS (999); the Shop shows a "TEST: 999 TOKENS" button in the itch test build without ?debug=1. Removal list in docs/release-plan.md section 8b. The test scaffold must be switched off (TEST_BUILD false) before the final build. Live translations (test build): src/i18n/liveSheet.ts reads the Google Sheet (gviz CSV) at boot with a 3 second timeout, validates placeholders, caches the last good copy (KEYS.liveTranslations) and falls back to bundled files then English; languages become selectable when the sheet has translations. Gated by TEST_BUILD (?live=0 disables). New test-punchies-i18n-live.mjs. The translation sheet is private (HTTP 401 for anyone but the owner) so the live fetch falls back to English until it is shared "anyone with the link can view". It also still holds only the first 254 of 376 strings. Reviewed translations are needed before the final build freezes them into locales/*.json.
