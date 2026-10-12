# Approved Ranked presentation

Based on live Kai6cae850. Art UI21483bc and followup fixture/layout; Logic owns per-match snapshot binding/one legitimate report/bounded read-only polling/shutdown+FindNextMatch+two locale keys; VFX owns MatchIntro and optional Ranked capsule integration with existing fireless VS. No gameplay or tuning changes.

HUD capsules replace legacy alias/title lines only when RankedPlayers supplied. Bounds reserve a44px top-left menu hit area plus14pxgap symmetrically; top1height30 stays above existingHPbar34. Passive roundednavy panel, thinquietedge, red/blue2pxaccent. No input listeners. Larger clash/result capsules wrap alias/level and fit localizedtitle/rating. Existing timedclock/meter/resource sockets remain.

Results show actual winner portrait bottom anchored; passive player alias/level/title and verified snapshot before→after/delta, quiet opponent profile/result, two buttons FindNextMatch/MainMenu. XP once consumes existing scene award belowresults. Missingoutcome never infers before/opponent from currentRating/HELLO. Normal game relies on authenticated assignment and actualresult.outcome. Legacy/localonly settled cannot manufacture opponent result. Capturedmatch promise is preserved by Logic.

Controlled entry ranked-review.html/ts renders actual Hud/matchResult components with fictional seededprofiles/ratings. Visible externalbanner and source guard STAGING_BUILD+DEBUG_TOOLS_BUILD+__PUNCHIES_STAGING_QA__; Build must exclude entry fromproduction and onlyincludeunderallQAflags. It performs no match/report/network call. Modes unavailable/pending/snapshot/legacy. Reviewartifact notliveplayedmatchproof.

Focused checks: tsc, passive geometry640/844/1280, bounded longCJK/Arabic/Korean aliases; exactsnapshottransition only, unavailablefallbackwhenoutcomeabsent, idempotent unsubscribe and lateguard. Browserlayout/control validation ownedBuild. NoWorkerproductionrollout required.
