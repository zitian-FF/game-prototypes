# agents.io (working title: "tokenmaxxing")

Status: illustrative first prototype. Written from the design discussion, not a final spec.

## Premise

A single-player factory-sim puzzle. Work orders arrive; the player builds a small network of
AI agents (model nodes), gives them prompt words, wires them together and presses Run. The
network is scored on how many tasks it delivers, what it cost in tokens, and how long it took.

## Core loop (build, then run)

1. Read the task: input type, required output type, required qualities (prompt words), goals.
2. Place model nodes in the network slots. Each model has a price, speed, word capacity,
   error rate, per-word skill and the input and output types it can handle.
3. Give nodes words from the level's word basket. Words are reusable; each placement costs
   tokens on every task the node handles.
4. Wire INPUT to nodes to DELIVER. Wires are typed: a node can only feed another node whose
   model accepts the type it outputs. Models with several output types let the player choose.
5. Press Run. A fixed batch of tasks flows through the network. Score: delivered %, tokens per
   task, seconds per task. Stars: 1 delivered goal, 2 plus cost goal, 3 plus time goal.

## Rules that make the puzzle

- A task is delivered only if the final output has the required type and every required word
  was applied successfully somewhere on the way.
- A node applying a word succeeds with the model's skill for that word, reduced for every
  extra word on the same node (prompt dilution). Splitting words across sub-agents beats
  overloading one node, but costs more tokens.
- Words applied upstream can be lost when passed through a node (the node's error rate).
- Only nodes that connect INPUT to DELIVER run and cost tokens.

## Layer C (kept minimal)

- Token wallet: a run spends tokens; the wallet refills in real time, including while the
  tab is closed (timestamp and elapsed time on load).
- Levels unlock in order. Best result per level and each level's layout are saved.

## Levels (3)

1. Complaint email: text in, text out, needs formal and apologize.
2. Receipt photo: image in, text out, needs extract and summarize.
3. Launch poster: text in, image out, needs short, cheerful and visual.

## Out of scope

Real LLM calls, multiplayer, accounts, belts or free-form placement, video or audio types,
more than three levels, sound, art assets (placeholder shapes only), tutorials beyond a
one-line hint, shops or upgrades.

## Open questions (resolve with the user)

- Are words consumed when used, or reusable? (Prototype assumes reusable.)
- Matching (current) or fuzzy axis scoring for quality?
- Does a long-run progression layer (unlocking models and words) belong in the first real version?
