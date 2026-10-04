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
  over from mp-net: stable per-browser client ID, 3-character room code
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

- Every node has a **tier from 1 to 4**. Tier sets the node's score per
  second (see Scoring). A building's effect is its base value times its tier.
- **Buildings** (name, tier):
  - **Nuclear Silo** (T4): pure score, drawn as a round silo with four
    anti-aircraft towers, still one cell.
  - **Oil Refinery** (T3): pure score.
  - **Missile Turret** (T2): see Turrets.
  - **Radar Tower** (T2): a much larger vision radius.
  - **Arsenal** (T1): % bonus to the owning team's squad power.
  - **Armory** (T1): % reduction in damage taken by the owning team.
  - **Accelerator** (T1): % faster march speed for the owning team.
  - **Tech Centre** (T1): seconds off the owning team's teleport cooldown.
  - **Hospital** (T1): while held, every ally regains 100 troops a second
    (times tier) into their reserve pool, never above what the pool
    started at.
- Node effects apply to the whole owning team while the node is held, and
  stop when it is lost. Effects of the same kind stack additively.

### Rings and layout

The map is point-symmetric (both teams get an identical layout) and laid
out in concentric rings. The default is **17 nodes**:

| Ring | Contents |
|---|---|
| Centre | 1 Nuclear Silo (T4) on the exact centre cell |
| Inner | 2 Oil Refineries (T3), 2 Missile Turrets (T2), one of each per side |
| Mid | 2 Radar Towers (T2), one per side, placed where each sees the most other nodes |
| Outer | one each per side of Arsenal, Armory, Accelerator, Tech Centre and Hospital (all T1) |

Ring edges, counts, kinds and per-kind tiers are in `tune.json`
(`map.rings`, `kindTiers`, `strategic`).

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
- Scale check: all 17 nodes together pay far less than the old 35 (see Scoring tiers). A team
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
- **Orders go out from the HQ only.** A squad that is out in the field (marching
  or garrisoned) cannot be sent anywhere else. The only order it takes is
  **Return to HQ**, after which it can be ordered again. Teleport also brings
  every squad home at once.
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

Every 5 seconds each held Missile Turret fires a missile at **every
enemy-held tier 3 and tier 4 node** (Oil Refineries and the Nuclear Silo),
from anywhere on the map. A missile is a non-combat shot that travels at 5x
unit speed. On impact every garrisoned squad at that node loses 5% of its max
troops, flat, never below 1 (a hit cannot defeat a squad). If the node changed
hands while the missile was flying, nothing happens. Interval, speed, damage
and minimum target tier are tunable (`turret.*`).

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
- Match flow: lobby by 3-character room code. The first player to connect
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

As built: a bot is a small state machine. Every 8 to 20 seconds (random per bot) it
picks attack (75%), teleport (15%) or scout (10%), picks a target, and runs it if legal;
otherwise it waits for the next cycle. They attack and scout fogged nodes blind. Attacks
lean toward nearby targets and toward reinforcing their own nodes while they hold fewer than
3 garrisons; with nothing at the HQ and 2+ garrisons out they pull one squad back. Teleport
(which empties all garrisons) is only legal when the HQ is about to be hit, when wounded
squads need a refill, or when nothing is deployed. A bot whose total troops (squads plus
reserve) fall below one full squad stops acting for the rest of the match.

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
  the centre, point-symmetric.
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

## Revision after the first playtest (2026-10-02)

- Match length is chosen by the host in the lobby: 10, 15, 20 or 30 minutes.
- All units move 30% slower (`march.crossMapSeconds` 180 to 257).
- Orders only from the HQ; the only order for a unit in the field is Return to HQ.
- Hospital added; Missile Turret reworked; nodes renamed; map rebuilt to 17 nodes
  (see Node kinds and Rings above).
- Bots reduced to a random state machine (see Bots).
- Terminology: MLRS is Missile, Helicopter is Aircraft, power is shown as "Power"
  with a sword mark and an M suffix (63.2M).
- HUD: total troops above the squad panel; the inspected node is bottom centre
  with its orders to the right; Scouts and Logs are square buttons at the left edge.
- Teams are chosen in the lobby. A joiner is put on the team with fewer humans (team 1 on a tie)
  and can switch to the other team while it has fewer than 20 humans. The choice locks when the
  host starts the countdown. Bots then fill both teams up to 20 each.
- Squads are dealt when the match starts, not in the lobby: the server rolls every player's squads
  at that moment, in a shuffled order, from one seed.
- Loading screen: while the world builds, and for 2.5 seconds after, a loading screen shows the
  player's team, the match length and the squads they were dealt.
- Public information: which team holds every node is visible to everyone, with or without vision.
  Garrison counts and defender details stay private (own nodes, or a live scout report). Every enemy
  march is also public with its unit type and position; the client draws the unit sprite while the march
  is inside your own vision and a 3D question mark while it is in fog. Power and commander still need a scout.
- Allied march lines are drawn at half their previous strength.
- Squads per commander: every commander has 2 to 4 squads, dealt per team: 20% get 4, 30% get 3, the
  rest 2. Rank bands (1 is strongest) overlap with the next one and are in tune.json `roster.bands`:
  squad 1 ranks 1 to 12, squad 2 ranks 7 to 16, squad 3 ranks 13 to 20, squad 4 ranks 16 to 20. Squads
  1 and 2 never reach the weakest ranks; squads 3 and 4 are much weaker and mostly for strategic moves.
- HQ garrison: a commander can send a squad from their HQ to a friendly (ally) HQ that is out on a node,
  and it garrisons there exactly like at a node (same capacity, one squad per commander, last in fights
  first, Return to HQ recalls it). Garrisoned squads add defenders to that HQ. If the HQ teleports or is
  sent home, its guests walk home from where it was. HQs in a safe zone cannot be garrisoned.
- Hospital: +20 reserve troops per second per tier (was 100).
- Combat result text: after a fight your team was in, the victor shows one combined number of troops
  defeated (like -23123) that rises and fades; each defeated commander shows "Defeated" (up to 3).
- Individual scoring (vanity only, never affects the match): +1 per troop defeated, +1000 per node
  captured, +10 per second garrisoning a node, +500 per HQ taken to 0 HP. Values are in tune.json
  `personalScoring`. The victory screen shows the top 10 commanders and your own row.
- Map view: the floor is an upright square grid (x right, y down, 72 px tiles) instead of an isometric
  diamond grid. Buildings, HQs and units are still isometric sprites standing on a tile and reaching upward.
  Safe zones are tinted team blocks, the 8 tiles around each node (HQ slots) are lightly marked, and fog and
  vision are circles. In-world units are drawn at `iso.unitScale` (0.75) of their size, so they read smaller
  than buildings; UI icons are unchanged. This supersedes "Isometric view of the grid" above.
- Compact map and slower units: the map is 57 x 39 cells (was 75 x 51), the safe-zone distance is 5 cells, and
  units move at half their previous speed in cells per second (cross-map 392 s on the diagonal).
- Escalation: Tier 3 nodes (oil refineries) are locked until the clock has 75% of the match left, and the Tier 4
  node (nuclear silo) until 50% is left. Locked nodes cannot be marched on or scouted, show a padlock and a
  countdown, and a toast announces each unlock. Values are in tune.json `phases`.
- The lava patches are removed from the floor.
- Commander names are public: shown above enemy and allied units and on HQs whenever the unit is inside your
  vision. Power still needs a scout.
- Fog edges are crisp (no soft gradient).
- Daily capacity: the Worker keeps an estimate of this game's use of the Workers Free plan's daily limits
  (row writes and requests, 90% of the plan, reset at 00:00 UTC; one match is costed at 4,000 writes and 2,500
  requests). The landing page shows "about N games left today", and when less than one match is left the Create
  button is disabled and the Worker refuses new rooms (joining and reconnecting stay allowed). The estimate only
  sees this game's own traffic. It is not tied to R2, which holds no gameplay data.
- Score pools and caches: when a node changes hands, a 60 second settling timer starts and its points are
  permanent. After it ends, the points the node's tier generates (10/30/50/80 a second, not the garrison bonus)
  also pile up in a temporary pool under the node, which counts toward the holder's total. The pool is split into
  equal score caches scattered 1.8 to 4.6 cells around the node: 4 at first, one more for every 500 points the pool
  has earned, up to 8. Any scout, friend or enemy, can fly to a visible cache; the moment it touches, that cache's
  share leaves the pool and is banked permanently for the scout's team (the holder's own scout secures it, an enemy
  scout steals it from the holder's total). Each collected share is pool / caches left; when none are left a fresh
  batch of 4 appears. When the node changes hands the old holder loses whatever is left in the pool, the caches
  vanish, and the new holder starts a fresh 60 seconds. Pool numbers and caches are only visible inside your vision.
  Bots scout visible caches. Values are in tune.json `pool`.
- Layout revision: the Oil Refinery is now Tier 2 (the two refineries sit in the middle ring with the two Radar
  Towers) and capturable from the start. The Missile Turret is now Tier 3 (inner ring with the Silo's T4 at the
  centre) and unlocks with 75% of the clock left. The turret still hits enemy-held tier 3 and 4 nodes, so it now
  targets enemy Missile Turrets and the Nuclear Silo, not refineries. Tier 1 nodes sit in a band close to each
  team's spawn side (columns 10% to 70% of the way from the edge to the centre) and the refineries slightly
  further out (30% to 85%), so there is early action. Radar Towers are placed to see the Tier 3 and 4 nodes
  first. This supersedes the node tier table above.
- Score cache values: a cache is worth the pool total at the moment it spawns divided by the number of caches
  there are after it spawns, and that value never changes afterwards. The first caches appear once the pool has
  earned 500 points (four of them), then one more each further 500 earned, up to eight; if all are collected the
  next 500 earned brings four again. This supersedes the "equal share of the pool" wording above.
- Bots: with enemy score caches in view, a bot with a scout at home sends it to the closest one (70% of decisions)
  and never collects a cache of a node its own team holds.
- Enemy scouts: scouts of the other team are drawn (with the commander's name) while they are inside your vision,
  so you can see them fly to a node, an HQ or a cache. Their position is only sent while it is inside your vision.
- Bot variance: each bot has its own appetite for stealing caches, drawn once between 10% and 85% of decisions, and
  at most two scouts of a team head for the same cache (counting the ones already flying and those sent in the same
  decision round).
- Even node spacing and four hospitals: Tier 1 and Tier 2 nodes are placed one at a time at the legal spot furthest
  from everything already placed (and from its own mirror), inside the spawn-side band, so they end up evenly
  spread and players get real choices of where to advance. There are now two hospitals on each side (4 in total) and
  19 nodes in all. Nodes are at least 5 cells apart (nodeMinSpacingCells).
- Bots and HQs: a bot still in the safe zone moves its HQ onto a node its team holds as soon as it can; it assaults
  an enemy HQ that is out in the field only when confident (with a live scout report, its best squad must beat the
  strongest known defender by 10%; with no report, only a squad of effective power 66 or more, a bit less against a
  damaged HQ) and scouts unreported HQs first; and it sends a fit squad to garrison an ally's HQ that an enemy march
  it can see is about to hit, when the squad can get there first. Each bot draws its own aggression and loyalty, as it
  does its cache appetite. Bots no longer throw squads at enemy HQs blindly.
- Square map and Portal Nexus: the map is a 41 x 41 square (was 57 x 39), with per-cell march speed unchanged
  (cross-map 329 s on the diagonal), so at least four capturable nodes are under two minutes from each spawn.
  There are four Portal Nexus nodes (two per half, evenly placed): neutral, never capturable (marches and scouts
  to them are refused, no garrison, no score), any HQ of either team may teleport onto one (it has the usual 8
  slots, shared), and each lights only the 8 cells around it for both teams, so HQs that land there are in plain
  view of everyone. That makes 23 nodes in total.
- Line strength: march and order lines are drawn at 40% of their old strength (`lines.strength` in client.tune.json)
  and slightly thinner.
- Bot targeting: bots creep the front forward from the nodes they hold (a node's pull is how close it is to the
  nearest node of ours), and one decision in ten raids a node at least 12 cells beyond that front. Bots only scout
  enemy-held nodes and enemy HQs, never neutral or friendly nodes. Bot HQ aggression is 10% to 55% per decision.
- Pool rule fix: a score pool (and its caches) now only exists on a node whose control swapped from one team to
  the other. Capturing a neutral node opens nothing and its points are simply permanent. The 60 second settling timer,
  the fixed-value caches and the loss of the pool when the node swaps back all work as described above, but only for
  swapped nodes. This supersedes "when a node changes hands" in the pool paragraph.
- Where this section conflicts with older text above, this section wins.
