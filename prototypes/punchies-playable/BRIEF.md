# Punchies Playable - BRIEF

A super light, portrait, 30 second playable ad version of Punchies. A lane
style mini game with its own small rule set. It is a separate, self-contained
prototype: it does not import the main game's `src/sim`, and nothing under
`prototypes/punchies/` is changed by it.

Status: DRAFT, waiting for user approval (2026-10-08).

## Goal
A phone player can understand and enjoy the game in about 30 seconds with
two buttons, then sees a score and a call to action. The build is tiny enough
to be inlined into a single HTML file for ad networks later (target 2 to 5 MB
total; real network limits to be checked later).

## Core loop
- Portrait, phone first. The player boxer (Marco) stands fixed at the bottom
  centre, facing up. 3 HP.
- Enemies spawn off the top and walk down the lane toward the player, one at a
  time (spawn gap 1.5 to 2.0 s, `tune.json`). Enemies use the Bruno or dummy
  art set, rotated to face down toward the player.
- Only two on-screen buttons: JAB and CROSS (bottom of the screen, thumb
  reachable). Keyboard keys are a bonus (J jab, K cross), still through the
  intent layer.
- Run length 30 seconds. If HP reaches 0 the run ends early.

## Hit rules (own rule set)
A punch follows the main game's frame structure: startup, early sour (fist
extending), sweet (full extension), recovery, plus whiff recovery on a miss.
While the fist is out, it resolves against the front enemy:

- **SWEET** (contact at full extension): the enemy is knocked off screen and
  scores. Head hit = 2 points, body hit = 1 point.
- **SOUR** (contact while the fist is still extending, i.e. the enemy is too
  close for that punch): no damage to the enemy, no score. The enemy then
  punches the player.
- **MISS or no punch**: the enemy reaches its attack distance, winds up (short
  telegraph) and punches the player.
- An enemy punch that lands deals 1 damage to the player, then the enemy moves
  off to the side and leaves. There is no player guard and no armour: a punch
  in progress does not stop an incoming enemy punch.
- A sweet hit during an enemy's wind-up knocks it off before the punch lands.

### Head vs body is decided by distance
Distance is centre to centre between player and enemy. Close = head, farther =
body, and the cross reaches farther than the jab. Bands are derived from the
main game's current numbers (Marco, `fighterScale` 1.5, hurt radius 22, core
radius 10, jab reach 42 / hit radius 6, cross reach 56 / hit radius 7) using
the same formula the main sim uses: edge of band = punch reach + target radius
+ hit radius, all at scale 1.5.

| Punch | Sour (too close) | Head band | Body band |
|---|---|---|---|
| Jab | inside ~44 (min separation) | up to 87 | 87 to 105 |
| Cross | up to 105 (cross cannot get sweet while the jab still can) | 105 to 109.5 | 109.5 to 127.5 |

These are starting values in `tune.json`, tunable in the debug panel. The
numbers are copied, not linked, so later main-game balance changes do not
affect this prototype. Timing numbers are copied the same way (jab startup 6,
sour early 3, sweet 2, recovery 8, whiff recovery 4; cross startup 13, sour
early 3, sweet 6, recovery 20, whiff recovery 12; 60 Hz frames).

## End screen
Shown when the 30 s timer ends or HP hits 0: final score, a short result line,
and one CTA button. The CTA does nothing yet: a single clearly named
placeholder (`onCtaPressed` in one file, marked `TODO: CTA destination`). The
destination is decided later. No retry button unless the user asks.

## HUD
Score at the top of the screen, HP (3 pips) and a thin time bar or counter.
No version stamp (see Exceptions).

## Art and size
- Colored rectangles first. Art is swapped in only after the loop is
  confirmed working.
- Art comes from the existing R2 art pipeline, never committed. Proposed
  approach: the playable fetches the existing `punchies_assets.zip` (ETag
  cached) and a small build script keeps only the folders it needs, then
  converts to WebP: `marco_{idle,walk,jab,cross,guard,hit_light,ko}` and
  `bruno_{...}` (or `dummy_{...}`). No new R2 object is required unless the
  user prefers one.
- Frame animations from the packed atlas, not the main game's code-drawn
  puppet rig (it needs loose part images and 500 lines of code). The hit flash
  idea (short white or red strobe on the struck fighter) is copied in small
  form.
- devicePixelRatio sharpness per CLAUDE.md (capped buffer scale, camera zoom,
  Text `resolution`).
- Keep dependencies to what the stack already has (Phaser 3, Tweakpane for the
  debug panel). Report the built size in `BUILD_STATUS.md`.

## Tuning and debug
All feel values live in `tune.json` (spawn gap, enemy walk speed, attack
distance, wind-up frames, exit speed, run length, HP, punch timings, bands,
points). `tune.meta.json` describes ranges for the Tweakpane panel. The panel
is hidden unless the page is opened with `?debug=1` (remembered per browser,
`?debug=0` locks it again, same approach as `prototypes/punchies/src/debug/
debugPanel.ts`) and has a button that copies current values to the clipboard
as JSON.

## Input
Intent layer with `jab` and `cross` intents. Touch buttons and keyboard bind
to intents. Game logic never reads a key or pointer directly. Mobile touch
buttons are the primary binding.

## Build and CI
- Own Vite config and output folder (`prototypes/punchies-playable/dist`), not
  part of the root multi-entry build, so the main Punchies and hub deploys are
  unchanged. Its `index.html` lives in a subfolder the root config does not
  scan.
- CI only BUILDS it for now (a build-only workflow). No deployment workflow
  until the user names an itch.io slot. Existing deploy workflows are not
  touched.

## Exceptions to repo rules (deliberate)
- No version stamp (it would clutter an ad).
- Debug panel hidden unless `?debug=1`.
- No persistence (no localStorage save); only the debug unlock flag is stored.

## Out of scope (binding)
Audio, menus, tutorial, hint hand, shop, netcode, character select, settings,
multiple levels, powerups, guard or dodge, hooks and uppercuts, progression,
retry flow, analytics, ad network SDK wiring, single file HTML inlining
(later), deployment.

## Open questions for the user
1. **Overlap.** "One at a time" with a 1.5 to 2 s gap: should the next enemy
   spawn only after the current one has left (my proposal, about 8 to 10
   enemies in a run), or on a fixed timer so two can be on screen at once?
2. **Cross head band.** With the main game's current core radius (10) the
   cross head band is only 4.5 px wide (105 to 109.5), so most far cross hits
   score 1. Keep the derived numbers, or widen it (for example 105 to 117, the
   old main-game width scaled)?
3. **Art source.** OK to trim the existing `punchies_assets.zip` at build time
   (no new upload), or do you want a dedicated `punchies-playable_assets.zip`?
4. **Enemy set.** Bruno or the dummy as the enemy? And is the `guard` animation
   used for the enemy's wind-up pose and `hit_light` for the player taking a
   punch?
