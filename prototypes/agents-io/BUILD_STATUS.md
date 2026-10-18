## Current milestone

Second iteration of the agents.io prototype: landscape desktop layout with a premium black UI,
colour-coded models, and the real-time token wallet removed. Typecheck and build pass; played end to
end with real mouse input in headless Chromium at 1280x720. Not tried on a phone (not a goal now).

## What was implemented

- Build-then-run loop. Runs are free and instant; retrying is immediate.
- Landscape 1280x720 layout. Top bar with level switcher, live gauges for tokens per task and time per
  task against the level goals, and best result. Left column: task, star goals with live status, last
  run. Centre: square blueprint with INPUT, nine agent slots (3 rows by 3) and DELIVER. Right column:
  inspector (agent picker, or selected agent stats and output switch), word basket with per-word skill
  for the selected agent, Run button.
- Colour-coded models: Nano mint, Scribe blue, Sage violet, Lens amber, Canvas pink. The colour drives
  the picker cards, node borders and word pills, the inspector, the legend and the wires (a wire takes
  its source model's colour). Types are shown without colour: text wires solid, image wires dashed,
  outlined TEXT or IMAGE badges.
- Five models with price, latency, word capacity, error rate, per-word skill, prompt dilution, input
  and output types. Sage can output text or image (player chooses).
- Words are reusable and cost tokens per task. Delivered means the right output type with every
  required word landed. Batch of 10 tasks, animated along curved wires. Result panel with delivered %,
  tokens per task, time per task, per-word hit rates and 1 to 3 stars.
- Three levels (complaint email, receipt photo, launch poster); a star unlocks the next.
- Save key is now `agents-io:save:v2` (layouts, best results, unlocked level). The v1 save, which held
  a wallet and a six-slot layout, is ignored.
- Tweakpane on `?debug=1` for every number in `tune.json`. Version stamp top-left. Canvas sharpness via
  dig-kit PIXEL_RATIO.
- Verification this session: `npm run typecheck` clean, `npm run build` succeeds,
  `scripts/screenshot-agents-io.mjs` plays level 1 with real mouse input (invalid wire, drag to wire,
  run, immediate second run, next level, reload and save check) with no console errors. Level 3 was
  checked in a one-off script (five models, typed-wire refusal, dashed image wire, idle node); that
  script is not committed.

## Key technical decisions

- Real-time wallet removed: a refill timer fights a build, run, tweak loop. Token refresh is deferred
  to a later "subscription models" unlock where it lives inside the simulation as rate limits per time
  window (see BRIEF.md), versus the current per-call "API" billing.
- Nine slots instead of six to fill the square blueprint. Wires still only go to a lower row, so there
  are no loops and no graph check.
- Stratified dice in the sim (each decision gets a shuffled deck of evenly spaced values across the
  batch) so results track the odds and the same layout always gives the same result.
- Opts into `dig-kit` 0.1.0 (pinned) for IntentBus, tune panel, pixel ratio and colour mix. The package
  name is dig-specific but these parts are generic; worth extracting a neutral shared package.
- Game logic (`src/game`) knows nothing about input or Phaser; all input goes through intents.
  Pointer and key bindings are in `src/input/intents.ts` (a drag between nodes emits a wire intent).
- Numbers live in `tune.json`; names, types and level definitions live in `src/game/content.ts`.

## Open questions

- BRIEF.md may need updating once decided: words reusable versus consumed, matching versus fuzzy
  quality scoring, and the long-run progression layer. These were defaults, not confirmed.
- Should wires be allowed between slots in the same row? Currently refused, which limits layouts.
- Interpretation to confirm: the top bar holds the live resource gauges against the goals, and the left
  column holds the task brief and goal detail. Shout if "resources menus" meant something else (for
  example the word basket on top).
- Level goals and model numbers are still first guesses balanced only by simulation, not by play.

## Known issues

- Wires cross empty slots (drawn over them).
- Fixed 16:9 canvas; on other window shapes it letterboxes.
- No sound, no real art (placeholder shapes only), no tutorial beyond one-line tips.
- Not added to the hub page or to any deploy workflow.

## Next proposed step

Play it on desktop, then decide the open questions. After that, the subscription-model unlock: a
refreshing token allowance with per-window rate limits and queues inside the sim, so bottlenecks matter.
