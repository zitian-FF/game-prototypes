## Current milestone
Shop menu entry and Credits relocation shipped in r0080 via PR #243; shop design discussion continues.

## What was implemented
Green Shop button replaces Credits at the same title-screen position. Shop opens a coming-soon panel. Credits is accessible from Settings and returns there via Back.

## Key technical decisions
Reuse existing Phaser button/modal navigation and add a green accent to titleButton. No reward, token economy, catalog or ad integration implemented before design approval.

## Open questions
Shop catalog structure, token earning pace, unlock prices and ranked character access need design decisions.

## Known issues
Existing Phaser bundle size warning. Real rewarded ads and persistent online ownership require a separate approved implementation.

## Next proposed step
Typecheck and production build pass; Brave verifies title menu, Shop coming-soon panel, Settings → Credits → Settings, and live r0080 with no console errors. Discuss a cosmetics-first shop, optional rewarded tokens, sidegrade characters, and future account/MMR support.
