## Current milestone
Tune guard for online play, restored debug unlock, and refreshed verify scripts. Builds on G.P. Tee's rig and balance correction (PR #251).

## What was implemented
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
