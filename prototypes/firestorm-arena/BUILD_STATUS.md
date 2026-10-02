## Current milestone

Milestone 3 done: the Phaser 3 client, playable end to end against the local
match server. Bots now also contest enemy and fogged nodes without a scout
report. Nothing is deployed.

## What was implemented

- Client (`prototypes/firestorm-arena/index.html`, `src/`): menu (name, create or
  join by 3 character code), lobby (roster, host Start with bot-fill toggle, 3 second
  countdown with Cancel), and the game scene. All UI is canvas; no React or DOM
  overlay (only the debug Tweakpane).
- World: isometric 75 x 51 grid with a volcanic floor, animated lava patches,
  occasional falling fireballs leaving fire patches, tinted safe zones, fog of war
  (soft elliptical holes around owned nodes), node cube stacks by tier with a
  kind icon, defender counts under nodes (exact for own, scouted for others),
  HQs with HP pips and flames when damaged, team-colour outline units (tank,
  helicopter, MLRS, scout plane), masked `?` enemy marches, animated dotted command
  lines (self green, allies muted, enemies red), combat sprays and explosions,
  burning defeated squads, teleport extract and landing effects, capture rings.
- HUD: scoreboard and clock, squad panel (troop bars, Defend toggle, Recall), HQ
  and teleport status, node and HQ inspector with Attack, Garrison, Send scout and
  Teleport actions, scout reports with live countdowns, combat logs, toasts,
  minimap with view window and click to jump, end of match overlay.
- Plumbing: intent layer (only place reading keys or pointer), device pixel ratio
  handled by buffer size times DPR with camera zoom, version stamp top left,
  `?debug=1` Tweakpane for `client.tune.json` with a copy-JSON button, reconnect
  with the same client id, server clock synced by ping.
- Ending a session: the host can end the room at any time (lobby, match, or the end screen), which closes every socket and frees the 3 character code for a fresh room. Others can just leave. The in-game button asks for confirmation. Stranger join after Start stays refused (decided).
- Bots: enemy-held or unseen enemy-side nodes are attacked blind with an odds
  estimate from squad power (max two blind attackers per node, striker waits 20s
  for a report). In bot-only matches that gives 35 to 61 node flips per match
  (was about 10), about a quarter of attacks won, scores within 2x.

## Key technical decisions

- Ground and fog are baked into Canvas2D textures (ground at 1x, fog at half
  resolution) instead of thousands of retained Graphics polygons.
- Immediate-mode canvas UI: every frame redraws from state, hit areas are recorded
  as drawn, topmost wins. No widget state to keep in sync.
- Client-only values are in `client.tune.json`, separate from `tune.json`, so a
  look and feel tweak does not trigger a Worker redeploy.
- Texture keys are unique per match start. Reusing and removing keys crashed the
  first frame (a Phaser frame left pointing at a destroyed source).
- Scene switches go through one guarded `go()`, since `update` keeps running
  until the switch completes.

## Open questions

- Server URL for a deployed build is unknown (the workers.dev name); the client
  needs `VITE_SERVER_URL` at build time, and the itch workflow does not set it.
- Decided with the user: power nodes at tiers 1 and 2 only, enemy lines red, no
  stranger join after Start. Placeholder tune numbers and the 3 minute march are
  kept as is until a playtest.
- CLAUDE.md and STACK.md still describe the React + Tailwind overlay and phone play.

## Known issues

- Verified with headless Chromium (software GL) only: no real GPU or high-DPI
  screen check beyond a 2x device scale screenshot. Frame rate is unmeasured.
- Orders show up after the next 1 second server pulse; there is no optimistic
  marker.
- Clicking a stack of HQs in a safe zone picks the nearest, which is fiddly;
  names show only when zoomed in.
- Effects are first versions; lava and eruptions are simple.
- Nothing is deployed. Merging this branch to main deploys the Worker (and the
  itch workflow once its prerequisites exist), so that needs a go-ahead.
- Bots rarely attack HQs and never move a garrisoned squad.

## Next proposed step

1. Decide the deploy: merge, Worker dispatch, and the server URL for the client.
2. A human playtest with a few real players for feel (march time, bot strength).
3. Polish pass: HQ selection in crowded safe zones, order feedback, effect tuning,
   audio if wanted.
