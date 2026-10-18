# Airship Battle 1v1 — Godot prototype (v1 vertical slice)

Tribal-punk 1v1 airship combat: alternate attacker/defender turns, prime and
focus your weapons through fog-of-war, guess the right counter, and strip the
enemy ship zone by zone until it can't fight back.

## Run it

- **Play:** open `main.tscn` in Godot 4.3 and press Play. You command the
  *Sparrowhawk* (light, steel) against the AI *Iron Boar* (heavy, wood).
- **Watch:** run with `--demo` for AI vs AI.
- **Verify:** run with `--autobattle` for an instant headless battle + result.

## The core loop (implemented)

1. **Attacker phase** (timed by the attacker's speed stat) — pick one action:
   prime a weapon, focus aim, hold missile lock, fire, launch drones, vent heat.
2. **Defender phase** — you see an *intent signal* ("Missile lock detected —
   impact zone UNKNOWN!"), never the exact plan. Answer with CWIS, a
   directional shield, booster dodge, or brace. On quiet rounds: repair,
   recharge, or vent.
3. **Resolve** — drones strike, the committed attack lands, chain effects
   trigger (fires, deflected shots, zone destruction), then roles swap.

Faster ship attacks first. Fight until a ship is destroyed, both sides are
spent, or 30 rounds elapse (sudden-death attrition).

## Systems in v1

- **Weapons:** Stormcaller Deck Guns (manual-aim focus mechanic), Skyhook
  Lock-On Missiles (hold lock before firing, CWIS-vulnerable), Wasp Drone Bay
  (persistent drones that can be shot down).
- **Defenses:** Flak Screen CWIS (charges), Aegis Veil directional shield
  (perfect guard decays while held), Gust Boosters (light ships only).
- **Resources:** segmented hull (front/side/rear) with zone-destruction
  debuffs, armor, shield HP, energy, heat/overheat, ammo.
- **Materials:** steel deflects physical hits; wood hits harder taken and can
  catch fire.
- **Bluffing:** the AI sometimes primes weapons it never fires; watch for it.

## Hooks for the full design

`combat_engine.gd` is the stable interface: `submit_attacker_action()` /
`submit_defender_action()` take plain dictionaries, so crew abilities,
runestones, harpoons, cargo items, and flight modes can slot in as new action
types without touching the turn flow. `ai_captain.gd` owns all AI decisions in
one place for tuning.

## GitHub Pages

Published as Battleshield at https://zitian-ff.github.io/game-prototypes/battleshield/
with a link on the Game Prototypes index. The Pages workflow builds the
original Godot 4.3 source using the official single-threaded Web template,
so cross-origin isolation headers are not required. Use the on-screen
weapon and defense buttons; landscape orientation is recommended on phones.
The original preview image remains in the downloaded local ZIP.
