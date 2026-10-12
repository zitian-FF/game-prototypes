# Punchies staging

Public preview: https://zitian-ff.github.io/game-prototypes/staging/punchies/

Local preview: http://127.0.0.1:5310/

Run `scripts/Build-Punchies-Staging.ps1`, then `scripts/Start-Punchies-Staging.ps1`. Stop with `scripts/Stop-Punchies-Staging.ps1`. The launchers use the isolated sibling checkout `work/punchies-local-staging` and `outputs/staging/site`; the server binds only localhost and runs in a hidden Windows process. Starting does not build or publish. Rebuild then refresh to see current local staging.

Pages checks out the exact commit in `.github/punchies-staging-ref`, builds compact/web and adds it beneath `dist/staging/punchies`. Main contains infrastructure and the hub link only; SUPER source remains on `staging/punchies-super`. Updating the public stage requires selecting a reviewed commit in the pin and merging its infrastructure change. This does not trigger itch publication.

The wrapper labels commit, branch, build time and profile. Game and assets use `builds/<full SHA>/game/` URLs, avoiding stale asset reuse across builds; local responses are no-store. Pages controls public cache headers, so the hub also supplies a revision query. There is no service worker. All delivered files are same-origin on Pages; runtime asset CORS configuration is unnecessary. Existing R2 ZIPs are fetched and hash-verified at build time, not extracted by the browser. No bucket, domain or access changes.

The default staged game has no rating endpoint compiled, preventing live-rated registration, matchmaking and result submission. AI/local play is available; no separate test Worker is provisioned. Casual room play uses existing peer signaling and is not isolated matchmaking infrastructure.

Optional effect review is a controlled contact fixture behind `PUNCHIES_STAGING_QA=1`. The normal production build excludes its HTML, JS entry and diagnostic marker; the staging builder verifies exclusion before generating the opted-in package. QA does not alter the default game. No fixtures are added to the itch release.

Pending Marco balance PR350 remains open and untouched; this preview uses live150 balance plus reference costs that preserve current damage. Unique Supers, Kai, title-screen redesign and Ranked identity changes are excluded. Physical mobile/controller and difficulty balance validation remain separate.

Current reviewed staging pin354e702 includes the combined reset/SUPER/single-confirm release. Build production with STAGINGoff, QA0 and STAGING_QA0; stage uses STAGINGon, QA1 and STAGING_QA1. Both use the stable web reset epoch punchies-reset-2026-10-12-super-v1; staging keys are isolated. Never derive reset IDs from a commit or build counter. Production paid chest caps remain; stage removes only daily paid caps, preserving costs/ownership/pools. Local audit setup is outside all delivered artifacts. Pages excludes the packager's sibling production review directory.
