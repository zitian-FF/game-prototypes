# Punchies editions in the shared build pipeline

Build from the same MASTER source and approved prepared art. Quality and portal remain independent from edition policy:

    node scripts/build-punchies-profile.mjs compact --edition crazygames --portal crazygames
    node scripts/build-punchies-profile.mjs standard --edition crazygames --portal crazygames

The current commands without `--edition` retain MASTER behavior and their CrazyGames portal default. MASTER output paths and save keys stay unchanged. Explicit CG output uses `dist/punchies-crazygames-compact-crazygames` (or standard), with separate edition/quality/portal staging roots and verified shared archive cache. CG retains all eleven approved fighters, cosmetics, progression and rewarded ads. Its top row is Marco/Mia/Bruno/Roxy/Nadia; bottom is Tee/Tyke/Dragon/Longan/Captain/Kai. It removes the unused thirty-slot reserved roster layout, without inventing a fighter omission.

The manifest drives runtime roster order, precompile tune and art/index selection, distinct saves and online fingerprints/room namespaces. Prepared art is checksum-verified; retained mirror sources and portraits must exist. Identical CG11 art remains byte-identical to MASTER; this is not a new lossy pass or a claim of a smaller fighter payload. Economy/progression/cosmetics are retained. Actual ads require the real CrazyGames SDK/ad availability; Basic Launch may report unavailable. No mock result is a real ad delivery claim.

Normal CG artifacts use ordinary production flags; isolated CG staging uses staging saves/QA and disables the rating endpoint. The Pages workflow can publish `/staging/punchies-crazygames/` from its own source pin and retain the normal artifact as a GitHub Actions download while preserving `/staging/punchies/` MASTER. No CrazyGames portal submission or live itch deployment is implied.

ITCHBETA remains fail-closed until completion callers, UI/economy removal, inbound skin/roster policy and smaller selective bundle are finished. Its contract is Marco/Mia/Bruno initially, Roxy after three and Nadia after five actual whole completed matches, default skins only. Do not flip readiness to enable a partial Beta edition.
