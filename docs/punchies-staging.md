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

Quickfix batch integrates translations ba2a85b9d9cf93af5898046028c03627dd5729f4, Tyke glove pivot b93930c77423fd268a5992f148bd75b0020b3d2e and approved Tyke tune restoration6484cb2d9eb72f48f7495d0d9e07808c31a710b1. Existing experimental features remain staging-only. MarcoPR350 remains open/unmerged; Kai remains a separate feature batch. Focused tune guard, roster stats, Buffalo/Survival,80 actualPuppetposes,480locales and compile pass. Owner reviews final appearance/gamefeel.
