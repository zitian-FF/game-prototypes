# Punchies art

Bold navy outlines and flat cel shading. Navy `#101b32`, slate `#253650`,
cream `#fff1d1`, gold `#ffc84a`; existing player colors remain authoritative.
Marco wears blue/cyan; Mia red/pink with a gold ponytail; Bruno green/lime.
Body scales remain 1 / 0.88 / 1.12. Changes are presentation only.

Original vector-authored characters, poses, stage and UI are rendered offline
by `export.mjs` using the existing Sharp dependency, then loaded as raster
assets in Phaser. The former procedural rendering remains as fallback.
The restored approved composite guides the fight-first reskin. Headguards keep
padded panels and seams; the ring uses a slate-blue floor and rounded posts.
Jab/cross have separate transparent left/right glove icons. The gym props are
vector-authored; the retired cinematic menu is replaced by coherent gym art
until a dedicated menu pass. Mia clothing/face revisions are deferred by owner.
This is an initial adaptation, not an exact reproduction of the master.

## Layered ring pass

The approved logo is cut from the original 1844x853 board using `extract-logo.cjs`;
no full-board regeneration. Export with `node prototypes/punchies/art/export.mjs
'' /absolute/path/logo.png` (empty second argument uses the authored gym menu).
The optional third argument copies the logo into `loose/logo.png`; it is kept
when omitted. Menu and loading screens show the logo with text fallback.

Body keys stay `<prefix>_<action>`. Matching `<prefix>_<action>_feet` folders
contain only feet, same frame numbers, canvas and registration. Bodies contain
neither baked feet nor ground shadow. There are 210 folders / 1344 frames.
Claude owns FighterView/KoAnim feet placement and screen-direction shadow wiring;
these exports alone do not render a separate feet layer in the current runtime.
Grouping remains derived from the existing character/alt prefixes.

The ring adds `ring_apron` and `ring_turnbuckle` loose layers with padded posts
and highlighted ropes. The flat floor footprint stays unchanged; the existing
keystone shader handles tilt. The near apron fits inside the unwarped camera so
its pixels survive the shader's input render. No tuning or simulation edits.
Run `node prototypes/punchies/art/check-layers.cjs` before upload.

The gym backdrop uses a shared vanishing point and faint floor seams. Props are
limited to grounded rear benches, bottles and folded towels, outside ring and
thumb-control zones. The HUD has rounded layered housings, lit fills and HP/STM/
STUN labels; values, damage trail and tutorial reveals retain their existing logic.

## Export contract

Fighters face right on a transparent **256x256** canvas, registered at
**(128,128)**, displayed at half size before character scale. Never trim,
crop, recenter, or realign source frames. Only the existing packer trims.

| Action | Frames |
| --- | ---: |
| idle | 6 |
| walk | 8 |
| jab | 6 |
| cross | 8 |
| hook_l / hook_r | 8 each |
| uppercut | 8 |
| guard / perfect_guard | 4 each |
| dodge | 6 |
| hit_light | 4 |
| hit_heavy | 6 |
| stunned / exhausted | 6 each |
| ko | 8 |

Prefixes: `marco`, `marco_alt`, `mia`, `mia_alt`, `bruno`, `bruno_alt`,
`dummy`. **105 folders / 672 frames**, plus 16 loose images. Animation
configs are derived exclusively from the packer's folder index and resolve
frames across both atlas sheets. Simulation phases sample attack frames at
tuned startup/active/recovery boundaries. KO motion/timing remain unchanged.
Missing individual animations or loose textures use the original drawings.

Layout: `packed/<prefix>_<action>/0001.png...`; `loose/<name>.png`.
The source ZIP contains no atlases. Packing yields two sheets, each at most
2048x2048, plus hashes/fetch timestamps in `manifest.json`.
No PNG, ZIP or generated atlas is committed.

```sh
node prototypes/punchies/art/export.mjs /external/path/menu_background.png
npm run pack:assets punchies
npm run typecheck
npm run build
```

The exporter retains an existing menu illustration if its optional path is
omitted. For a fresh complete export, supply the approved illustration.
Upload `punchies_assets.zip` to the configured public R2 bucket, notify the
owner on every overwrite, and keep credentials outside the repository.
The WIP workflow caches sources by ETag, packs each build and embeds the
generated file/animation index. A missing object builds fallback; other HTTP
failures fail the workflow instead of silently shipping stale art. After an
art-only R2 upload, dispatch the WIP workflow to rebuild its embedded index.
Local dev requires restarting Vite after repacking.

## Verification

### Approved title/arena layers (2026-10-06)

`gym_background.png` contains no baked ring or UI. `arena_floor.png`,
`arena_rear.png`, `arena_front.png`, `arena_near.png` and `arena_apron.png` are alpha PNGs with identical
1299x1211 registration; playable floor bounds are (186,163) to (1114,875).
`ArenaArt` reuses them on Menu and FightStage. Rear ropes draw at depth 1,
boxers at about 9–11, and side/front ropes at 30 and near ropes/apron at 31–32. The existing perspective
shader applies to the arena and boxers together. Never trim/re-export these
five PNGs independently. Gameplay reassembles native rope and round-cap crops (`arena_rope.png`, `arena_cap_neutral.png`, tinted to character colours) from the same master to fit the fixed camera; the title retains the full ring. Their lossless partition reconstructs the isolated
ring master exactly. All pre-existing R2 entries remain byte-for-byte intact.

Built-in imagegen produced the gym and isolated ring from the approved title
reference. Prompt: preserve its navy-outlined cartoon art; remove all UI for
a quiet gym layer; extract a transparent ring with red/cream ropes, red/blue
corner pads and slate canvas, without a baked camera taper. Runtime UI is
drawn separately. The workspace `outputs/title-screen-v1` keeps design
masters, alpha layers, registration and bundle validation outside Git.

```sh
node prototypes/punchies/art/verify.cjs
```

Use `PLAYWRIGHT_MODULE` for an existing bundled Playwright installation,
`PUNCHIES_URL` for a production preview URL, and `SCREENSHOT_DIR` for captures.
The test uses a browser-only hook, checks registered poses/alternate colors,
drives menus/controls, captures KO/results/tutorial/lobby, checks the version
stamp and `?debug=1`, and fails on browser errors. Lobby TURN/relay sockets
are mocked; this is a presentation test, not an online match.
`EXPECT_FALLBACK=1` checks an art-free build.

## Generated menu prompt (built-in imagegen)

Create a polished 2D videogame MAIN MENU BACKGROUND for Punchies, a mobile
top-down boxing brawler. Wide landscape 2.16:1 composition 1688x780 desired.
Bold navy ink outlines and flat cel shading, restrained navy #101b32 slate
#253650 cream #fff1d1 gold #ffc84a. A boxing gym at night with dramatic gold
overhead lighting, viewed from above at a slight illustrative angle, an empty
boxing ring anchored on the RIGHT half, cyan and red rope accents, gym
lockers, championship banners without words, scuffed canvas, warm restrained
comic book texture. LEFT half is dark navy negative space, quiet and
uncluttered for separate UI buttons and title. Absolutely no text, no letters,
no logos, no people, no UI controls. Crisp professional arcade visual,
readable at mobile size.
