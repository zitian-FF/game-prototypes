# Changelog

Base-level (repo-wide) changes that individual prototypes should
account for the next time they're touched. Newest entries first.

## 2026-08-27 — React + Tailwind added for UI chrome

**What changed:** React and Tailwind CSS are now locked stack
additions (see CLAUDE.md Stack section), used exclusively for UI
chrome layered over the Phaser canvas. See CLAUDE.md's "UI
implementation split" section for the full rule.

**Why:** Claude Design produces React/Tailwind mockups natively.
Wiring those directly (no HTML/CSS translation step) avoids a
lossy port and enables a future shared UI component library
across prototypes.

**Applies to:** All prototypes, retroactively.

**Action needed per prototype:** None automatically. Adopt
React/Tailwind only when that prototype's next UI work begins
(Stage 3+ for suits-mp is the first case). Existing UI code is
not being force-migrated on its own.
