## Current milestone
CrazyGames launch prep: adapter verified against the real SDK; casual online Elo (Cloudflare Worker, built by Codex) in planning.
## What was implemented
CrazyGames adapter checked against the real SDK v3.8.0 in its local demo mode (`scripts/test-punchies-crazygames-sdk.mjs`): init, `loadingStart`/`loadingStop`, saves through the SDK data module, no console errors. The adapter now sends `loadingStart` after init and treats the Basic Launch ad error (`adsDisabledBasicLaunch`) as unavailable instead of failed. The test-build scaffold (999 token shop button) is now on only in the default `web` build (itch.io Current WIP); every portal build drops it. Earlier this session: package budgets raised (compact 20 MB, standard 40 MB), perfect guard widened to 8 frames, tutorial panel moved to the bottom with Skip/Exit stacked at its right, tutorial copy shortened, combat translation fixes merged.
## Key technical decisions
`TEST_BUILD` is derived from the build-time portal constant, so no manual flag edit is needed for a portal build. The SDK check runs only against local demo mode, so gameplay start/stop and rewarded ads remain covered by mock tests until CrazyGames' QA tool is used. Elo plan (Codex implementing): Elo with a range-based farm guard, max participant K for zero-sum, both clients must report, no unilateral win claims.
## Open questions
Does online play ship on CrazyGames at all (third-party relays and a Worker)? Which launch scope (basic launch with 3 fighters) and when. Art launch work (thumbnails, cover, screenshots, trailer) must be discussed with the owner first; Codex has been told. Guard/dodge exposure windows (24 frames) and the stamina inversion (1 to 17 stamina cannot dodge, 0 can) are undecided.
## Known issues
Non-English tutorial copy is stale until Codex re-translates the 13 changed keys. Bots do not use the hit/block lock or exhausted guard and dodge rules. The tutorial panel overlaps the ring's lower edge slightly on some aspect ratios. PR #270 (tuner workshop) was reported rebased by Codex but is not merged; PRs #335 and #336 await owner approval.
## Next proposed step
Run the CrazyGames build in CrazyGames' QA tool, then decide launch scope and the online-mode question.
