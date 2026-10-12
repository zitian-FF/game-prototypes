# Punchies stage and approved promotion

Public preview: https://zitian-ff.github.io/game-prototypes/staging/punchies/

Build may publish completed frozen batches directly to STAGING after compile, boot/assets, staging/rating safety and focused risky-logic checks. No additional Main trigger or exhaustive visual/gamefeel playthrough is required; the owner reviews those. New requests belong to the next frozen batch. Production fixes and experimental Super/mask batches stay separate.

Pages checks out the exact `.github/punchies-staging-ref`. The wrapper shows the full source SHA, source version stamp (explicitly not an itch release), and a bounded What changed list from that source. The in-game stamp says STAGE plus SHA. SHA paths prevent mixing cached builds. Compact/web stages disable rating and use the existing fixed reset epoch `punchies-reset-2026-10-12-super-v1`.

Open **Staging QA panel** in the wrapper. Expand punchies tune, then Staging review. Choose a fighter and skin and select **Preview in Training (no unlocks)** from Menu, Training or offline onboarding. Picks last only for that Training scene; no ownership/currency/preferences are granted. **Reset staging test saves** removes only the eleven registered staging player keys, preserves the epoch receipt and unrelated/production saves, then reloads. Debug controls remain opt-in and are excluded from production's module graph.

Itch ALWAYS requires explicit owner approval of the exact reviewed source. Stage READY is not approval. After approval, run:

```powershell
./scripts/Promote-Punchies-Reviewed.ps1 -ReviewedSha <full-public-stage-SHA> -OwnerApproved
```

This dispatches the promotion workflow; it never merges experimental source into main. The SHA must equal current public staging and the repeated owner-approved SHA. CI checks out that exact source, uses committed translations, and rebuilds compact/web with STAGING off, QA off and the unchanged save epoch. Required release checks, QA/debug/currency/experimental-mask exclusion and network compatibility checks run before upload. The production rating URL comes from the existing configured variable. A differing Worker source blocks promotion until a separately approved compatible Worker rollout is recorded on main; this tooling never deploys a Worker. The successful upload increments only main's counter and records the source SHA. No counter is consumed on a failed upload. Concurrent itch workflows share one queue.

The command is not an automatic promoter and is not invoked by stage publication. Existing explicit release authorizations remain valid within their exact scope. The current experimental batch has staging permission only.

Local scripts Build/Start/Stop-Punchies-Staging use the isolated sibling checkout and localhost5310. Starting neither builds nor publishes. Keep requested public/local previews available; close owned temporary tabs and servers after checks.
