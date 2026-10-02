# firestorm-arena

A 20 vs 20 desktop-browser arena mode. Each player commands a few
squads, marches them between capturable nodes under fog of war, and the
team holding the most captured points when 30 minutes run out wins.
Combat is a simplified auto-resolved rock-paper-scissors between squads.
Game feel and UI references are Last War: Survival (squad marches,
node selection, HQ refill), but only the parts listed here are in scope.

Everything on screen is drawn by code as vectors (see "Art direction").
Mechanics are built and proven before polish effects.

## Platform and stack

- Target: desktop browser, mouse driven. Phone play is explicitly **not**
  required for this prototype (the user has waived the repo-wide rule in
  CLAUDE.md for this brief; CLAUDE.md is known to be out of date on
  this point).
- Client: Phaser 3 + TypeScript (strict) + Vite. **All UI is drawn in the
  Phaser canvas**: HUD, squad list, command panel, lobby, scout review,
  combat logs, map, nodes, marching squads and fog. There is no React,
  no Tailwind and no DOM overlay (the user is phasing that approach out
  completely; CLAUDE.md's "UI implementation split" section is out of date
  and does not apply to this prototype).
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
- Art: **Claude draws everything as vectors** in the Phaser canvas
  (procedural graphics, no image files, nothing in R2). The user has
  overridden the "user produces all artwork" rule for this prototype.
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

## Map, grid and nodes

- **The world is a grid** (`map.widthCells` x `map.heightCells`, default
  75 x 51 cells of `map.cellSize` 40 units). A node, an HQ and a squad each
  fill one cell. Units travel from the centre of their cell to the centre
  of the commanded cell in a straight line at any angle. There are no
  lanes, and no cell-by-cell stepping.
- Ownership is per team. Every node starts neutral with no garrison.
- **Base slots:** each node has 8 base slots, the 8 cells around its cell
  (its 3x3 block), taken in the order E, SE, S, SW, W, NW, N, NE. HQs sit in
  these slots. Slot access is tied to node control: a player can only
  teleport into a free slot at a node their team currently controls.
  Slots are occupied by whichever HQs are there, so after a node flips,
  the previous owner's HQs stay in their slots as stranded HQs while the
  new owner's team can teleport into the remaining free slots beside them.
  Nodes are spaced so no two slot blocks overlap.
- **Safe zones:** each team has an invulnerable block of cells (5 x 4,
  mirrored left and right) where its HQs start and where they return to
  when defeated. Nothing in a safe zone can be attacked.
- **Garrison limits:** a node holds at most **20 squads**, and only **one
  squad per commander** (so at most one from each of a team's 20
  commanders). Both numbers are in `tune.json` (`garrison.*`). A squad that
  arrives at your team's node when it is full, or when its commander
  already has a squad there, turns back and goes home at normal speed (it
  is not defeated). The march order is refused up front in those cases,
  including when the commander already has another squad on the way to
  that node. An attacker can only fight through 10 defenders per attack
  (see Combat), so a full garrison of 20 always has at least 10 left.

### Node kinds and tiers

- Every node has a **tier from 1 to 4**, drawn as that many stacked cubes
  in stepped tiers. Tier sets the node's score per second (see Scoring).
- **Kinds:** `points` (pure score) and six power nodes. A power node's
  effect is its base value times its tier, so a tier 2 node is twice a
  tier 1 node.
  - Attack boost: % bonus to the owning team's squad power.
  - Defense boost: % reduction in damage taken by the owning team.
  - Speed boost: % faster march speed for the owning team.
  - Teleport cooldown: seconds off the owning team's teleport cooldown.
  - Large vision: a much larger vision radius.
  - Turret: see Turrets.
- Power nodes exist at tier 1 (weak) and tier 2 (strong) only. Tiers 3
  and 4 are pure points nodes.
- Node effects apply to the whole owning team while the node is held, and
  stop when it is lost. Effects of the same kind stack additively.

### Rings and layout

The map is point-symmetric (both teams get an identical layout) and laid
out in concentric rings, outside in. The default is **35 nodes**:

| Ring | Tier | Nodes |
|---|---|---|
| Outer | 1 | 8 points, 2 attack, 2 defense, 2 speed, 2 large vision |
| Second | 2 | 4 points, 2 attack, 2 defense, 2 teleport cooldown, 2 turret |
| Third | 3 | 6 points |
| Centre | 4 | 1 points node on the exact centre cell |

Ring edges, counts and kinds are in `tune.json` (`map.rings`). With 76
squads for 35 nodes, most nodes are contested.

## Scoring

- **Node score:** a controlled node earns its team score per second by tier:
  tier 1 = 10, tier 2 = 30, tier 3 = 50, tier 4 = 80. This applies to
  power nodes too, and continues while the node has no garrison.
- **Garrison bonus:** each commander garrisoned in a node earns the node's
  owner **+10 per second**. A node holds one squad per commander, so this is
  simply 10 per garrisoned squad (at most 20 x 10 = 200 per second on one
  node). The same commander in two different nodes earns +10 at each.
- Teleporting returns every squad to the HQ, so it also stops the
  garrison bonus until squads are redeployed.
- Points accrue on the server. Rates are in `tune.json` (`scoring.*`).
- Scale check: all 35 nodes together pay about 900 per second. A team
  holding half earns about 450, and the garrison bonus is at most about 380
  (all 38 squads garrisoned).
## HQ as a target

- An enemy HQ outside a safe zone can be selected as an attack target and
  behaves like a node: the attacker fights its defenders.
- Each HQ has **4 HP**. Every time an attacker defeats all of the HQ's
  defenders, the HQ loses 1 HP. At 0 HP the HQ is defeated: it and all
  its squads return to the owner's safe zone.
- A HQ with no defenders loses 1 HP to each attacker that arrives.
- Each player chooses which of their squads defend the HQ by checking or
  unchecking them (as in Last War). Only checked squads that are at the
  HQ fight. Marching squads and unchecked squads do not defend.
- HQ HP does not regenerate. It returns to full only when the HQ is
  defeated and forced back to its safe zone.
- After attacking an HQ, the attacker returns to its own HQ, whether it
  won or lost.

## Commands

All actions are coordinates, timers and unit references:

- **March:** select a squad, select a target node, issue the march. The
  squad leaves its current position and travels to the node. Travel time
  is `distance / speed` (speed modified by node bonuses). Marching to a
  node your team holds is refused if it is full or your commander already
  has a squad there or on the way.
- **Scout:** each HQ owns 3 scouts. A scout is a fast, non-combat unit
  sent to a node or HQ. It travels at **3x squad march speed**. On
  arrival it reveals that target's defender info: for each defender,
  the **squad type**, its **power adjusted by troops remaining**
  (`power * troops / maxTroops`), and its **commander**. The
  revealed info lasts **60 seconds**. A scout must return to its HQ before it can be sent again.
  Scouts cannot capture, cannot be attacked, and do not trigger control
  changes. (Speed and exact reveal fields are tunable, see Open
  questions.)
- **Dodge:** a player may teleport their HQ away while enemy marches are
  inbound, as long as their teleport is off cooldown. The inbound
  attackers then arrive at an empty slot. There is no inbound lock.
- **Cancel:** a marching squad can be issued a cancel. It turns around and
  returns to its HQ.
- **Command lines:** when a command is issued, an animated dotted line
  shows its route (see Art direction).
- **Base teleport:** a player's HQ can teleport to a free base slot at a
  node their team currently controls. It is instant. All of the player's
  squads, wherever they are (garrisoned or marching), return to the HQ
  and teleport with it. Cooldown is 2 minutes, reduced by owned
  teleport-cooldown nodes. Teleport is only allowed to controlled
  nodes.
- Squads marching in the field cannot fight. All combat resolves at nodes.

## Node flip and stranded HQs

When a node changes control, HQs in its slots owned by the previous
controller are **stranded**: they stay in place and remain valid attack
targets. A stranded HQ can still teleport away to a node its team
controls, if its teleport is off cooldown, and is otherwise trapped.
Capturing a node therefore exposes the ring of HQs beside it, and the
capturing team can teleport into free slots there to strike them.

## Map scale

The map is sized so that a march across the whole map takes about **3
minutes** at base squad speed. March speed is derived from map size to
hit that target and both are tunable (`march.crossMapSeconds`
default 180). This is meant to sit near the 2 minute teleport cooldown so
that dodging, baiting and forward-node strikes all matter.

## Combat (auto-resolved at a node)

When an attacking squad arrives at a node held by the enemy:

1. The attacker fights the defender stack one squad at a time, for up to
   **10 defender squads** per attack. Order is last in, first fought
   (first in, last fought), as in Last War: the squad that garrisoned
   most recently is fought first, the earliest is fought last.
2. Each fight is auto-resolved in rounds until one squad reaches 0
   troops. Both sides take damage each round. The attacker keeps its
   remaining troops between fights.
3. If the attacker clears the whole defender stack, it **takes control of
   the node immediately** and garrisons it.
4. A squad reduced to 0 troops is **defeated**, not deleted. A defeated
   squad returns to its own HQ at **50% march speed** and can refill there
   from its player's reserve pool. This applies to defeated attackers and
   defeated defenders.
5. If the attacker clears 10 defenders and defenders remain, it **returns
   to its HQ** with whatever troops it has.
6. An attacker arriving at a node with no defenders captures it immediately.
7. An ungarrisoned node still belongs to the team that last captured it,
   and its effects keep applying. Control switches the moment an enemy
   squad touches (arrives at) it.

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

- Vision is team-shared and comes from controlled nodes. Each node kind
  has a vision radius in cells, with the large vision node having the
  largest.
- **Garrison count:** a defender count is shown below a node. Your own
  team sees the exact count on its nodes. Anyone else sees a count on an
  enemy node only while a scout report on it is live, and it is the count at
  the time of the scout. The scout review lists these with countdowns.
- **Fire is visible:** a defeated squad walking home burns, and an HQ
  below full HP burns, for anyone who can see them. Exact HP is not shown.
- A team only receives information inside its combined vision. The
  server filters state per team, so hidden information is never sent.
- The map outside vision is shown as unexplored or last-seen, rendered in
  Phaser.
- Inside vision a player sees enemy marches and enemy node status (owner),
  but cannot open them to see commander info, squad power or squad type.
  Enemy marching units are shown as masked units by default.
- Details are revealed in two ways:
  - **Scouting** a node or HQ reveals its defender info.
  - **Combat logs** after a fight reveal both sides' info and the outcome.
- **UI, scout review:** a button next to the combat logs opens a list of
  recent active scouting reports, each with its remaining-time countdown.
  The server sends each report with an expiry timestamp and the client
  runs the countdown locally, so there is no per-second server traffic.
- **UI, combat logs:** a list of combat logs, most recent first. A log
  shows full info for both sides (including commanders) and the outcome.
  The combat logs button sits next to the scout review button.
- Revealed info expires after 60 seconds. Once a unit's info is revealed,
  the world map shows that unit's type on it while it is visible and the
  info has not expired. Under fog of war it is a masked enemy unit
  again.

## Art direction

Look and feel follow Last War: Survival where possible. All of it is drawn
as vectors in the Phaser canvas.

**View and world**
- Isometric view of the grid.
- Volcanic ground with patches of animated lava. Now and then a small
  eruption throws fire from the sky, and burning patches land and fade on
  the ground. These are cosmetic and use client randomness, never the
  sim's seeded RNG, so they differ per client and need no sync.

**Units** (each is an outline plus the team colour, one cell in size)
- Tank squad reads as a 2D tank, aircraft squad as a helicopter, missile
  squad as an MLRS truck, scout as a fixed-wing plane.
- Neutral things are grey. Team colours: blue and orange.

**Nodes**
- A cube carrying an icon for what it does (eye for vision, sword for
  attack, and so on). Higher tiers are stacked cubes in stepped tiers.
- Below a node: the defender count (see Fog of war).

**Command lines**
- Only drawn when a command is issued, as an animated dotted line that
  simulates the movement of the command.
- Your own lines are green. Allies' lines are muted in their team colour.
  Enemy lines (visible inside your vision) are drawn clearly in red.

**Effects** (polish, after the core loop works)
- Combat: random bullet sprays and explosions at the node for 2 to 3
  seconds. The sim resolves a fight instantly, so the client plays the
  animation and shows the ownership flip when it ends.
- Defeated squads burn as they return to their HQ.
- An HQ below full HP burns permanently until it is defeated and resets
  (HP never regenerates).
- Teleport: an extract effect at the old position and a landing effect at
  the new one (the teleport event carries both).

## Netcode (time and distance)

- Authoritative server owns all state, rolls all random numbers (seeded),
  and resolves all fights. The game logic is the pure `arena-sim` package;
  the lobby, wire protocol, updates and bots are `firestorm-net`; the
  Durable Object only connects them to Cloudflare.
- A march is a record `{squad, from, to, startTime, speed}`. Clients derive
  the squad position at any time from the record and a synced server
  clock, so no per-frame position streaming is needed.
- Arrivals, captures, cooldown expiry and turret pulses are scheduled sim
  events. The server wakes once per broadcast pulse (1 second) rather than at
  every event: each event carries its own timestamp, so processing a batch
  late gives exactly the same match and only delays when players hear of it,
  by at most one pulse. This halves Durable Object requests and writes.
- Each team gets one patch per pulse (changed nodes, squads, HQs, scouts,
  enemy marches, reports and logs) plus the events it may see: its own, and
  fights or captures it can watch (which arrive without unit details). A
  new or returning player gets the full view first. Marching units carry no
  position; clients derive it from the march and the synced clock.
- The match is stored as a replay log (seed, roster, accepted commands with
  sim times), so an evicted Durable Object rebuilds the match exactly.
  Bot orders are logged too.
- The server sends its own `tune` to each client at match start.
- Clients send commands only (march, cancel, teleport, scout, setDefend).
  The server validates and rejects invalid ones.
- Match flow: lobby by 5-character room code. The first player to connect
  creates the room and is host; joining a room that does not exist is
  refused, and so is creating a code that is taken. The host presses Start,
  which opens a 3 second cancel window (the host can abort during it).
  The host chooses either to start with only the players present or to
  fill all remaining slots with bots. Humans are split across the two teams,
  bots fill the rest to 20 v 20. 30 minute match, final scoreboard.
- Reconnect: a player who drops can come back with the same client id and
  gets the full view. Strangers are refused once a match has started. A
  lobby host who disconnects has 60 seconds to return, a running match
  with nobody connected is abandoned after 10 minutes (and the sim does not
  tick meanwhile, it catches up when someone returns), and a finished room
  closes after 15 minutes.
- A message from a client is untrusted: it is size-limited, schema-checked,
  rate-limited per socket, and the sender can never choose who a command
  is from.

## Win condition

The team with the most accumulated points after 30 minutes wins.

## Tuning (`tune.json`)

Everything affecting game feel or balance lives in `tune.json` and the
Tweakpane panel: match length, squad troop count and variance, reserve
pool range, power band edges, squad count probabilities, march speed,
teleport cooldown, grid and ring layout, all node effect values, tier and
garrison scores, vision radii, turret settings, and all `combat.*` values
above. All node numbers are placeholders chosen by Claude except the
scores per tier and the garrison bonus, which came from the user.

## Bots

Bots can fill empty slots in real matches (the host chooses). A bot
should try to capture as many nodes as possible, and defend and attack
intelligently. Bots use the same commands as players, run on the server
through the same sim, and obey the same fog and reveal rules: a bot is a
function of its team's filtered view and nothing else.

As built: bots spread out (a node holds one squad per commander, and a
teammate already heading for a node makes it worth only the garrison bonus),
keep their strongest squad back as a striker that scouts first, attack only
what a fresh scout report says they can beat with room to spare, cover
their own nodes when an enemy march is heading for them, and teleport
forward, to refill, or to dodge. Known limits: they rarely attack HQs
(enemy HQs are seldom in sight), do not model node boosts in their fight
estimates, and never move a garrisoned squad.

## Testing and verification

- Headless sim tests in Node: combat acceptance targets above, rank/power
  rolls, reserve refill, stack-order fights with the 10-defender cap,
  cancel/return, teleport rules, fog filtering.
- Full 40 player matches through the room in Node (bots, fog leak checks,
  reconnects, replay rebuild, abandonment, cost budget) and an end-to-end
  run against the local Cloudflare runtime (`npm run e2e -w firestorm-net`).
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
- React, Tailwind or any DOM UI layer.
- Image or sprite files (everything is drawn as vectors in code).
- Combat while marching.
- Teleporting to nodes the team does not control.

## Decisions recorded from the design chat

- Map is lane-free, straight-line travel, 8 base slots around each node.
- Each team has an invulnerable safe zone for HQ start and return.
- Defender stack: last in, first fought.
- Teleport is instant and all squads go with the HQ.
- Only enemy marches and node status are visible, with no inspect.
- HQs are attackable like nodes, 4 HP, defenders chosen by check/uncheck.
- Host starts the match manually with a 3 second cancel, with or without
  bots.
- Defeated squads return to HQ at 50% speed, they are not deleted.
- HQ HP only restores when the HQ is defeated and teleported to the safe
  zone. After an HQ attack, the attacker returns to its HQ.
- Scouts: 3 per HQ, 3x squad speed, non-combat, must return before reuse.
  Reveal type and troop-adjusted power for 60 seconds.
- A defeated squad is not deleted: it returns to its HQ at 50% speed and
  refills from the reserve pool.
- Node flip: the previous controller's HQs in its slots become stranded
  (stay, targetable, can teleport away if off cooldown). Slot access is
  tied to node control, and the new controller's team can teleport into
  free slots beside stranded HQs.
- Dodge teleport is allowed whenever the teleport is off cooldown.
- Map scale target: about 3 minutes to march across the whole map.
- A winning attacker at a node stays and garrisons. The return-to-HQ
  rule is for HQ attacks.
- Bots obey fog and the same reveal rules as players.
- Information reveal: scouting and combat logs. Revealed units show their
  type on the map while visible, masked under fog.
- An ungarrisoned node keeps its owner until an enemy touches it.
- Bots attempt to capture as many nodes as possible and play defense and
  offense.
- The world is a grid. Nodes, HQs and squads fill one cell each, units move
  centre to centre in a straight line, slots are the 8 surrounding cells.
- Four tiers of node (stacked cubes), laid out in rings with tier 4 alone in
  the centre, 35 nodes, point-symmetric.
- Scoring: 10/30/50/80 per second by tier, plus 10 per second per unique
  commander garrisoned per node.
- A node holds at most 20 squads and one per commander. An attacker only
  fights through 10 per attack.
- Defender counts: own team exact, others only via a scout.
- HQs never regenerate and burn while damaged.
- Command lines are shown for self (green), allies (muted) and enemies (red).
- All art is vector, drawn by Claude, isometric volcanic setting.

## Defaults in force (not yet confirmed, change on request)

- 20 ranks are equal slices of 50m-80m.
- Squad troop variance around 3000 is +/-10%.
- HQ refill is instant on arrival and partial if the pool is short.
- Tie at 30 minutes goes to the team that first reached the tied score.
- Mid-match reconnect is in scope (stored client ID).
- A permanently disconnected player's squads stay and defend.
- Power nodes only exist at tiers 1 and 2 and score at those tiers' rates
  (my reading of "powered nodes give tier 1 and 2").
- Enemy command lines are red (the user said only "colour coded").

## Open questions

1. If all 8 slots around a node are filled by stranded HQs, can the
   capturing team still teleport in? (Default: no, until a stranded HQ
   leaves or is defeated, since occupied slots are unavailable.)
2. Is the reading of power node tiers right (tiers 1 and 2 only, scoring
   10 and 30 per second)?
3. Does the 3 minute cross-map target still feel right now that the map is
   75 x 51 cells and there are only 35 nodes?
