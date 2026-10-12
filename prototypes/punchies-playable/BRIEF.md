# Punchies Playable - BRIEF

A super light, portrait, 30 second playable ad version of Punchies. A lane
style mini game with its own small rule set. It is a separate, self-contained
prototype: it does not import the main game's `src/sim`, and nothing under
`prototypes/punchies/` is changed by it.

Status: APPROVED by the user (2026-10-08). Built on branch proto/punchies-playable/brief.

## Goal
A phone player can understand and enjoy the game in about 30 seconds with
two buttons, then sees a score and a call to action. The build is tiny enough
to be inlined into a single HTML file for ad networks later (target 2 to 5 MB
total; real network limits to be checked later).

## Core loop
- Portrait, phone first. The player boxer (Marco) stands fixed at the bottom
  centre, facing up. 3 HP.
- A fixed number of zombies (`run.zombieCount`, default and maximum 50) spawn
  in every run. The pace builds: the gap between spawns shrinks steadily from
  `run.startGapSec` to `run.endGapSec` (0.7 s to 0.35 s, first spawn at 0.5 s,
  last at about 26 s), and each later zombie walks faster (`enemy.walkSpeed` to
  `enemy.walkSpeedEnd`). They enter from off-screen at several positions
  (`enemy.lanes` entry angles across the top and sides, up to
  `enemy.maxBearingDeg`) in a set shuffled order, so every run is identical and
  fair, and walk a straight line to Marco. They may overlap on screen: only the
  front-most (closest) one can be hit or attacks, the others queue behind it.
  Marco stays at the bottom centre and turns to face the front zombie. Zombies
  face Marco. Wind-up is the right fist pulling back, the player taking a punch
  is a flinch, a red tint on Marco and red screen edges.
- Zombies have 4 HP (`enemy.hp`) shown by a small bar above them. A jab does 2
  damage and a cross 4 (`punch.jab.damage`, `punch.cross.damage`).
- A defeated zombie flies off along the direction of the final blow (away from
  Marco along its approach line), makes one full 360 degree spin, fades out and
  is removed (`enemy.knockFrames`, `enemy.knockFadeFrames`).
- Only two on-screen buttons: JAB and CROSS (bottom of the screen, thumb
  reachable). Keyboard keys are a bonus (J jab, K cross), still through the
  intent layer.
- Run length 30 seconds. If HP reaches 0 the run ends early.

## Hit rules (own rule set)
A punch follows the main game's frame structure: startup, early sour (fist
extending), sweet (full extension), recovery, plus whiff recovery on a miss.
While the fist is out, it resolves against the front enemy:

- **SWEET** (contact at full extension): full damage and it scores. Head hit =
  2 points, body hit = 1 point (per sweet hit). A sweet hit that does not defeat
  the zombie staggers it: pushed back (`enemy.staggerPush`) and its punch
  interrupted. A sweet hit that defeats it knocks it off screen.
- **SOUR** (contact while the fist is still extending, i.e. the enemy is too
  close for that punch): reduced damage (`punch.sourDamageMult`, half), no
  score, no stagger. The enemy then punches the player.
- **MISS or no punch**: the enemy reaches its attack distance, winds up (short
  telegraph) and punches the player.
- An enemy punch that lands deals 1 damage to the player, then the enemy moves
  off to the side and leaves. There is no player guard and no armour: a punch
  in progress does not stop an incoming enemy punch.
- A sweet hit during an enemy's wind-up interrupts it before the punch lands (stagger, or knock off if it defeats the zombie).

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
| Cross | up to 105 (cross cannot get sweet while the jab still can) | 105 to 117 (widened by the user, 2026-10-08) | 117 to 127.5 |

These are starting values in `tune.json`, tunable in the debug panel. The
numbers are copied, not linked, so later main-game balance changes do not
affect this prototype. Timing numbers are copied the same way (jab startup 6,
sour early 3, sweet 2, recovery 8, whiff recovery 4; cross startup 8, sour
early 3, sweet 6, recovery 12, whiff recovery 8, speeded up by the user on
2026-10-12; 60 Hz frames).

## End screen
Shown when the 30 s timer ends or HP hits 0: final score, a short result line,
and one CTA button. The CTA does nothing yet: a single clearly named
placeholder (`onCtaPressed` in one file, marked `TODO: CTA destination`). The
destination is decided later. The testing build (itch) also has a RETRY button
that starts a fresh run; it is a build switch (`PLAYABLE_RETRY`, on by default,
`PLAYABLE_RETRY=0` for an ad build) and `?retry=0` hides it for a preview.
The ad build has no retry.

## Presentation (added 2026-10-12 from playable-ad research)
Visual feedback only, no rule changes (sound is in the Audio section below):
- Opening call-out "DEFEAT THE ZOMBIES!" for about a second (states the goal,
  not a tutorial), the first zombies arrive quickly (`run.firstSpawnSec` 0.1 s).
- Combo counter (consecutive sweet hits, broken by a sour hit, a miss or taking
  a punch) in the top right, with call-outs GOOD, GREAT, AWESOME, UNSTOPPABLE
  and LEGENDARY at 3, 5, 8, 12 and 20. It does not change the score.
- Floating damage numbers, score pop, a short hit-stop on a defeat
  (`view.hitStopMs`), a red danger marker above a zombie that is about to punch,
  banners HORDE INCOMING and FINAL RUSH at half and 80 percent of the wave.
- End card: result, score, zombies defeated, best combo, a goal "Can you reach
  N?" (next multiple of 10), a pulsing PLAY NOW, and RETRY in the testing build.
- Slight purple night tint on the gym floor.
Still out of scope: a hint hand, a tutorial, fake-fail tricks and analytics
events.

## Over-the-top effects (user request, 2026-10-12)
Screen effects are deliberately big, all drawn in code (a few generated particle
textures, no art files), presentation only:
- Sweet hit: layered starburst, expanding shockwave ring, streak lines along the
  blow direction, flying zombie goo and sparks, smoke, a comic word (POW! body,
  BAM! head, K.O.!! on a defeat), screen flash, camera shake, zoom punch and a
  small rotation jolt. A defeat is the biggest, with a second ring, more
  particles and a longer hit-stop (70 ms). Sour hits get a small puff and ring.
- Zombies flying off leave a smoke and spark trail.
- Taking a punch: red embers, ring and burst, OUCH!, red flash, strong shake,
  80 ms hit-stop, red screen edges.
- Each punch draws whoosh streaks (heavier for the cross).
- Combo call-outs get bigger and brighter by tier (colour, size, confetti from
  both sides, flash, shake). The combo counter changes colour by tier.
- HORDE INCOMING and FINAL RUSH pulse the screen edges red.
- End card: confetti for a finished run, embers and a red flash for an overrun.
- Call-out text shrinks to fit the screen width.
`tune.json` has an `fx` block (`intensity`, `shake`, `particles`, `flash`,
`zoomPunch`) so the strength can be dialled in the debug panel, 0 to switch off
and up to 2. Particle counts are capped for phones.

## Audio (in scope from 2026-10-12, user override)
Generated sound effects only: every sound is synthesised in code with Web Audio
(oscillators, filtered noise, short envelopes), so there are no audio files and
no added download. No music. Sounds: jab and cross whoosh on each punch, head
hit, body hit, defeat, sour thud, player hurt, combo chimes (4 tiers), horde and
final rush rumble, opening ping, end jingle (win or lose) and a UI tick. Browsers
block sound until the first tap or key press, so the audio starts then. A small
speaker toggle (top left, under the HP gloves) mutes it, `?mute=1` starts muted,
and it is not saved between visits. Master volume is `audio.master` in
`tune.json`. Sound is paused while the page is hidden.

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
- Art refresh (2026-10-11): the Punchies art zip in R2 was trimmed and the main
  game now draws boxers as a puppet rig from loose parts (head, torso, glove,
  boot; arms and legs drawn in code), so the old composited frame animations
  were dated. The playable builds a small copy of that rig (`src/view/Rig.ts`,
  own tune values in `tune.json`) using Marco for the player and the zombie
  parts for enemies. Left glove and boot are the right ones flipped, as in the
  art's `part-mirrors.json`.
- Scene art: the gym floor as the backdrop (middle slice of the landscape
  image, no boxing ring, ropes or mat, per the user 2026-10-12), glove icons on
  the buttons and as HP, and the Punchies logo on the end screen. Hit effects
  (starburst, flash, popups) are drawn in code.
- `scripts/prepare-art.mjs` copies only those pieces from the fetched zip,
  byte for byte (no resizing or re-encoding, as `prototypes/punchies/art/
  PRODUCTION_STANDARD.md` asks for prepared art), about 200 KB. Without art the
  same rig runs on generated coloured placeholder shapes.
- devicePixelRatio sharpness per CLAUDE.md (capped buffer scale, camera zoom,
  Text `resolution`).
- Keep dependencies to what the stack already has (Phaser 3, Tweakpane for the
  debug panel). Report the built size in `BUILD_STATUS.md`.

## Tuning and debug
All feel values live in `tune.json` (zombie count and spawn window, enemy walk speed, attack
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
- CI only BUILDS it for now (a build-only workflow). Existing deploy
  workflows are not touched in this branch.
- Deployment target (decided 2026-10-08): the itch.io project currently used
  by mp-console. The deploy workflow is a later, separate task, following
  `deploy-wip-itch.yml` / `deploy-mp-console-itch.yml`. What happens to the
  existing mp-console deploy workflow and hub link is still to be confirmed
  (see open questions).

## Exceptions to repo rules (deliberate)
- No version stamp (it would clutter an ad).
- Debug panel hidden unless `?debug=1`.
- No persistence (no localStorage save); only the debug unlock flag is stored.

## Out of scope (binding)
Music and recorded audio (generated effects are in scope, see Audio), menus,
tutorial, hint hand, shop, netcode, character select, settings (except the
speaker mute toggle),
multiple levels, powerups, guard or dodge, hooks and uppercuts, progression,
retry flow (except the testing-build RETRY button above), analytics, ad network
SDK wiring, single file HTML inlining (later), deployment.

## Decisions (2026-10-08)
1. mp-console slot: REPLACE. The playable deploys to mp-console's itch.io
   project. At deploy time (a separate later task) the old
   `deploy-mp-console-itch.yml` is retired and the hub's mp-console link is
   removed or relabelled. Not done in this branch.
2. Enemies can overlap on screen; front-most is the target.
3. Cross head band widened to 105 to 117.
4. Enemy is Bruno. Poses as listed above.
5. Art: sprites, trimmed from the existing `punchies_assets.zip`.
6. Art refresh (2026-10-11, user request): puppet-rig fighters from the new
   loose parts, zombies as enemies, new scene art. Supersedes the Bruno and
   frame animation decisions above. 2026-10-12: boxing ring removed, gym floor
   only.
7. 2026-10-12 (user request): fixed zombie count on an even schedule from
   several off-screen entry positions, defeated zombies fly along the blow
   direction with one 360 spin then fade, RETRY button in the testing build.
8. 2026-10-12 (user request): zombies have 4 HP, jab 2 damage and cross 4 (sweet
   full, sour half), faster cross, 50 zombies with spawn pace and walk speed
   building through the run.
9. 2026-10-12 (user request: improvements from the ad research): the Presentation
   section above.
10. 2026-10-12 (user override): audio is in scope, using generated sounds (the
   Audio section above). The earlier "no audio" and out-of-scope audio items no
   longer apply.
11. 2026-10-12 (user request): the effects are made over the top (the
   Over-the-top effects section above).