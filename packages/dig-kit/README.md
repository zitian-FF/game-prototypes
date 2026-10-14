# dig-kit

Shared building blocks for the dig prototypes (dice-dig, dig-match): the pastel
pillow-block art, tapered cracks, synthesised sounds, a button, an intent bus,
the `?debug=1` tune panel and a seeded RNG. Phaser 3 is a peer dependency.

Version 0.1.0. Pin an exact version in your prototype's `package.json`
(`"dig-kit": "0.1.0"`) and move to a newer one only on purpose. Ship changes
additively (new exports, optional fields) and bump every consumer's pin together
(see STACK.md, "Known limitations" under mp-core, for why).

- `rng`: `mulberry32`, `randInt`, `pickWeighted`.
- `color`: `shade`, `mix`.
- `pixelRatio`: `PIXEL_RATIO` (capped device pixel ratio for sharp canvases).
- `intents`: `IntentBus<I>`, `bindKeys`.
- `sfx`: `Sfx`, placeholder WebAudio sounds with live volume and pitch options.
- `button`: `Button`, a rounded canvas button.
- `tunePanel`: `mountTunePanelIfRequested`.
- `cracks`: `crackPaths`, `drawCrack`.
- `pillow`: `pillow`, `bakeTexture`, `bakePillow`, `BAKE_RES`.
- `palette`: `LAYER_COLORS`, `layerColor`.
