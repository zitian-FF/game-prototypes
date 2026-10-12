## Current milestone
Validated compact quality assessment release on live148 base; Main explicitly authorized merge/deploy.

## What was implemented
Survival 30-second waves, bosses every third wave, READY/FIGHT each wave, edge 6–10 HP zombies, bounded progression/boss coordination and cumulative run statistics/save. Removed stale Tee welcome auto-grant while preserving legitimate ownership. Automatic Ranked queue with private WebRTC rooms; Casual retains manual host/code. Portrait-only roster movement, persistent static UI/stat fills, dimmed lock cards/headshots and sharp floor labels. Opposing fire trails/collision, rarity pull accents and restrained victory effects. Normalized escaped Survival hint line breaks.

## Key technical decisions
Integrated Logic a015fc2, VFX c23eb75, Art b069dcf, focused fixture ef48dde and formatting39f743e only. Preserved current main tuning and shared FIGHT entrance/fade-start unlock. WIP quality selected by .github/punchies-wip-profile=compact; itch portal remains web. Explicit profile commands/CI default CrazyGames. Worker deployment must succeed for the same server-changing release SHA before frontend upload. No new downloadable art/R2 changes. Compact assets freshly verified; inventory and parity against recoverable live148 standard pass.

## Open questions
Physical Android spark behavior/mobile60fps and native-speaker translations remain unverified. Tee actual appearance-writer root cause unproven; ownership-isolation regression passes. Future Ranked snapshots dddecf0 and unapproved identity/redesign mockups are excluded.

## Known issues
Old Survival checkpoints cannot resume under the changed configuration. Cold palette work still peaks around88ms in owner evidence. Compact uses smaller/lossier portraits/backgrounds/arena and64kbps AAC music; no visually lossless or subjective listening-quality claim. Browser result/rematch evidence uses real clients/Worker with an explicitly injected result, not a fully played KO. Ranked remains anonymous/self-reported with legacy endpoint, no anti-cheat guarantee.

## Next proposed step
Merge and deploy this complete compact batch, verify exact CI artifact bytes/live version and Worker receipt, then obtain owner's quality assessment. Evidence: outputs/compact-wave-release in Build workspace; all combined checks passed after focused fixes.
