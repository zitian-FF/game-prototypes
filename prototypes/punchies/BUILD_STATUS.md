## Current milestone

Punchies cartoon artwork and asset integration verified locally. R2 upload
is pending an existing upload configuration; the public object returns 404.

## What was implemented

- Original fighter/dummy art: 105 animation folders, 672 fixed-canvas frames,
  all main/alternate colors. Three character portraits.
- Generated gym menu illustration; original stage, canvas floor, ropes and
  tinted corner posts; matching HUD, touch controls, menu, character-select,
  lobby, tutorial and result chrome.
- Optional asset loader, folder-derived configs, cross-sheet frame lookup
  and procedural fallback for missing art.
- R2 fetch/pack in WIP deployment, ETag cache and content-hash manifest.
- Existing Windows packer invocation/frame-path and version-generator CLI
  issues fixed for local verification.

## Key technical decisions

- Fixed 256x256 sources, centered (128,128), facing right; only packer trims.
- Attack progression follows simulation phases; existing KO motion/timing.
  No changes to tune.json or src/sim. Character scales remain 1 / 0.88 / 1.12.
- Separate alt-color/dummy prefixes; frame configs derived from packed folders.
- Builds embed the generated index. Art-free builds make no asset requests.
  Restart Vite after repacking; rebuild after an R2 overwrite.
- Vector artwork sources/exporter are reproducible; imagegen made the menu.
  No raster/ZIP/atlas artifacts are committed.

## Open questions

- Owner must provide the tool/location of existing R2 upload configuration,
  without secret values. No upload credentials exist in this chat environment.
- Live itch WIP playtest link requested but not yet supplied.

## Known issues

- Art is not yet in R2; fresh CI builds display procedural fallback.
- Lobby presentation uses mocked TURN/relay sockets. Real two-phone online
  play, hardware controllers and real-phone art/feel review remain unverified.
- Existing Phaser bundle-size warning; build succeeds.

## Next proposed step

Upload the delivered punchies_assets.zip using the existing R2 configuration,
notify the owner, rebuild the WIP slot and playtest the live mobile build.
