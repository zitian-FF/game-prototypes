## Current milestone
First-play UI and Rising Star reward artwork complete.

## What was implemented
Rising Star Marco has a waist-framed portrait and complete top-down puppet in standard and compact R2 art. The welcome card shows bottom-anchored Marco and the purple free chest. Coach prompts advance upon entering punch range; Skip moves to the upper right. HP-only onboarding retains fighter names and identifies Bruno as P(COM). Returning through the pause menu completes onboarding and preserves its gift. The first fight uses gameplay music, while its reward and welcome use title music. Reward acknowledgement has shared hover/pressed/disabled feedback. Initial language choice appears only when multiple translated languages are available. Removed obsolete shop artwork-pending copy, labelled the welcome voucher FREE CHEST READY and excluded unfinished Old Champ/Ring Captain art from daily offers. Restored the P logo red foot backing with transparent bottom padding and preserved artwork registration.

## Key technical decisions
Gift ownership, free chest vouchers, economy, XP rules and combat tuning stay with Claude's existing implementation. Rising Star uses one canonical glove and boot with runtime mirror aliases; its wrist registration faces right and connects at the cuff. Both profiles share identical rig pixels and geometry. Lossless originals, registration, package backups and verified R2 receipts are retained outside Git in outputs/first-play-polish. No generated art binaries committed.

## Open questions
Progress/profile/Veteran skin screens and Ring Captain/Old Champ art remain separate pending handoffs.

## Known issues
Existing Vite locale/chunk warnings persist. Brave inspected first-fight controls, skin reveal, acknowledgement, welcome framing and pause-menu return; full win and skip/replay invariants are also covered by automated tests. Physical-phone play remains a manual check. Development reloads during atlas packing can briefly request incomplete files; production builds use verified immutable assets.

## Next proposed step
Review the deployed first-play presentation, then take the separately specified profile and progression UI work.
