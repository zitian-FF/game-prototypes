## Current milestone

Art loading optimisation: the boxer art now downloads on demand instead of all at boot. Art itself (merged as PR #194, uploaded to R2) is unchanged.

## What was implemented

- Packer (opt-in per prototype in `scripts/pack-assets.js`, `ATLAS_GROUPING`) now writes one atlas per boxer group (`marco`, `marco_alt`, `mia`, `mia_alt`, `bruno`, `bruno_alt`, `dummy`) plus `atlas/groups.json`, derived from the folder names. Each group is about 0.8 to 0.9 MB. Other prototypes still pack one shared atlas.
- Boot loads only the loose UI files (about 0.3 MB) behind a loading bar. The menu no longer waits on any fighter art.
- Fighter groups load in the background through the ArtBoot scene, which now stays running as a persistent loader (`art.ts`: `prefetchGroups`, `whenGroupsReady`, `fighterGroups`, `trainingGroups`).
- Character select prefetches the boxers on show, so a fight usually has its art ready.
- Single Player, Local VS, Training and Tutorial wait for their groups behind a loading bar, then build. Online Match only prefetches (the session is live), so late art pops in over the procedural fallback.
- A group that fails to download is treated as done and that boxer uses the procedural fallback.

## Key technical decisions

- A scene may not wait inside the online Match scene: its Rollback session is already wired, so it prefetches instead.
- The loader scene has to keep running because Phaser's loader only ticks while its scene runs; `main.ts` ignores `ArtBoot` when re-laying out screens.
- Builds without `groups.json` (older zip) fall back to loading every atlas at boot. Builds without art make no asset requests.
- No new dependency and no tune or sim changes.

## Open questions

- WebP for the atlases (`sharp` is already a dependency of the pack script) would cut size further but changes how the art is encoded. Needs an owner decision and a visual check on the outlines.
- Dropping the alt-colour atlases in favour of runtime tinting would save about a third of the fighter art but changes the look. Needs owner and Codex input.

## Known issues

- Measured locally with Playwright (not on a real phone): menu loads about 277 KB of art (was about 6.2 MB); a Marco mirror fight loads about 1.9 MB; Training on a throttled 400 KB/s link took about 7 s behind the loading bar.
- Character select shows the procedural helmets for a moment until the boxer atlas arrives.
- The online Match pop-in path and the failed-download path were not exercised in a browser.
- Real-phone networking and hardware controllers unverified. Existing Phaser bundle-size warning.

## Next proposed step

Measure on a real phone, then decide on WebP atlases. Art refinement passes (Codex) continue separately; the perspective tilt for the ring is still waiting on the owner.
