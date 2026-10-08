## Current milestone
Portal layer in place (itch.io default, CrazyGames, Poki, Playgama adapters). Main game otherwise at the post-#261 state: audio and settings, starter skins, winner results, G.P. Tee.

## What was implemented
- Portal layer, `src/portal/`: one interface for gameplay events, saves and rewarded ads, with a web adapter and CrazyGames, Poki and Playgama adapters chosen at build time (`PORTAL=...`, `PORTAL_ADS=off`). Details are in BRIEF.md under "Portal layer".
- Saves: every persisted value now goes through the portal `store`; keys are listed in `src/portal/keys.ts`. `main.ts` initialises the portal and loads saved data first, then loads the game (`boot.ts`).
- Shop: the ad button calls the portal. The default build keeps the preview behaviour; portal builds grant a token only on a completed rewarded ad and show ADS UNAVAILABLE when ads are off or the SDK did not load.
- Fights report gameplay start and stop to the portal; the game is muted (without changing saved volume settings) while an ad plays.
- New `scripts/test-punchies-portal.mjs` (added to the deploy workflow along with the tune guard check). It covers the adapters against mock SDKs, de-duplicated gameplay events, reward only on success, save routing, SDK-load failure fallback, per-build SDK addresses, and a check that no code reads localStorage directly.
- Repaired older tests that were already failing or that the portal change touched: game-menu (missing settings stub), series (missing winner context), roster, shop and audio (new portal imports).
- Earlier this week: tune guard for online play (`validateTuneJson`), debug tools hidden unless opened once with `?debug=1`, credits now say tiantian.

## Key technical decisions
- Adapters are thin and the game never touches an SDK. Dead adapters are removed from each build.
- Saves stay synchronous for the game: portal data is preloaded into a cache before the first scene.
- An invalid or failed SDK never blocks boot (10 second cap) and falls back to local storage and no ads.
- Reward is granted only on an explicit success result from the portal.

## Open questions
- Hosting and exclusivity choice for each portal, and the Gemini music rights question (the account used was a First Fun Workspace account).
- Whether to drop the connected stingers and loops after the listening review.
- Hard bot personality, and whether jab and uppercut punishes should award +2 counter stars.

## Known issues
- The portal adapters have not been run against the real CrazyGames, Poki or Playgama SDKs, only against mocks. Each portal's QA tool must be run before submission.
- Gameplay start fires when a fight scene starts, not on the first input (Poki's guidance prefers first input).
- Real two-device online play, a physical controller and a real phone have not been tested this pass.
- The music files add about 12.5MB in production builds on top of the roughly 12MB game, relevant to the CrazyGames 20MB mobile homepage limit.
- Analytics, ranked play and midgame ads are not built.

## Next proposed step
Analytics on the portal layer, then real SDK testing in each portal's QA tool once a portal is chosen.
