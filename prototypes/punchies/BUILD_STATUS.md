## Current milestone
Launch wrap-up: tutorial, bots and docs match the new combat ranges; debug tools hidden in the public build.

## What was implemented
- Tutorial texts refreshed for the new ranges, face-only defender stamina loss, the red-orange vulnerable pulse and the punish counter (guard drop and dodge tail).
- Bot spacing retuned: all hardcoded reach offsets in `src/sim/bot.ts` now come from one `connect()` helper (reach + hitRadius + hurtRadius), so the bots follow tune.json. Over 48 matches: Medium beats Easy 47 of 48, Hard beats Easy 46 of 48, Hard beats Medium 31 of 48.
- Debug tools are hidden by default: the bug button, the `tune:` label and SYNC TUNE only appear after opening the game once with `?debug=1` (remembered in this browser; `?debug=0` locks them again). All debug code is kept.
- Hub page `index.html` has a demo notice and the credits.
- Portrait note: the game is landscape only and has no rotate prompt; in portrait the canvas scales to fit and letterboxes small (documented in BRIEF.md).
- Verified: typecheck, build, all `scripts/verify-punchies-*.mjs`, rollback simulator (0 mismatches), no console errors on boot, menu and fight screenshots inspected.

## Key technical decisions
- One `connect()` helper for all bot distances instead of per-line magic numbers.
- Debug unlock stored under `punchies:debug:unlock:v1`, separate from the debug-on state.

## Open questions
- Hard shares most of Medium's style numbers; does it need its own personality?
- Jab and uppercut punishes award +2 counter stars; keep?
- BRIEF.md may need a line on the debug unlock (`?debug=1`) and the public demo wording.

## Known issues
- No rotate-to-landscape prompt for portrait phones.
- KO and result screenshots were not retaken this pass (KO art verified in earlier passes).
- Nothing verified on a real phone or with two phones online.
- SYNC TUNE fetches from GitHub; only reachable in debug builds.

## Next proposed step
CrazyGames readiness: SDK (gameplayStart/Stop, ads, mute), download size check, and Codex art and store assets.
