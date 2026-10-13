# Shared edition preparation

`prototypes/punchies/editions.json` is the authoritative edition contract. Quality (standard/compact) and portal integration remain independent settings in the existing profile pipeline. The current profile CLI still defaults to CrazyGames; adding the manifest does not change any existing build or save key.

MASTER has all eleven fighters. CrazyGames has the same eleven in rows of five and six. ITCHBETA includes only Marco/Mia/Bruno/Roxy/Nadia default skins, with Roxy after three and Nadia after five actual completed whole matches. The standalone Beta completion API supplies the ledger; it still needs terminal match callers and UI integration.

The helper provides validated policy hashes, distinct edition/quality/portal identities, and a non-mutating precompile tune subset derived from MASTER. Runtime callers, catalog/art selection, online policy/cohorts, namespace binding and the CG layout are not yet connected. The two new editions fail closed until those complete gates are implemented. No new publication is authorized by this preparatory commit.

Next: connect edition identity to the existing profile builder, prune indexed art and catalogs before Vite, bind runtime/local/inbound roster and skin policy, isolate storage and matchmaking cohorts, then integrate Beta menu/results and milestone callers. Verify missing/disallowed assets and inbound fighters fail closed. Preserve MASTER keys and the unchanged reset epoch. No asset re-encoding below the owner threshold.
