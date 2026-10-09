# Punchies art

For all new artwork and asset deliveries, follow the authoritative
[art production and compression standard](PRODUCTION_STANDARD.md).
The export notes below include historical milestones; the standard defines
current master preservation, registration, both quality profiles and release checks.

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
boxers at about 9–11, and side/front ropes at 30 and near ropes/apron at 31–32.
Both title and gameplay use the full five-layer assembly, retaining the same
red/blue posts, apron and steps. Gameplay fits the whole ring world below the
HUD and restores the master aspect instead of adding a second keystone warp.
The simulation geometry stays unchanged. Never trim/re-export these
five PNGs independently. Their lossless partition reconstructs the isolated
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

Palette skins use render/skins.ts and skinPalette.ts to recolour base portraits and rig parts on demand, cached by base texture and skin ID. No palette PNGs or alternate atlases are shipped. pack-assets filters legacy starter _alt animation folders and duplicate loose textures; unique skins retain their separate artwork. Matching fighters share the base art group and can equip identical skins.

## Active asset cleanup (2026-10-09)

Full-quality art, original music and the historical parts ZIP are recoverable in
[Punchies asset archive](https://drive.google.com/drive/folders/14OJLKjyM0pDSUxsb_vDDkFtMYRqZuj02).
The folder includes inventories with original/active paths, reasons, byte sizes
and SHA-256 hashes. Upload sizes and full streamed downloads were verified before
the R2 replacements. Never delete this backup to make a runtime package smaller.

The active R2 art ZIP contains prepared loose parts, 10 persisted mirror aliases
in root `part-mirrors.json`, and `active-assets.json` marking prepared sources.
It contains no `parts/` design masters, obsolete starter `_alt` frames, or 13
audited superseded loose textures. Registered base/dummy animation, layered
effect and feet frames remain available as fallbacks and for the playable
consumer. Ring fallbacks, token fallback and both approved unique skin rigs stay.
The packer reads persisted aliases when source mirror masters are absent.

Prepared loose files copy exactly. Tyke/Longan sources retain full canvases and
receive their existing .86/.75 waist framing once in the packer. Portraits fit
within 1280 pixels at WebP quality 90; gym/select backgrounds use quality 90.
Registered arena layers stay lossless at 1299x1211. Atlas sheets now use lossless
WebP without changing trim offsets, frame geometry or the 2048px sheet limit.

Music remains three full stereo 44.1kHz MP3 tracks; 128kbps replaces 192kbps.
Duration differences are checked within 0.1 seconds; scene mapping, looping,
gesture unlock, stingers, pause and visibility behavior remain unchanged.
The fetcher verifies the new audio ZIP SHA-256 in `music-manifest.json`.

Offline, deterministic cleanup commands (no cloud writes):

```sh
npm run pack:assets punchies
node scripts/clean-punchies-assets.mjs original-art.zip output-directory
node scripts/optimize-punchies-audio.mjs original-audio.zip output-directory /path/to/ffmpeg
node scripts/test-punchies-asset-optimization.mjs
node scripts/check-punchies-budget.mjs
```

Run the art cleanup against freshly packed original sources. It preserves its
input ZIP and inventories every decision. Audio cleanup also requires ffprobe
beside ffmpeg; neither is needed by normal CI builds or asset fetching.

The conservative WIP package fell from 30.28 MB to 16.50 MB, counting all shared
build files, Punchies art, music, stingers, HTML and provenance. The build budget
check rejects packages above 20,000,000 bytes, above 1500 files, or portraits at
or above 1,000,000 bytes. This intentionally counts all dynamic content: the
[CrazyGames mobile rule](https://docs.crazygames.com/requirements/technical/)
measures initial download through the first Gameplay start event with SDK
integration and otherwise uses the total package. Its separate total package
limit is 250 MB with SDK integration, and its mobile homepage threshold is 20 MB.

## Standard and compact profiles

The WIP deployment keeps its existing standard art and MP3 music. Profile builds
use the same game code and texture keys, and separate staging/output folders:

```sh
npm run build:punchies:standard
npm run build:punchies:compact
npm run build:punchies:compact -- --portal poki
npm run build:punchies:compact -- --portal playgama
```

Both profile commands and CI default to CrazyGames. Pass `--portal web` to
produce a standalone web build. Portal integration and asset profile are independent: either profile accepts
`web`, `crazygames`, `poki` or `playgama`. Outputs are
`dist/punchies-<profile>-<portal>/`. The portal-ready game entry is
`index.html` at the package root. Each build contains only its chosen profile.
CI's **Build Punchies asset profiles** workflow builds both profiles, verifies
inventory and parity, and saves downloadable artifacts; manual runs select the
portal. It does not publish a game to a portal account.

Compact portraits use original masters, existing waist framing, maximum 768px
and WebP Q78. Backgrounds and every registered ring layer fit within 960px at
Q72; other loose art uses Q72. Fighter parts remain byte-identical because they
are already small and their pixels drive palette masks. Atlas registration stays
identical; a lossy Q65 atlas is used only when smaller than the lossless standard
sheet. Transparent alpha remains preserved. Music is full-length AAC 64kbps in
M4A, stereo 44.1kHz; stingers, scene mapping and looping remain unchanged.

Prepared compact R2 archives and SHA-256 pins live in `asset-profiles.json`.
Cache folders are isolated by profile and archive hash. `--fresh` verifies new
downloads; `--offline` explicitly uses existing verified local inputs. The
compact build checks its recorded standard-art ETag and standard-music hash,
and refuses to silently ship outdated art when standard content changes.

To regenerate compact art, first pack current standard sources, then run
`node scripts/prepare-punchies-compact.mjs original-art.zip public/prototypes/punchies/assets output-directory`.
For music use the existing offline audio optimizer with `--compact`. Upload the
separate `punchies_compact_assets.zip` and `punchies_compact_audio.zip`, update
their hashes and standard-source identity in `asset-profiles.json`, and build
both profiles. The preparation scripts never write cloud objects or alter input
masters. Inventories retain source lineage and encoding decisions.

Budgets are 20 MB standard and 10 MB compact, including code, art, audio and
provenance. Current isolated builds are about 16.15 MB standard / 9.44 MB
compact. The compact profile is deliberately lower quality and should receive
visual/listening review for new artwork or music before portal submission.
