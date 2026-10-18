# agents.io (working title: "tokenmaxxing")

Status: illustrative prototype. Written from the design discussion, not a final spec.

## Platform

Desktop, landscape (1280x720 logical canvas, scaled to fit). Phone play is not required for this
prototype (explicit user override of the repo-wide mobile rule in CLAUDE.md, which otherwise names
only Firestorm Arena as exempt). Mouse is the primary device.

## Premise

A single-player factory-sim puzzle. Work orders arrive; the player builds a small network of AI
agents (model nodes), gives them prompt words, wires them together and presses Run. The network is
scored on how many tasks it delivers, what it cost in tokens, and how long it took.

## Core loop (build, then run)

1. Read the task: input type, required output type, required qualities (prompt words), goals.
2. Place model nodes on the blueprint by clicking an empty spot on the snap grid. Each model has a price, speed, word capacity, error rate,
   per-word skill and the input and output types it can handle. Each model has its own colour,
   used everywhere it appears (picker, node, wires, legend).
3. Give nodes words from the level's word basket. Words are reusable; each placement costs tokens
   on every task the node handles.
4. Wire INPUT to nodes to DELIVER by dragging from an output port (bottom of a node) onto the next
   node. Wires are typed: a node can only feed another node whose model accepts the type it
   outputs. Models with several output types let the player choose. Wires take the colour of their
   source model; image wires are dashed and come from diamond ports, text wires are solid and come
   from round ports. Wires are routed in right angles along the grid.
5. Press Run. A fixed batch of tasks flows through the network. Score: delivered %, tokens per
   task, seconds per task. Stars: 1 delivered goal, 2 plus cost goal, 3 plus time goal.
   Runs are free and instant, so the player can iterate quickly.

## Rules that make the puzzle

- A task is delivered only if the final output has the required type and every required word
  was applied successfully somewhere on the way.
- A node applying a word succeeds with the model's skill for that word, reduced for every
  extra word on the same node (prompt dilution). Splitting words across sub-agents beats
  overloading one node, but costs more tokens.
- Words applied upstream can be lost when passed through a node (the node's error rate).
- Only nodes that connect INPUT to DELIVER run and cost tokens.
- A wire that would close a loop is refused. Wires can go in any direction otherwise, including
  between agents side by side.
- Every model is billed per call (the "API" model): cost is tokens per task.

## Layout (landscape)

- Top bar: wordmark, level switcher, live resource gauges against the goals (tokens per task,
  time per task), best result.
- Left column: the task (types, required words, tip), the three star goals with live status,
  last run summary.
- Centre: a square blueprint viewport onto a 40x40 snap-to-grid board holding INPUT, DELIVER and
  any number of agents. Mouse wheel zooms around the pointer (35% to 220%), dragging empty space
  (or the middle or right button) pans, the Fit button or F frames the whole network. Click an
  empty spot to place an agent, drag an agent to move it (it snaps to the grid and keeps clear of
  other nodes), click a wire to select it, Delete removes the selected agent or wire.
- Right column: inspector (agent picker or selected agent stats), word basket, Run button.
- Premium black UI: near-black panels, hairline borders, one restrained gold accent, colour-coded
  models.

## Persistence

Layouts (agent positions, words and wires), best result per level and the unlocked level are saved
(`agents-io:save:v3`). Levels unlock in order, one star unlocks the next. The view (zoom and pan)
is not saved; it frames the network again on load.

## Later unlock (not built): subscription models

Late game, the player chooses how to optimise: API models (pay per call, as now) versus
subscription models (a refreshing token allowance with rate limits per time window, so tasks
queue and the bottleneck moves). Rate limits belong inside the run simulation, not on a
real-time wallet. Deferred until the base loop is confirmed fun.

## Levels (3)

1. Complaint email: text in, text out, needs formal and apologize.
2. Receipt photo: image in, text out, needs extract and summarize.
3. Launch poster: text in, image out, needs short, cheerful and visual.

## Out of scope

Real LLM calls, multiplayer, accounts, off-grid placement, a minimap, video or audio types, more than three
levels, sound, art assets (placeholder shapes only), tutorials beyond one-line tips, shops or
upgrades, a real-time token wallet, subscription models and rate limits (later unlock, above),
phone layout.

## Open questions (resolve with the user)

- Are words consumed when used, or reusable? (Prototype assumes reusable.)
- Matching (current) or fuzzy axis scoring for quality?
- What does the long-run progression layer look like beyond unlocking levels?
- Ports are one input (top) and one output (bottom) per agent; the chosen output type sets the wire
  type. Do multi-port agents (separate text and image ports) belong in a later level?
