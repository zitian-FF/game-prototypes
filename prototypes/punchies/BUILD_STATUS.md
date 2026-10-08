## Current milestone
Tune guard for online play, restored debug unlock, and refreshed verify scripts. Builds on G.P. Tee's rig and balance correction (PR #251).

## What was implemented
Approved starter-skin release: Cyan Rush (Marco, cyan kit/black hair/original skin), Violet Resolve (Mia, violet kit/brunette), Golden Veteran (Bruno, yellow kit/tanner skin including runtime limbs). Free selectable alternates use deterministic source-preserving canvas palettes; existing paid palette/unique skins remain in the shop. Automatic mirror-match hue swap removed; identical skins supported and tested. Solid restrained blue/red floor markers carry P1/P2 or P(COM), below fighters and transformed with the arena; KO loser marker retained. Typecheck, build, roster/shop/palette tests pass. Included with audio/settings/result polish in PR #253 on user merge approval.

Approved audio release: synthesized menu select/confirm/back, stamina rejection/emergency/recovered, start/timeout bells, shop/token/chest/reward/result cues; existing combat/KO cues retained. Shared audio/mixer.ts provides separate BGM/SFX gain buses, saved per-channel volumes, master mute and subscription for future music. Settings offers volume +/- controls and Mute All from title and in-game menu, with Input Setup and Credits. Credits wording updated to ZeeTea with Claudia, G.P. Tee and Gemma. BGM now connected locally: title for menus/shop, character-select for roster, gameplay for fights/training/tutorial. Streamed looping MP3s route through the shared BGM gain and mute; gesture unlock, crossfade, hidden-tab pause, paused fight menu ownership and teardown are implemented. Stage approved external files with scripts/stage-punchies-music.mjs before a build. Music bundle uploaded separately to R2 and SHA-256 verified; CI fetches the pinned bundle before deployment. Full original MP3 tracks retained (12.48 MB bundle); edited stingers and seamless-loop listening review deferred. Local VS feedback index regression fixed and tested. Music regression test passes; no subjective listening or seamless loop-boundary claim. Audio regression test verifies persistence, bounds, routing, active-bus mute, storage failure handling and denial throttling. Typecheck/build pass; Brave settings/reload/in-game entry checked, no browser errors.

Result menu polish prepared on proto/punchies/result-polish: unframed gold victory and pink-red defeat text on a quiet flat backing; raised enamel reserved for actionable buttons, clearer score, larger green Rematch and red Main Menu. Existing timing and input navigation retained. Typecheck/build pass; victory and defeat visually checked in Brave using the actual matchResult renderer over an arena screenshot. No new boot errors after correcting the temporary preview import. Edited music stingers are outside the repo in outputs/music-v1/stingers, with preserved original downloads and edit notes. 5/4/3/2 seconds, .65-second fade, MP3 and OGG. Main tracks packaged separately in R2 with observed provenance. Stingers remain disconnected pending testing; loop-boundary listening review and unresolved model/plan metadata remain pending.

- Tune guard: `validateTuneJson` in `src/sim/tune.ts` parses the host's tune and checks every known value against its type and the min/max in `tune.meta.json` (468 numeric values, all covered). The guest runs it before adopting the host's tune; on failure it leaves the match and shows "Host sent invalid settings". It never clamps, because a guest that clamped would simulate different numbers from the host and desync. SYNC TUNE uses the same check.
- Debug unlock restored: PR #249 had dropped the `mountDebugPanelIfRequested()` call from `main.ts`, so `?debug=1` showed nothing. The call is back. The bug button, tune label and SYNC TUNE stay hidden unless the game was opened once with `?debug=1` (remembered per browser; `?debug=0` locks it again).
- New `scripts/verify-punchies-tune-guard.mjs` (valid tune, out of range, wrong type, null, malformed JSON, infinite number, non-object root, unknown keys ignored, every `tune.json` value inside its range).
- Refreshed two verify scripts that tested rules Codex changed on purpose: `verify-punchies-combat-ranges.mjs` now finds face and body bands by scanning instead of pinning pixel values (geometry scales with the artwork, exact boundaries are in `test-punchies-geometry.mjs`), and `verify-punchies-stamina-dodge.mjs` now covers dodge only, since low-stamina punches are allowed (see `test-punchies-emergency.mjs`).

## Key technical decisions
- Reject, do not clamp, an invalid host tune.
- Unknown keys in a received tune are ignored, as before. A partial tune is allowed.
- A new tune value outside its `tune.meta.json` range now fails the verify script, so a future tune change cannot silently break online play.

## Open questions
- Portal launch (CrazyGames, Poki, Playgama): hosting choice and exclusivity, a portal-agnostic layer for ads, storage and analytics, and whether ranked waits for phase 2. Research notes are in the session log; BRIEF.md needs a section on these once decided.
- Hard bot personality, and whether jab and uppercut punishes should award +2 counter stars.

## Known issues
- Real ads, authenticated ownership, ranked, MMR and leaderboards remain deferred. Shop and wallet are local drafts.
- Physical controller and two-device online tests are still pending. The guest rejection path is covered by the validator test, not by a live two-device run.
- Nothing verified on a real phone this pass.
- `src/shop/draft.ts` and other saves use `localStorage` directly; they will move behind the portal storage adapter.

## Next proposed step
Portal-agnostic layer (platform events, storage adapter, rewarded ads in the shop, analytics), once art work settles.
