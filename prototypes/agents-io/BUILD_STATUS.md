## Current milestone

First illustrative prototype of agents.io ("tokenmaxxing"): build-then-run network puzzle with a token
wallet, three levels. Typecheck and build pass; played end to end with real mouse input in headless
Chromium. Not yet tried on a real phone.

## What was implemented

- Build-then-run loop (design option A) plus a minimal real-time token wallet (option C).
- Six network slots in three rows between INPUT and DELIVER. Tap an empty slot to pick an agent, tap
  words to give it work, drag from one node to another to wire them. Wires are typed (text, image).
- Five models (Nano, Scribe, Sage, Lens, Canvas) with price, speed, word capacity, error rate, per-word
  skill, prompt dilution, input types and output types. Sage can output text or image (player chooses).
- Words are reusable and cost tokens per task. A task is delivered when the final output has the
  required type and every required word landed somewhere on the way.
- Batch of 10 tasks per run, animated. Result panel: delivered %, cost per task, speed, per-word hit
  rate, 1 to 3 stars (delivered, then cost goal, then speed goal).
- Three levels: complaint email (text to text), receipt photo (image to text), launch poster (text to
  image). A level unlocks the next on a star.
- Wallet refills in real time, including while the tab is closed. Save key `agents-io:save:v1` holds
  layouts, best results, unlocked level and wallet (saved on every state change and on pagehide).
- Tweakpane panel on `?debug=1` exposes every number in `tune.json` (model stats, word costs, wallet,
  animation timing) with Copy JSON. Version stamp top-left. Canvas sharpness via dig-kit PIXEL_RATIO.
- Verification: `npm run typecheck` clean, `npm run build` succeeds, `scripts/screenshot-agents-io.mjs`
  plays level 1 with real mouse input (including an invalid wire and a drag-to-wire), checks the save
  across a reload and finds no console errors. Level 3 typed-wire refusal and the low-token block were
  checked in a one-off script, not committed.

## Key technical decisions

- Opts into `dig-kit` 0.1.0 (pinned) for IntentBus, tune panel, pixel ratio and Button. Those parts are
  generic; the package name is not. Worth extracting a neutral shared package later.
- Results use stratified dice: each decision gets a shuffled deck of evenly spaced values over the batch,
  so outcomes track the odds ("about 85%") instead of swinging on luck, and the same layout always gives
  the same result per level seed. Easy to swap for pure randomness if wanted.
- Game logic (`src/game`) knows nothing about input or Phaser. All input goes through intents; pointer
  and key bindings live in `src/input/intents.ts`.
- Numbers (model stats, word costs, wallet, timing) live in `tune.json`; names, types and level
  definitions live in `src/game/content.ts`. Level goals are content, not tuned feel values.
- Rules that make the puzzle: prompt dilution (extra words on one node weaken all of them), words
  carried through a node can be dropped (node error rate), only nodes on an INPUT to DELIVER path run
  and cost tokens.
- Wires only go to a lower row, which rules out cycles without a graph check.

## Open questions

- Platform: the user overrode the mobile-required rule for this prototype; desktop is fine (recorded in
  BRIEF.md). The layout is still a portrait 390x844 canvas, so on a desktop browser it shows as a narrow
  centred strip. Should it get a wide desktop layout?
- BRIEF.md may need updating: it assumes words are reusable (not consumed) and quality is matching, not
  fuzzy axis scoring. Both were defaults chosen to get a prototype out, not confirmed by the user.
- Is a bigger progression layer (unlocking models and words over time) wanted, or is the wallet enough?
- Level goals and model numbers are first guesses, balanced only by simulation, not by play.

## Known issues

- Long wires cross empty slots (drawn over them); fine for a prototype, not pretty.
- Only three rows by two columns, so chains are at most three agents deep.
- Not tested on a physical phone; tap targets are 30 to 44 logical pixels and text is 9 to 12 px.
- No sound, no real art (placeholder shapes only), no tutorial beyond one-line hints.
- Not added to the hub page or to any deploy workflow.

## Next proposed step

Play it on a phone, then decide the open questions above (reusable vs consumed words, matching vs fuzzy
quality, how much progression). After that, rebalance levels by feel and tune the model roster.
