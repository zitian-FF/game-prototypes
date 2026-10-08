## Current milestone
First playable loop: 30 second portrait run with JAB and CROSS, sprite art, end screen with placeholder CTA, debug panel, build-only CI. Not deployed.

## What was implemented
- Pure 60 Hz rule sim (`src/sim.ts`): jab and cross timing and bands copied into `tune.json`, head 2 / body 1 sweet hits knock the enemy off, sour or missed or ignored makes the enemy punch for 1 damage then leave sideways, overlapping enemies on a 1.5 to 2.0 s timer with the front one as target, 3 HP, 30 s timer.
- Phaser canvas scene (`src/scenes/PlayScene.ts`): Marco at the bottom facing up, Bruno walking down facing down, JAB and CROSS buttons, score at the top, HP pips, time bar, score popups, hit flashes, end screen with score and a single placeholder CTA (`src/cta.ts`, `onCtaPressed`, does nothing).
- Intent layer (`src/intents.ts`): jab and cross, touch buttons plus J and K keys.
- Art: `scripts/prepare-art.mjs` composites the layered Punchies frames (feet, torso, head, gloves, effects; `ko` is flat) for marco and bruno, only idle, walk, jab, cross, guard, hit_light, ko, into one WebP sheet each. Fetched from the existing `punchies_assets.zip` with `scripts/fetch-assets.js punchies-playable punchies_assets.zip` (ETag cached). Without art the game runs as coloured rectangles.
- Debug: Tweakpane panel from `tune.meta.json`, only with `?debug=1` (remembered, `?debug=0` clears), Restart and Copy JSON buttons. Tweakpane loads as a separate chunk only when unlocked.
- `devicePixelRatio` sharpness: buffer sized logical x ratio (capped), camera zoom, Text `resolution`.
- Build: own `vite.config.ts`, `npm run build:punchies-playable` (output `prototypes/punchies-playable/dist`). Root `npm run build` and the hub are unchanged and do not include it. CI `.github/workflows/build-punchies-playable.yml` only builds (typecheck, rule tests, art, build, size report). No deploy workflow, existing workflows untouched.
- Built size: 1.90 MB total uncompressed (JS 1.50 MB of which Phaser is almost all, 0.35 MB gzipped; Tweakpane chunk 0.15 MB, only loaded with ?debug=1; art 0.25 MB).

## Key technical decisions
- Rules are a separate small sim, not the main game's; numbers copied into this prototype's `tune.json`.
- Zip has layered parts, not flat per-action frames, so frames are composited at prep time. Every frame uses one fixed crop window around registration (128,128), nothing trimmed per frame.
- Sprites are shown at about 1 logical px per source px (source art was authored for half that), so on 2x screens the art is upscaled about 2x and slightly soft. This is a limit of the source resolution.
- Units: lane distances are the main game's band units; `view.unitPx` 1.2 maps them to screen px.
- Test and debug hook `window.__playable` exists only with `?test=1` or the debug unlock.

## Open questions
- Jab sour distance is 44 (the approved brief table). The main game's own sim would make a jab sour below about 77.5 (the core is touched early). With 44 a jab never goes sour at the default enemy stop distance of 80, so sour comes mostly from the cross. Say if you want the jab closer to the main game.
- Enemy punch has no player-side defence or telegraph beyond the guard pose; tune windup (`enemy.windupFrames`) after a real playtest.
- Single-file inlining later: the debug chunk is a dynamic import and art loads over HTTP, both need handling then. Ad network size and format limits still to check.
- BRIEF.md decisions are recorded in its Decisions section; nothing was ambiguous enough to need a brief change beyond those.

## Known issues
- Not tested on a real phone. Headless software rendering runs the loop slowly, so the browser check waits on sim frames, not wall time.
- The 30 s end is verified by fast-forwarding the sim (`advance(1800)`), not by waiting 30 real seconds.
- Fonts fall back to Arial (no Arial Black on some systems).
- The mp-console itch.io deploy replacement and the hub link change are NOT done yet (see next step).

## Next proposed step
1. User playtests and tunes via ?debug=1.
2. Deployment: new workflow for the mp-console itch.io project following `deploy-wip-itch.yml`, retire `deploy-mp-console-itch.yml`, update the hub link. Needs the user's go-ahead and the itch project's existing butler secret and channel.
3. Open the PR when the user asks.
