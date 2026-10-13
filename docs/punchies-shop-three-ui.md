# Uniform three-candidate chest UI

Urgent stage hotfix; no asset or CodeX dependency. Apply after Logic17c2688 and006930e.

Shop entry now usesprepareShopEntry and persists the result, so explicit staging999 allowance actually reaches the displayed balance and remaining candidate snapshot. Production behavior stays Logic-owned.

Both purple/gold bubbles render chestRewards directly, at120+i62 for up to3 rows. Name/rarity/odds bound to row widths; percentage comes from actual1/N, rounded33/50/100. Names can wrap inside26px height. Uniform-odds caption and daily/staging context remain; obsolete guaranteed fighter text removed. Zero rewards usesCollectionComplete and existingbuybutton disabled, leaving datahelper atomic guard authoritative. No new UX redesign or graphics.

Focused view harness verifiesentryhelper/persistence, both3/2/1/0rows+odds, emptydisabled andno guarantee text. Logicactualcandidate tests andstricti18n475keys(currenttitlecleanup)/TypeScript passed. Localeindex recomputedfrommergedfiles, avoiding stale476count. Logicowns nativeSheetupdates. Build realstage999 entry/purchase/exhaustion/popup6locale/render proof afterMaintrigger; no directdeployment.
