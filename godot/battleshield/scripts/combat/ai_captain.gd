extends RefCounted
## AI captain: plays both sides in demo mode, and the enemy in interactive mode.
## Attacker: primes, focuses, locks, fires — and sometimes bluffs by priming
## a weapon it never intends to use. Defender: guesses counters from the
## intent signal, never from the hidden plan.

static func choose_attacker_action(ship, foe, engine) -> Dictionary:
	if ship.overheated:
		return {"type": "vent"}
	# Bluff: occasionally prime a weapon just to spook the defender.
	var unprimed := []
	for w in ship.weapons:
		if w.needs_priming():
			unprimed.append(w)
	if not unprimed.is_empty() and randf() < 0.18:
		var w = unprimed[randi() % unprimed.size()]
		return {"type": "prime", "weapon": w.id}
	# Real priming first.
	for w in ship.weapons:
		if w.needs_priming() and ship.energy >= 4.0:
			return {"type": "prime", "weapon": w.id}
	# Missiles want a full lock.
	var missiles = ship.get_weapon("missiles")
	if missiles != null and missiles.lock_progress < 1.0 and missiles.ammo >= missiles.ammo_per_shot:
		if randf() < 0.65:
			return {"type": "lock"}
	# Focus the cannon for accuracy.
	var cannon = ship.get_weapon("cannon")
	if cannon != null and cannon.primed and cannon.focus_turns < 2 and randf() < 0.45:
		return {"type": "focus", "weapon": "cannon"}
	# Launch drones when the bay is empty-ish.
	var drones = ship.get_weapon("drones")
	if drones != null and ship.drones.size() < 2 and drones.can_fire(ship.energy, ship.overheated) and randf() < 0.5:
		return {"type": "launch"}
	# Fire the best ready weapon at the weakest zone.
	var best = null
	var best_score := 0.0
	for w in ship.weapons:
		if w.kind == "drone":
			continue
		if w.can_fire(ship.energy, ship.overheated):
			var score: float = w.damage * w.accuracy() * float(w.shots_per_attack)
			if score > best_score:
				best_score = score
				best = w
	if best != null:
		return {"type": "fire", "weapon": best.id, "zone": foe.weakest_zone()}
	# Nothing to shoot with: cool down or pass.
	if ship.heat > 50.0:
		return {"type": "vent"}
	return {"type": "pass"}

static func choose_defender_action(ship, foe, sig: Dictionary, engine) -> Dictionary:
	var kind: String = sig.get("kind", "none")
	if kind == "none":
		return _support_action(ship)
	var zone: String = sig.get("zone", "")
	var wkind: String = sig.get("kind", "")
	var cwis = ship.get_defense("cwis")
	var shield = ship.get_defense("shield")
	var booster = ship.get_defense("booster")

	match wkind:
		"missile":
			# Zone unknown — CWIS is the reliable answer.
			if cwis != null and cwis.can_use(ship.energy, ship.weight_class) and randf() < 0.85:
				return {"type": "cwis"}
			if shield != null and shield.can_use(ship.energy, ship.weight_class):
				# Guess: guard the weakest zone.
				return {"type": "shield", "zone": ship.weakest_zone()}
		"cannon":
			if shield != null and shield.can_use(ship.energy, ship.weight_class) and zone != "" and randf() < 0.7:
				return {"type": "shield", "zone": zone}
			if booster != null and booster.can_use(ship.energy, ship.weight_class) and randf() < 0.5:
				return {"type": "booster"}
		"drone":
			if cwis != null and cwis.can_use(ship.energy, ship.weight_class) and randf() < 0.8:
				return {"type": "cwis"}
			if shield != null and shield.can_use(ship.energy, ship.weight_class):
				return {"type": "shield", "zone": ship.weakest_zone()}
	# Fallbacks.
	if booster != null and booster.can_use(ship.energy, ship.weight_class) and randf() < 0.3:
		return {"type": "booster"}
	return {"type": "brace"}

static func _support_action(ship) -> Dictionary:
	# No inbound attack: repair, vent, or recharge.
	var weak: String = ship.weakest_zone()
	if ship.hull[weak] < ship.hull_max[weak] * 0.7 and ship.energy >= 6.0:
		return {"type": "repair", "zone": weak}
	if ship.heat > 55.0:
		return {"type": "vent"}
	if ship.energy < ship.energy_max * 0.5:
		return {"type": "recharge"}
	return {"type": "hold"}
