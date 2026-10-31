## Current milestone

First playable core-loop sandbox is live: local human versus bot, two HQs. Owner authorized implementation and prototypes-page shortcut on 2026-10-31. Full six-player Eurasia game remains a later milestone.

Play: https://zitian-ff.github.io/game-prototypes/prototypes/operation-c/
Hub: https://zitian-ff.github.io/game-prototypes/
Game PR #406 merged as 2420b0c; successful Pages run 41189123411 published build 311026r0001 and persisted counter 1 in ac4a578. Operation C validation run 41188958621 passed. Current WIP deployment was correctly skipped by the scope guard.

## What was implemented

Deterministic 271-hex sandbox, exclusive occupancy and movement reservations, queues/six-position surrounding, range-based combat, building-priority attack orders, independent capture, connected resource reservations, global commitment debt, production cooldowns/replacements, surviving orphan units, burnt ground, HQ elimination and restart. Responsive touch/mouse canvas controls, placement confirmation/footprint preview, scripted vector art, cached terrain, capture/cooldown/health feedback, debug tuning and an Operation C shortcut on the hub.

Added game-path-filtered validation CI with rule tests, focused typecheck/build and actual-build browser checks. The existing hub Pages workflow discovers the game entry; its Operation C-only counter steps stamp builds and persist the counter after successful deployment. A scope guard prevents Operation C-only changes from publishing the unrelated Current WIP game. Dedicated Firestorm itch/Worker targets and other games' source remain untouched.

## Key technical decisions

Phaser 3 + TypeScript follows the lightweight-browser recommendation and the authorized first-slice scope. Rules are pure TypeScript, input is an intent adapter, procedural art is separate from presentation, terrain redraws on state change, text objects are reused, and Tweakpane loads only with ?debug=1. Normal play needs no backend or runtime asset fetch. Future netcode is not represented as implemented.

## Open questions

BRIEF.md must be updated as final decisions arrive: exact 200-cap meaning, HQ centre capacity and automatic recapture exceptions, full race/tier/loadout model, swarm members and reinforcement targeting, six-player match duration/topology, elimination treatment for remaining buildings, and final balance. Current tune values are provisional.

## Known issues

No multiplayer, final Eurasia map, full races/tiers or swarm reinforcements yet. Test map is a plain hexagon. All three example ground units capture; no ranged line-of-sight blocking. HQ pressure retakes unoccupied enemy land. Elimination removes remaining structures without burning them. These are explicit first-slice assumptions. Own-HQ defense expands and attacks within range, without a broader threat-response planner.

Browser checks use actual Brave with touch emulation; physical phones, iOS fullscreen/orientation, long-session balance and large armies are not verified. Three limited ten-minute virtual-budget probes ended in bot victory after 73.6–107.3s with peaks of 10–13 units; these establish progression, not balanced matches. The legacy hub publishing workflow still builds its existing multi-game output; the new Operation C validation workflow is game-scoped.

## Next proposed step

Owner playtest the first building/expansion/attack loop from the hub shortcut before choosing the next system milestone.

Verification: 15 behavior tests pass, scoped and full repository typecheck pass, root hub build and standalone build pass. Brave desktop 1440×900, touch portrait 390×844 and landscape 844×390/667×375 flows pass placement, production, orders, 45 seconds simulated play, exclusive occupancy and reset with no game-page console errors, including minified production and actual live Pages output. Screenshots inspected. Hub shortcut opens the correct live game. Existing hub /favicon.ico responds 404; Operation C supplies its own inline favicon and has no such error. Final deployment evidence is recorded on the task branch after the game PR merge.
