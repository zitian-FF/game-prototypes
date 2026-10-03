## Current milestone

Post-playtest revision 1, team selection and the loading screen are merged. The unit, HQ and
refinery art pass is on the branch, verified locally, not yet merged.

## What was implemented

- Bug fixes: the game scene built its world twice because a method named `init`
  collided with Phaser's own `Scene.init` (stale second map when zoomed out, and a
  second match could hang on start before the first state arrived). Renamed. Zoom-out
  now stops where the whole map fits the screen.
- Lobby: host picks 10, 15, 20 or 30 minutes (protocol 2, stored in the room meta).
- Rules: orders only go out from the HQ, the only order for a unit in the field is
  Return to HQ (also from a garrison); all units 30% slower (cross-map 257s); new
  Hospital (+100 reserve troops/s per tier to every ally while held, capped at the
  starting pool); Missile Turret now fires every 5s at every enemy-held T3 and T4 node
  (missile at 5x unit speed, hit takes 5% of max troops flat from each garrisoned squad,
  never below 1, no effect if the node changed hands in flight).
- Map: 17 nodes. Silo (T4) centre, 2 Oil Refineries + 2 Missile Turrets inner, 2 Radar
  Towers mid (placed to see the most nodes), outer one each per side of Arsenal, Armory,
  Accelerator, Tech Centre, Hospital.
- Bots: state machine every 8 to 20s: weighted attack 75 / teleport 15 / scout 10, nearby and
  own-node-leaning targets, teleport only when useful, spare garrison pulled back when nothing
  is at HQ, and a bot with less than one full squad of troops left stops acting. Both teams now
  hold 7 to 10 of 17 nodes at the end of bot-only matches.
- Client: renamed buildings, Aircraft/Missile names, Power with a sword mark and an M
  suffix, total troops and reserve above the squad panel, inspected node bottom centre
  with orders to its right, square Scouts and Logs buttons at the left edge, nuclear silo
  and oil refinery drawn as their own shapes, hospital cross icon, missile flight and
  impact effects, "Reset saved session" on the menu (this browser only).
- Teams: players join the smaller team and can switch in the lobby while the other team has room
  (protocol `setTeam`, `teamFull`); bots fill both teams to 20; squads are dealt at match start.
  Lobby shows two team columns with Join buttons.
- Loading screen: shown while the map builds, then for 2.5s with your team, match length and the
  squads you were dealt.
- Art pass: units redrawn with shading and ground shadows, mirrored left or right from their travel
  direction (and they keep the last facing when they stop). Helicopter follows the reference (four
  brown blades with orange tips, chin gun, engine pods with orange exhausts, tail rotor). HQ follows the
  reference (stepped beige building, team-colour roofs, rooftop cannon, antenna, flag, hazard-striped
  pad); oil refinery follows the second reference (two domed tanks with pulsing green tops, team
  clamps). All of it is solid colour, no transparency; out-of-sight nodes are darkened, not faded.
- Packages: arena-sim 0.3.0, firestorm-net 0.2.0.

## Key technical decisions

- No global "clear server" button: the stuck second match was the client bug above, not
  stale server data, and a global wipe would let any visitor end everyone's matches.
  Hosts have End room, and the menu can reset this browser's saved identity.
- Per-building tiers (`kindTiers`) and strategic placement (`strategic`) are map-ring
  options in tune.json, so the layout stays data.
- Match length is applied as a tune override stored in the match meta, so a rebuilt room
  replays with the right duration.
- Cancel now means Return to HQ from either a march or a garrison; march needs the squad
  at the HQ (`notAtHq`).

## Open questions

- Cost: bots issue about 1,150 commands per match (about 3,000 row writes), roughly 33
  matches a day on the Workers Free plan.
- With 17 nodes and 20 players per team, garrisons will be crowded; worth a playtest.
- Missile damage floor is 1 troop (a hit cannot defeat a squad). Say if hits should be
  able to kill.
- Placeholder numbers (reserve pool, score rates) still unplayed; BRIEF.md has a revision
  section at the end that wins over older text.

## Known issues

- Verified in headless Chromium and the local runtime only; the live Worker has not been
  exercised (the build sandbox cannot reach workers.dev). Codex has a smoke test queued.
- Effects are first versions (missile arc, silo and refinery are simple vector shapes).

## Next proposed step

1. Merge to deploy protocol 2 (Worker and clients together), then Codex smoke-tests it.
2. Playtest with real players for feel: march time at 257s, 17 nodes, bot activity.
3. Narrow the Cloudflare token (Codex).
