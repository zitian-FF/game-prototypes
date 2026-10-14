## Current milestone
Beta-only UI ready on Art branch `proto/punchies/beta-ui`, based on `4e192cb`; integration and release belong to Build.
## What was implemented
Profile scene and title entry show alias/default-fighter avatar, completed match record and real rating-service states. Roxy and Nadia unlock milestones use the Logic ledger at three/five completed whole matches. Results show only completed match count. Beta menu hides Shop/tokens/chests/Zombies; selection hides skin tray; HUD/VS/ranked results hide level/title labels.
## Key technical decisions
Three Build compile aliases target `src/editions/beta/ProfileScene.ts`, `titleProfileEntry.ts`, and `resultProgress.ts` with matching exports. Shared scene changes are gated by `ITCH_BETA_EDITION`. No new generated assets, economy writes, XP awards, tuning changes or roster geometry edits. Default avatar crops match their target aspect ratio.
## Open questions
Build owns final alias/lean profile dependencies, edition flag, ledger/keys, six-language keys, default-skin inbound policy and release packaging.
## Known issues
Local UI fixture uses explicitly labelled synthetic match counts with no ledger writes. Real match completion, backend Elo, physical controller, portal and final package are not validated by this UI fixture. Menu review fixture does not load arena layers. Preview dependency copies are deliberately excluded from Art commit.
## Next proposed step
Integrate Art UI into Build's Beta runtime branch once. Verify actual five-fighter roster/default avatars, completed-match milestones and stripped artifact before publication.
