# Punchies art production and compression standard

Effective 2026-10-09. This is the current production contract for Punchies art,
including work by artists, generators, asset scripts and coding agents. Follow
the user's current instructions and approved design brief first. Historical
counts, prompts and exports in README.md describe earlier milestones; this
document governs new production and profile preparation. Do not change game
rules, hitboxes, tuning or character proportions to compensate for artwork.

## Produce masters before runtime assets

- Match the approved navy-outlined, flat cel-shaded cartoon direction and each
  fighter's established palette. Use the current approved references; a format
  optimisation does not authorise a redesign or a conversion to pixel art.
- Preserve the highest-quality original export and the editable/layered source
  when available. Use lossless RGBA PNG for raster exports with transparency.
  Never replace a design master with a lossy runtime WebP or resized derivative.
  Do not upscale a small source to claim higher master quality.
- Keep source masters, frame exports, registration information and provenance
  in the Punchies Drive archive outside the shipped package. Do not commit
  generated portraits, ZIPs or atlases. Existing tracked torso overrides remain
  authoritative exceptions; do not remove them during cleanup.
- Give each asset a stable runtime key and role: portrait, rig part, registered
  animation, arena layer, background, UI or effect. Record the original filename,
  dimensions, source SHA-256 and how it maps to that key. New approved art must
  be included in the updated lossless source archive used for regeneration.
- Portrait subjects stay on transparent canvases with consistent scale and
  safe margins for character select, reveal and victory crops. Do not bake
  interface text, buttons, badges or shadows into character art. Keep the
  approved logo separate; backgrounds must leave existing UI/control areas clear.

## Preserve registration and reusable content

- Legacy animated fighters face right on 256x256 transparent frames registered
  at (128,128). Keep each action's existing frame count and naming contract.
  Do not trim, recenter or realign source frames; only the packer trims.
  Feet/effects retain their matching frame canvas and registration.
- Rig parts are separate head, torso, left/right gloves and left/right boots.
  Keep established pivots, outlines and proportions. Existing preparation uses
  head height 120px, torso height 128px, glove height 96px and boot width 84px;
  preserve the aspect ratio and use the existing preparation script. These are
  runtime sizes, not limits on archived masters. Keep approved torso overrides.
- The five arena layers share the 1299x1211 source canvas and exact alignment:
  floor, rear, front, near and apron. Preserve the complete assembly, including
  ropes, corner pads and steps. Never crop or resize a layer independently.
- Palette skins reuse the base portrait/parts and runtime palette mapping.
  Do not ship an image or atlas copy for each colour variant. Unique artwork
  remains separate. Deduplicate mirrored parts only when their decoded pixels
  are exact mirrors; persist the alias and retain distinct authored lighting.
- Runtime keys, atlas frame geometry, animation data, palette masks and mirror
  aliases must remain identical between standard and compact profiles.

## Compression profiles

Derive lossy outputs from the lossless source masters once. Do not recompress a
previous lossy runtime image to prepare another profile. Already-prepared parts
and lossless standard atlases are valid inputs where specified below. Preserve
alpha and aspect ratio; never enlarge sources to reach a limit.

| Asset | Standard | Compact |
| --- | --- | --- |
| Portraits | Fit within 1280px; WebP Q90 | Fit within 768px; WebP Q78, alpha Q100 |
| Gym/select backgrounds | Current approved dimensions; WebP Q90 | Fit within 960px; WebP Q72 |
| Five registered arena layers | Lossless WebP at 1299x1211 | Resize all five together to 960x895; WebP Q72, alpha Q100 |
| Other loose art/UI/effects | Lossless WebP or copy the already-prepared approved file | Original dimensions; WebP Q72, alpha Q100 |
| Prepared fighter parts | Existing prepared pixels and overrides | Byte-identical to standard; no additional lossy encoding or resizing |
| Animation atlases | Lossless WebP; sheets at most 2048x2048 | Same dimensions/frame geometry; Q65 only if smaller, otherwise retain lossless standard sheet |
| Palette skins | Runtime recolouring | Same runtime recolouring |

The existing Tyke .86 and Longan .75 waist framing happens once when producing
each profile. Do not apply these crops to other portraits or repeat them on
already-framed art. Ordinary art changes do not change the current crop policy.
Use the scripts' current encoder settings: effort 4 for lossy WebP, effort 6
for standard lossless packing. Keep provenance and do not ship design masters.

Aim for portraits below 200 KB standard and 100 KB compact. These are production
targets, not existing CI limits: review a larger portrait and its largest actual
on-screen use before trading away readability. The hard automated portrait limit
is below 1,000,000 bytes in either profile. Prefer eliminating unreachable or
duplicate content and reducing decorative texture detail before altering faces,
silhouettes, registration or palette-mask pixels.

Music follows the same two-profile delivery policy: standard MP3 at 128 kbps;
compact AAC/M4A at 64 kbps; both retain full duration, stereo and 44.1 kHz. Do not
shorten tracks or alter scene mapping, loops or stingers for size savings. Keep
original audio and attribution in the archive.

## Prepare and publish both profiles together

1. Archive the new/updated approved masters and their SHA-256 inventory. For an
   R2 overwrite, verify the recoverable backup before replacing an existing
   object. Deleting archived masters is never a runtime optimisation.
2. Pack standard sources with `npm run pack:assets punchies`. Prepared standard
   art uses `scripts/clean-punchies-assets.mjs` where source cleanup is needed;
   run it against freshly packed original sources. Retain reachable fallbacks,
   aliases and provenance. Never mark an unprocessed source as prepared.
3. Prepare compact art from the updated lossless source ZIP and that standard
   runtime directory:

   ```sh
   node scripts/prepare-punchies-compact.mjs original-art.zip public/prototypes/punchies/assets output-directory
   ```

   Prepare music from the original audio ZIP if it changed:

   ```sh
   node scripts/optimize-punchies-audio.mjs original-audio.zip output-directory /path/to/ffmpeg --compact
   ```

4. Keep the standard and compact R2 objects separate. Upload
   `punchies_compact_assets.zip` and `punchies_compact_audio.zip` and archive their
   inventories. Verify the uploaded bytes against their SHA-256 hashes. Update
   `prototypes/punchies/asset-profiles.json` with those hashes and the current
   standard-art ETag and standard-music hash. An art change requires compact art
   regeneration; unchanged audio can retain its existing verified archive.
   Notify the owner of standard-object overwrites. Keep credentials out of Git.
5. Both profile commands and CI default to CrazyGames. Build both profiles with
   the same portal choice; pass `--portal web` for standalone web output. Use `--fresh` for compact
   release validation so uploaded objects are downloaded and verified again.
   Portal integration is independent of quality. Each output has root
   `index.html`; no opposite-profile assets or unrelated games belong in it.

   ```sh
   npm run build:punchies:standard -- --portal web
   npm run build:punchies:compact -- --portal web --fresh
   node scripts/test-punchies-profiles.mjs dist/punchies-standard-web standard
   node scripts/test-punchies-profiles.mjs dist/punchies-compact-web compact
   node scripts/test-punchies-profile-parity.mjs dist/punchies-standard-web dist/punchies-compact-web
   ```

Do not bypass the compact stale-source check. A standard art update is incomplete
for dual-profile release until its compact assets and recorded source identity
match. Normal WIP stays standard; compact exports target web portals as selected.

## Review and release evidence

- Run typecheck, the existing full build and both profile inventory/parity tests.
  Use the existing art, runtime palette and roster checks for changed content.
  Run the music behavior checks when audio or its loading changes.
- Inspect standard and compact in Brave, the user's authorised browser. Check
  portraits at their largest display size, dark/light alpha edges, the complete
  arena assembly, affected fighter poses, unique skins and palette variants.
  Check animation/rig registration and mirroring rather than only a still image.
  Keep screenshots and confirm no boot console errors. Other-browser or live
  portal support must not be claimed from Brave or mock checks alone.
- Listen to new compressed music alongside its source and check playback/loops.
  Decoder success alone is not a listening-quality verdict. Check bright edges,
  faces and text-like icon detail for ringing, blur and alpha halos.
- The package budgets are 20,000,000 bytes standard and 10,000,000 bytes compact,
  including every shipped art/audio/code/provenance file. These are project
  budgets, not promises of acceptance by every portal. Run the budget script on
  the complete package and report uncompressed bytes separately from ZIP bytes.
- Record before/after art, audio and complete-package sizes; resolutions, encoder
  settings, source/archive hashes, retained exceptions and what was actually
  tested. Report the remaining budget headroom; if new content exceeds
  a budget, resolve it before release rather than silently raising the limit.

The **Build Punchies asset profiles** workflow is the shared release gate for
profile inventory, music behavior, byte budgets and content parity. A new art
delivery is complete when both profiles pass and its visual evidence and source
lineage are available to the next producer.
