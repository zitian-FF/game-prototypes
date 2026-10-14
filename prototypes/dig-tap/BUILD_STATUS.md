## Current milestone

Playable tap-to-mine loop with upgrades, auto pickaxe, offline progress and a
save. Ready to playtest. Not yet tried on a real phone.

## What was implemented

- Shaft of pillow blocks in strata colours, any visible block tappable. Cracks
  grow with every tap (tapered grooves with a lit lip, more arms as health
  falls). A block gives way with a pop and dust in its strata colour.
- Buried gems: a glint shows through the block; when it breaks the gem pops out,
  hangs, then arcs to the gem counter with a sparkle trail, ring burst and
  counter bump. Collection is automatic.
- Rows scroll away as they are cleared (shaft view); depth in metres; the
  backdrop changes colour with depth. Row-cleared banner, camera shake and punch
  zoom on a cleared row.
- Upgrades: tap power, gem value, auto pickaxe (random visible block, rate by
  level). Offline progress for the auto pickaxe. Save to `dig-tap:save:v1` on
  every change (throttled) and when the page is hidden; verified by a reload.
- Rules (`src/game/`) are pure. A headless check showed offline digging matches
  digging the same blocks by hand (damage 1, 2, 5; 1 to 12345 taps) and a save
  round-trips exactly.

## Key technical decisions

- New prototype folder (`dig-tap`); `dig-match` and `dice-dig` stay as they are.
  Uses `dig-kit` pinned to 0.1.0. Terrain rendering is a copy of dig-match's, so
  it is a candidate to move into dig-kit (0.2.0, bump all pins together).
- The wall is generated from a seed per row, so a save stores only damage.
- `?test=1` exposes a hook for the Playwright script (next block position, gems,
  a grant). `?debug=1` shows the tune panel (it covers the top right) and a
  reset-save button.
- Worked on branch `ccr-1e26354f-01jcy9`, not `proto/dig-tap/...`, because the
  session was assigned that branch.
- `deploy-dig-itch.yml` (manual) now also lists dig-tap.

## Open questions

- Pacing is placeholder: roughly 2 taps per early block, a quarter of blocks hide
  gems, first upgrade after about 4 rows. Needs a playtest.
- Free tapping of any visible block: does it need structure?
- The upgrade shelf shows level and cost but not the effect (that is in the
  top line).
- BRIEF.md was written from a discussion and may need updating after playtest.

## Known issues

- No gem cap, hammer or C4, or other tools yet.
- The glint on many blocks may look busy at 25% gem chance.
- Frame rate only measured in a software-rendered test browser.

## Next proposed step

Playtest, then tune pacing and decide whether to add tools (hammer, C4) as
upgrades and the gem cap.
