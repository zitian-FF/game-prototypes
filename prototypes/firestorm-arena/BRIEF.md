# firestorm-arena

A 20 vs 20 desktop-browser arena mode. Each player commands a few
squads, marches them between capturable nodes under fog of war, and the
team holding the most captured points when 30 minutes run out wins.
Combat is a simplified auto-resolved rock-paper-scissors between squads.
Game feel and UI references are Last War: Survival (squad marches,
node selection, HQ refill), but only the parts listed here are in scope.

All visuals start as coloured rectangles and text (placeholder-first).

## Platform and stack

- Target: desktop browser, mouse driven. Phone play is explicitly **not**
  required for this prototype (the user has waived the repo-wide rule in
  CLAUDE.md for this brief; CLAUDE.md is known to be out of date on
  this point).
- Client: Phaser 3 + TypeScript (strict) + Vite. UI chrome (HUD, squad
  list, command panel, lobby, logs) is a React + Tailwind DOM overlay
  per CLAUDE.md "UI implementation split". The map, nodes, marching
  squads and fog are rendered in Phaser.
- Server: Cloudflare Worker + one SQLite-backed Durable Object per match,
  WebSockets, Workers Free plan only. Authoritative for all game state.
  Event-driven (alarms for arrivals, captures, cooldowns, turret pulses),
  no fixed tick. Setup and deploy are handled separately by Codex, see
  "Infrastructure ownership".
- Shared sim: a pure TypeScript package (no Phaser, no DOM, no
  Cloudflare APIs) containing all game rules. Runs inside the Durable
  Object, in Node for headless bot tests, and in the client for deriving
  march positions from march records. New shared package under
  `packages/` (name proposed: `arena-sim`), versioned, opt-in, per
  CLAUDE.md Purpose.
- Networking does **not** use Trystero or mp-core. Reusable ideas carried
  over from mp-net: stable per-browser client ID, 5-character room code
  alphabet (no 0/O/1/I/L), identity-matched reconnect.
- Debug: Tweakpane via `?debug=1` with a copy-values-as-JSON button, all
  tunables in `tune.json`.
- Hosting: client static build via itch.io Butler (slot decided by Codex).
- Also applies per CLAUDE.md: intent layer for input (no direct key or
  pointer reads in game logic), version stamp `DDMMYYrXXXX` top-left,
  `devicePixelRatio` canvas sharpness, per-prototype `BUILD_STATUS.md`.

## Players, teams and squads

- 40 players: two teams of 20. Team assignment is balanced automatically.
- Every player has an HQ (base) and 1 to 3 squads.
- **Squad type:** one of three, assigned at random: Missile Vehicle,
  Aircraft, Tank.
- **Counter triangle (Last War):** Aircraft beats Tank, Tank beats
  Missile Vehicle, Missile Vehicle beats Aircraft.
- **Power ranking and value:** each squad is dealt a power rank from 1st
  (strongest) to 20th, mapped to a power band within 50m to 80m. The
  squad's power is a random value within its rank's band. Duplicate
  ranks across players are allowed.
- **Squad count per player:**
  - Squad 1: every player, rank drawn from 1st to 20th.
  - Squad 2: about 80% of players, rank drawn from 10th to 20th.
  - Squad 3: a small percentage of players, rank drawn from 15th to 20th.
- **Troops:** each squad has `maxTroops` of about 3000 with some
  per-squad variance, and a current `troops` count that starts full.
- **Reserve pool:** each player has a finite pool of about 40,000 to
  50,000 troops (rolled per player). It is the only source of
  replenishment. Troops lost in battle are gone.
- **Replenishment:** a squad that is at its player's HQ is refilled to
  `maxTroops` from that player's pool. If the pool is short, the refill
  is partial. Squads do not heal anywhere else.
- Squads and pools are rolled fresh each match. Nothing persists between
  matches.

## Map, nodes and ownership

- A map of many capturable nodes, each with a fixed coordinate.
- Ownership is per team. Every node starts neutral unless the brief
  entry in Open questions says otherwise.
- **Node types and effects:**
  - Ally attack boost (% bonus to the owning team's squad power).
  - Ally defense boost (% reduction in damage taken by the owning team).
  - Ally speed boost (% faster march speed).
  - Teleport cooldown reduction for the owning team.
  - Large vision node (large vision radius).
  - Medium point node and large point node (different point rates).
  - Turret node (see Turrets).
- Node effects apply to the whole owning team while the node is held, and
  stop when it is lost. Stacking rules are tunable (see Open questions).
- Nodes generate **points** for the owning team at a per-node rate while
  held. Points accrue on the server.
- Squads can garrison a node. The garrison (the defender stack) is
  whatever squads are stationed there.

## Commands

All actions are coordinates, timers and unit references:

- **March:** select a squad, select a target node, issue the march. The
  squad leaves its current position and travels to the node. Travel time
  is `distance / speed` (speed modified by node bonuses).
- **Cancel:** a marching squad can be issued a cancel. It turns around and
  returns to its HQ.
- **Base teleport:** a player's HQ can teleport to a node their team
  currently controls. Cooldown is 2 minutes, reduced by owned
  teleport-cooldown nodes. Teleport is only allowed to controlled
  nodes.
- Squads marching in the field cannot fight. All combat resolves at nodes.

## Combat (auto-resolved at a node)

When an attacking squad arrives at a node held by the enemy:

1. The attacker fights the node's defender stack one squad at a time, in
   stack order, for up to **10 defender squads** per attack.
2. Each fight is auto-resolved in rounds until one squad reaches 0
   troops. Both sides take damage each round. The attacker keeps its
   remaining troops between fights.
3. If the attacker clears the whole defender stack, it **takes control of
   the node immediately** and garrisons it.
4. If the attacker is destroyed, it is gone. If it clears 10 defenders and
   defenders remain, it **returns to its HQ** with whatever troops it has.
5. An attacker arriving at a node with no defenders captures it immediately.

### Combat formula

```
strength_X      = power_X * counterMult_X * varianceFactor_X
counterMult_X   = 1.2 if X's type counters the opponent's type, else 1.0
varianceFactor  = 1 + uniform(-variance, +variance), rolled once per side per fight

each round (simultaneous):
  damage_by_X   = roundDamageFraction * maxTroops_ref
                  * (strength_X / powerRef)^powerExponent
                  * (troops_X / maxTroops_X)
  troops_Y     -= damage_by_X   (for the opponent Y)

loop until troops_A <= 0 or troops_B <= 0
```

Defaults (all in `tune.json`, none hardcoded):

| Key | Default | Meaning |
|---|---|---|
| `combat.powerExponent` | 6 | Steepness of power advantage |
| `combat.counterMultiplier` | 1.2 | Applied to the countering side's power before the exponent |
| `combat.variance` | 0.035 | Per-side power variance, proposed (3-4%) |
| `combat.powerRef` | 80 | Normalizer, in millions of power |
| `combat.roundDamageFraction` | 0.06 | Controls rounds per fight, does not change who wins |
| `combat.maxDefendersPerAttack` | 10 | Cap per attack |

Acceptance targets (variance disabled, no counter):

- 45m squad attacking a 60m squad: the 45m squad ends at 0% and the 60m
  squad ends at about 90% of its troops (the offline model gives 91%).
- 60m attacking 60m: mutual wipe.
- A 50m squad with the counter against a 60m squad of a type it counters
  is an even fight, since 50m x 1.2 = 60m.

## Turrets

A turret node periodically damages enemy squads garrisoned in nearby
nodes by a fixed percentage of their current troops. Pulse interval, the
percentage, and the "nearby" radius are tunable (`turret.*`). Turrets do
not affect marching squads and are not otherwise a combat participant.

## Fog of war

- Vision is team-shared and comes from controlled nodes. Each node type
  has a vision radius, with the large vision node having the largest.
- A team only receives information inside its combined vision. The
  server filters state per team, so hidden information is never sent.
- The map outside vision is shown as unexplored or last-seen, rendered in
  Phaser.

## Netcode (time and distance)

- Authoritative server owns all state, rolls all random numbers (seeded),
  and resolves all fights.
- A march is a record `{squad, from, to, startTime, speed}`. Clients derive
  the squad position at any time from the record and a synced server
  clock, so no per-frame position streaming is needed.
- Arrivals, captures, cooldown expiry and turret pulses are scheduled
  server events (Durable Object alarms).
- Clients send commands only (march, cancel, teleport). The server
  validates and rejects invalid ones.
- Match flow: lobby by 5-character room code, all 40 players ready or the
  host starts, 30 minute match, final scoreboard.

## Win condition

The team with the most accumulated points after 30 minutes wins.

## Tuning (`tune.json`)

Everything affecting game feel or balance lives in `tune.json` and the
Tweakpane panel: match length, squad troop count and variance, reserve
pool range, power band edges, squad count probabilities, march speed,
teleport cooldown, all node effect percentages and point rates, vision
radii, turret settings, and all `combat.*` values above.

## Testing and verification

- Headless sim tests in Node: combat acceptance targets above, rank/power
  rolls, reserve refill, stack-order fights with the 10-defender cap,
  cancel/return, teleport rules, fog filtering.
- Headless bot clients (same WebSocket protocol) to fill a 40 player match.
- Standard CLAUDE.md verification: typecheck, build, Playwright
  screenshot inspected, no console errors on boot.

## Infrastructure ownership

Codex is responsible for Cloudflare Worker and Durable Object project
setup, wrangler config, the deploy workflow, itch.io and Butler wiring,
and the itch slot decision. Secrets and API keys stay in a local
environment (untracked env file or local env vars) and are never
committed. Claude Code writes the sim, protocol, server game logic and
client.

## Out of scope (binding)

- Heroes, hero skills, rows, formations, tech, buildings, hospital,
  Emergency Center, healing, and any other Last War system not listed.
- Rallies and group attacks.
- Persistence of any kind between matches, accounts, rankings.
- Matchmaking beyond a room code.
- Phone and touch support, tablets.
- Spectator mode, replays, in-match chat, emotes.
- Anti-cheat beyond server-side validation and fog filtering.
- Art beyond placeholders until the loop is confirmed working.
- Combat while marching.
- Teleporting to nodes the team does not control.

## Open questions (need an answer before the relevant work starts)

1. Map: how many nodes, what layout, and is travel a straight line
   between coordinates or along fixed lanes between nodes?
2. Do nodes start neutral, with an NPC garrison, or pre-assigned to
   teams? Where do the 40 HQs start?
3. Power bands: are the 20 ranks equal slices of 50m-80m (1.5m each)?
   (proposed default)
4. Squad troop variance around 3000: how large? (proposed default 10%)
5. Is refill at HQ instant, or does it take time?
6. Defender stack order: arrival order, or something else?
7. Base teleport: instant on use, and what happens to squads that are
   stationed at the old HQ position or still marching home?
8. Do marching enemy squads show up inside our vision? Do nodes outside
   vision show last-known owner?
9. Node effect stacking: if a team owns two attack-boost nodes, do they
   stack, take the max, or is only one allowed?
10. Tie-break if both teams have equal points at 30 minutes?
11. Reconnect mid-match: is identity-matched reconnect in scope?
12. What happens when a player's connection drops for good: do their
    squads stay and defend?
13. Does the host need to press start, or does the match start when 40
    players have joined? Are bots allowed to fill empty slots in real
    matches or only in tests?
