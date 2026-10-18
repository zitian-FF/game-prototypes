## Current milestone

Fifth iteration of the agents.io prototype: the flow now runs left to right (inputs on a node's left edge,
outputs on its right edge) and INPUT and DELIVER are goal-looking endpoint cards. Before that: multimodal
agents have separate typed ports. The
blueprint is a zoomable, pan-able, snap-to-grid board with node connectors (ports) and orthogonal wires,
replacing the fixed 3x3 slots. Landscape desktop
layout, premium black UI and colour-coded models from the previous iteration are kept. Typecheck and
build pass; played end to end with real mouse input in headless Chromium. Not tried on a phone (not a
goal) or on a real GPU.

## What was implemented

- Blueprint: a 40x40 grid board (24 px cells) seen through a square viewport. Wheel zooms around the
  pointer (35% to 220%), dragging empty space (or middle or right button) pans, a toolbar has -, +, a
  zoom readout and Fit, and F or the Fit button frames INPUT, DELIVER and every agent.
- Placing: click an empty spot, a dashed ghost shows the snapped footprint (8x4 cells), then pick a
  model in the inspector. A faint footprint follows the pointer while hovering. Agents keep one empty
  cell clear of each other and of INPUT and DELIVER; crowded clicks are refused with a toast.
- Moving: drag an agent; a ghost shows the snapped destination (red if blocked) and it commits on release.
- Left to right: INPUT sits at the left of the board and DELIVER at the right (board is now 44x30 cells).
  Wires leave an output port on the right edge and enter an input port on the left edge, routed in right
  angles; a target behind its source loops round below (or above).
- Endpoints: INPUT is drawn as a stack of incoming task cards ("SOURCE", type badge, "tasks arrive as
  ..."). DELIVER is drawn as the goal: a gold-bordered card with a glow, a target with a flag, the type
  badge and the required words.
- Typed ports: every agent has one input port (hollow, left edge) and one output port (filled, right
  edge) per type its model handles. Most models have one of each; multimodal Sage has a text and an
  image port on both sides. Circles are text, diamonds are image. A wire carries the type of the port it
  leaves from and only lands on an input port of the same type (INPUT has an output port of the level's
  input type, DELIVER an input port of its output type). All output ports of an agent carry the same
  words. The old "choose output type" switch is gone (the inspector now lists Reads and Writes).
- Wiring: drag from an output port onto any node; valid input ports of that type light up green while
  dragging. Dragging the same pair and type again removes the wire.
- Wires: routed in right angles along the grid with rounded corners, coloured by the source model,
  dashed for image. A wire that would close a loop is refused; side-by-side wires are now allowed.
  Click a wire to select it (inspector shows it, Delete or the button removes it).
- Delete removes the selected agent or wire, Escape deselects, Space runs.
- Run animation follows the routed wires. Run order now comes from a topological sort of the wiring.
- Save key is `agents-io:save:v5` (agent positions, words, wires with their type, best results, unlocked
  level); earlier saves are ignored (positions changed meaning when the flow turned sideways). View
  zoom and pan are not saved; the board frames the network on load and on level change.
- Verification this session: `npm run typecheck` clean, `npm run build` succeeds, and
  `scripts/screenshot-agents-io.mjs` passes at 1280x720: click-to-place two agents, words, four wires,
  a refused wire into INPUT, a refused loop, a side-by-side wire and its removal, wire selection, moving
  an agent, wheel zoom, drag pan, Fit, run, an immediate second run, next level, a multimodal section on
  level 2 (an image wire onto Sage's image port, a text wire to DELIVER, refused: image into a text-only
  Scribe and Sage's image output into a text DELIVER, plus Sage's text output into Scribe), and reload with
  the layout kept; no console errors. A device-pixel-ratio 2 check (real clicks, crisp text) and the
  standalone bundle used for the hosted playable build were checked in one-off scripts that are not
  committed. Headless software WebGL runs only about 7 fps at 1x here, so the script is slow; a real
  GPU is not expected to be.

## Key technical decisions

- Three cameras: main (panels), a board camera whose viewport is the blueprint rectangle (zoom and
  centre set from the view state, so panning and zooming never rebuild anything), and a top camera for
  controls and the result panel drawn over the board. Phaser's `camera.ignore(container)` only flags the
  children present at that moment, so each layer is built first and ignored afterwards.
- Ports are placed on grid lines (agents are 8x4 cells, endpoints 6x6), so wire corners and ports always
  line up. Routing: right out of the source, a vertical run snapped to the grid, right into the target;
  targets behind the source loop round below.
- All pointer input goes through intents. `bindBlueprintPointer` turns press, drag, wheel into `select`,
  `cell`, `move`, `wire`, `pan`, `zoom` intents; zoom and pan intents are handled by the scene, the rest
  by the game rules, which know nothing about Phaser or the pointer.
- Board texts are rendered at 2x the pixel ratio so they stay sharp when zoomed in.
- Stratified dice in the sim are keyed by node id, so a layout's results depend on its ids; the three
  levels were rechecked after the move from slots to ids.
- Opts into `dig-kit` 0.1.0 (pinned) for IntentBus, tune panel, pixel ratio and colour mix.
- Numbers live in `tune.json`; board geometry (cell size, board size, node sizes) lives in
  `src/game/board.ts`.

## Open questions

- BRIEF.md may need updating once decided: words reusable versus consumed, matching versus fuzzy
  quality scoring, and the long-run progression layer. These were defaults, not confirmed.
- Multimodal agents can now use several output ports at once for no extra cost. Should that cost extra?
- Level goals and model numbers are still first guesses balanced only by simulation, not by play.
- Interpretation to confirm: the top bar holds live resource gauges against the goals, the left column
  the task brief and goal detail.

## Known issues

- Wires can pass through agents that sit in their path (no obstacle-aware routing).
- No minimap; a big board needs Fit or panning.
- The view (zoom and pan) is not saved.
- Fixed 16:9 canvas; other window shapes letterbox.
- No sound, no real art, no tutorial beyond one-line tips.
- Not added to the hub page or to any deploy workflow.

## Next proposed step

Play it and decide the open questions above. After that, the subscription-model unlock (a refreshing token
allowance with per-window rate limits and queues inside the sim, so bottlenecks matter), which needs the
larger boards this iteration makes possible.
