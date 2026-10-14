# Beta UI integration contract

Art branch: `proto/punchies/beta-ui`, base `4e192cb`. Build owns the edition flag, ledger/keys, locale additions, bundle aliases, roster geometry, default-skin policy and release.

Alias these three existing modules to `src/editions/beta/` equivalents (identical filenames and exports): `scenes/ProfileScene.ts`, `ui/titleProfileEntry.ts`, `ui/resultProgress.ts`. Profile scene key remains `Profile`. Title profile entry returns the existing hit/content/refresh/alias/identity/arrow API. Result progression signature is unchanged and shows only completed whole-match count; it never awards progress.

MenuScene uses `ITCH_BETA_EDITION` to remove Shop/token/chest/Zombies and expand Single Player and Settings. Shared HUD/VS/ranked result helpers gate level/title labels, preserving alias and rating. CharacterSelectView hides its skin tray in Beta. Master/CG branches preserve existing layout.

The profile imports `betaView`, alias/default-avatar profile helpers and rating service. Build's Beta profile/roster shims must preserve `getProfileAvatar` and `setProfileAvatar` and validate only unlocked default fighters. No `ownedAvatarChoices`, XP or title-picker imports. New locale keys are Logic-owned `beta.completed_matches` and `beta.unlock_requirement`.

Local fixture has an explicitly synthetic count outside the canvas and no ledger writes. Preview-only copied edition.ts, portal/keys.ts and progress/beta.ts are NOT Art-owned and must not be included in the UI commit.
