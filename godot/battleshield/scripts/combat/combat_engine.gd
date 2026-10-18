extends Node
## Turn engine for 1v1 airship combat.
## Each round: ATTACKER phase (commit an action) -> DEFENDER phase (react or
## support) -> RESOLVE (drones, the committed attack, chain effects) -> swap.
## The defender sees an intent *signal* (fog of war), never the exact plan.

signal battle_log(msg: String)
signal phase_changed(phase: String)   # "attacker" | "defender" | "resolve" | "over"
signal battle_finished(winner_name: String, reason: String)

const ShipData = preload("res://scripts/data/ship_data.gd")

const PHASE_ATTACKER := "attacker"
const PHASE_DEFENDER := "defender"
const PHASE_RESOLVE := "resolve"
const PHASE_OVER := "over"

var player                # ShipData (human or AI in demo)
var enemy                 # ShipData
var round_num: int = 1
var max_rounds: int = 30
var attacker              # ShipData
var defender              # ShipData
var phase: String = PHASE_ATTACKER
var pending_attack: Dictionary = {}
var pending_defense: Dictionary = {}
var intent_signal: Dictionary = {}
var over: bool = false
var winner_name: String = ""
var win_reason: String = ""

func setup(p, e) -> void:
	player = p
	enemy = e
	round_num = 1
	over = false
	# Faster ship attacks first.
	if enemy.speed > player.speed:
		attacker = enemy
		defender = player
	else:
		attacker = player
		defender = enemy

func start_battle() -> void:
	_log("=== BATTLE START: %s vs %s ===" % [player.name, enemy.name])
	_log("%s is faster and attacks first." % attacker.name)
	_begin_attacker_phase()

# ------------------------------------------------------------------ phases --

func _begin_attacker_phase() -> void:
	phase = PHASE_ATTACKER
	pending_attack = {}
	pending_defense = {}
	intent_signal = {}
	phase_changed.emit(phase)

func _begin_defender_phase() -> void:
	phase = PHASE_DEFENDER
	phase_changed.emit(phase)

func phase_time_limit() -> float:
	"""Attacker turn timer scales with the attacker's speed stat."""
	return 12.0 + float(attacker.speed) * 1.5

func is_player_attacker() -> bool:
	return attacker == player

func is_player_defender() -> bool:
	return defender == player

# ---------------------------------------------------------- attacker input --

func submit_attacker_action(action: Dictionary) -> bool:
	if over or phase != PHASE_ATTACKER:
		return false
	var atype: String = action.get("type", "pass")
	var ok := true
	match atype:
		"prime":
			_do_prime(action)
		"focus":
			_do_focus(action)
		"lock":
			_do_lock(action)
		"fire":
			ok = _do_fire_commit(action)
		"launch":
			ok = _do_launch_commit(action)
		"vent":
			attacker.vent_heat()
			_log("%s vents heat (now %d)." % [attacker.name, int(attacker.heat)])
		"pass":
			_log("%s holds position." % attacker.name)
		_:
			_log("%s holds position." % attacker.name)
	if not ok:
		return false
	if pending_attack.is_empty():
		# No attack committed: defender gets a support action instead.
		intent_signal = {"kind": "none", "text": _quiet_signal_text()}
		_begin_defender_phase()
	else:
		_begin_defender_phase()
	return true

func _quiet_signal_text() -> String:
	# Fog of war: defender sees energy movement, not the plan.
	var r := randf()
	if r < 0.3:
		return "Energy spike on %s — no inbound attack." % attacker.name
	elif r < 0.6:
		return "%s is maneuvering — no inbound attack." % attacker.name
	return "All quiet on %s." % attacker.name

func _do_prime(action: Dictionary) -> void:
	var w = attacker.get_weapon(action.get("weapon", ""))
	if w == null or w.primed:
		_log("%s adjusts systems." % attacker.name)
		return
	attacker.energy = maxf(0.0, attacker.energy - 4.0)
	var done: bool = w.prime_tick()
	_log("%s primes %s (%d/%d)." % [attacker.name, w.name, w.prime_progress, w.prime_turns])
	if done:
		_log("%s is PRIMED and ready." % w.name)

func _do_focus(action: Dictionary) -> void:
	var w = attacker.get_weapon(action.get("weapon", ""))
	if w == null or w.kind != "cannon":
		return
	if w.focus_turns >= w.max_focus:
		_log("%s holds aim steady." % attacker.name)
		return
	attacker.energy = maxf(0.0, attacker.energy - 3.0)
	w.focus_turns += 1
	_log("%s focuses aim (%d/%d) — accuracy rising." % [attacker.name, w.focus_turns, w.max_focus])

func _do_lock(action: Dictionary) -> void:
	var w = attacker.get_weapon("missiles")
	if w == null:
		return
	attacker.energy = maxf(0.0, attacker.energy - 3.0)
	w.lock_progress = minf(1.0, w.lock_progress + 0.5)
	_log("%s holds missile lock... %d%%." % [attacker.name, int(w.lock_progress * 100.0)])

func _do_fire_commit(action: Dictionary) -> bool:
	var w = attacker.get_weapon(action.get("weapon", ""))
	if w == null:
		return false
	if not w.can_fire(attacker.energy, attacker.overheated):
		_log("%s tries to fire %s — not ready!" % [attacker.name, w.name])
		return false
	var zone: String = action.get("zone", defender.weakest_zone())
	var acc: float = w.accuracy()
	if attacker.weapons_damaged and w.kind == "cannon":
		acc -= 0.20
	attacker.energy = maxf(0.0, attacker.energy - w.energy_cost)
	pending_attack = {
		"weapon": w, "zone": zone,
		"accuracy": clampf(acc, 0.05, 0.97),
		"damage": w.damage, "kind": w.kind,
	}
	intent_signal = _signal_for_attack(w, zone)
	_log("%s COMMITS: %s" % [attacker.name, intent_signal["text"]])
	return true

func _do_launch_commit(action: Dictionary) -> bool:
	var w = attacker.get_weapon("drones")
	if w == null or not w.can_fire(attacker.energy, attacker.overheated):
		_log("%s fails to launch drones." % attacker.name)
		return false
	if attacker.drones.size() >= 2:
		_log("%s drone bay already at capacity." % attacker.name)
		return false
	attacker.energy = maxf(0.0, attacker.energy - w.energy_cost)
	w.on_fired()
	pending_attack = {"weapon": w, "kind": "drone_launch", "zone": "", "accuracy": 1.0, "damage": 0.0}
	intent_signal = {"kind": "drone", "zone": "", "text": "Drone launch detected from %s!" % attacker.name}
	_log("%s COMMITS: %s" % [attacker.name, intent_signal["text"]])
	return true

func _signal_for_attack(w, zone: String) -> Dictionary:
	# What the defender is allowed to know.
	match w.kind:
		"cannon":
			return {"kind": "cannon", "zone": zone,
				"text": "Heavy ballistic impact predicted: %s!" % zone.to_upper()}
		"missile":
			return {"kind": "missile", "zone": "",
				"text": "Missile lock detected — impact zone UNKNOWN!"}
	return {"kind": "cannon", "zone": zone, "text": "Incoming fire: %s!" % zone.to_upper()}

# ---------------------------------------------------------- defender input --

func submit_defender_action(action: Dictionary) -> bool:
	if over or phase != PHASE_DEFENDER:
		return false
	var atype: String = action.get("type", "hold")
	pending_defense = action
	match atype:
		"cwis":
			_do_cwis()
		"shield":
			_do_shield(action.get("zone", "front"))
		"booster":
			_log("%s burns boosters — hard to hit!" % defender.name)
			defender.energy = maxf(0.0, defender.energy - 12.0)
		"brace":
			_log("%s braces for impact." % defender.name)
		"repair":
			_do_repair(action.get("zone", "front"))
		"recharge":
			defender.energy = minf(defender.energy_max, defender.energy + 15.0)
			_log("%s reroutes power (+15 energy)." % defender.name)
		"vent":
			defender.vent_heat()
			_log("%s vents heat (now %d)." % [defender.name, int(defender.heat)])
		_:
			_log("%s holds." % defender.name)
	_resolve_round()
	return true

func _do_cwis() -> void:
	var d = defender.get_defense("cwis")
	if d == null or not d.can_use(defender.energy, defender.weight_class):
		_log("%s CWIS fails to respond!" % defender.name)
		pending_defense = {"type": "brace"}
		return
	d.charges -= 1
	d.cooldown = 1
	defender.energy = maxf(0.0, defender.energy - d.energy_cost)
	_log("%s CWIS opens fire! (%d charges left)" % [defender.name, d.charges])

func _do_shield(zone: String) -> void:
	var d = defender.get_defense("shield")
	if d == null or not d.can_use(defender.energy, defender.weight_class):
		_log("%s shield fails to raise!" % defender.name)
		pending_defense = {"type": "brace"}
		return
	defender.energy = maxf(0.0, defender.energy - d.energy_cost)
	d.raise_shield(zone, round_num)
	_log("%s raises Aegis Veil over %s — perfect guard window!" % [defender.name, zone.to_upper()])

func _do_repair(zone: String) -> void:
	defender.energy = maxf(0.0, defender.energy - 6.0)
	var before: float = defender.hull[zone]
	defender.hull[zone] = minf(defender.hull_max[zone], defender.hull[zone] + 25.0)
	_log("%s patches %s hull (+%d)." % [defender.name, zone.to_upper(), int(defender.hull[zone] - before)])

# ---------------------------------------------------------------- resolve --

func _resolve_round() -> void:
	phase = PHASE_RESOLVE
	phase_changed.emit(phase)
	# Drones strike first (both sides).
	_drone_strikes(attacker, defender)
	_drone_strikes(defender, attacker)
	# Then the committed attack, if any.
	if not pending_attack.is_empty():
		if pending_attack["kind"] == "drone_launch":
			attacker.drones.append({"hp": 1, "dmg": 7.0, "acc": 0.85})
			_log("%s deploys a wasp drone!" % attacker.name)
		else:
			_resolve_attack(attacker, defender, pending_attack, pending_defense)
	# End-of-round upkeep.
	attacker.tick_round()
	defender.tick_round()
	_check_end_conditions()
	if not over:
		round_num += 1
		var tmp = attacker
		attacker = defender
		defender = tmp
		_begin_attacker_phase()

func _drone_strikes(owner, target) -> void:
	if owner.drones.is_empty() or not target.alive:
		return
	var d = owner.get_defense("cwis")
	for drone in owner.drones.duplicate():
		# CWIS on the TARGET side shoots drones down during resolve if it fired.
		var dead := false
		if target == defender and pending_defense.get("type") == "cwis" and randf() < 0.7:
			dead = true
		elif target == attacker:
			# attacker's own CWIS can't help here; skip
			pass
		if dead:
			owner.drones.erase(drone)
			_log("CWIS shreds one of %s's drones!" % owner.name)
			continue
		if randf() < drone["acc"]:
			var zone: String = ShipData.ZONES[randi() % 3]
			_apply_damage(target, zone, drone["dmg"], "drone")
		else:
			_log("%s's drone misses %s." % [owner.name, target.name])

func _resolve_attack(att, dfn, attack: Dictionary, defense: Dictionary) -> void:
	var w = attack["weapon"]
	var kind: String = attack["kind"]
	var zone: String = attack["zone"]
	var acc: float = attack["accuracy"]
	var dmg: float = attack["damage"]
	var dtype: String = defense.get("type", "brace")

	att.apply_heat(w.heat_gen)
	w.on_fired()

	# 1) CWIS interception vs missiles.
	if dtype == "cwis" and kind == "missile":
		var stopped := 0
		for i in w.shots_per_attack:
			if randf() < 0.7:
				stopped += 1
		if stopped >= w.shots_per_attack:
			_log("CWIS swats the whole missile volley out of the sky!")
			return
		elif stopped > 0:
			_log("CWIS intercepts %d of %d missiles!" % [stopped, w.shots_per_attack])
			dmg *= float(w.shots_per_attack - stopped) / float(w.shots_per_attack)

	# 2) Booster dodge (light ships only — heavies can't juke).
	if dtype == "booster":
		var dodge_chance := 0.45 if kind == "cannon" else 0.30
		if randf() < dodge_chance:
			_log("%s jukes clean — the attack misses entirely!" % dfn.name)
			return
		_log("%s's boosters can't shake the lock..." % dfn.name)

	# 3) Accuracy roll.
	if randf() > acc:
		_log("%s's %s misses the %s zone!" % [att.name, w.name, zone.to_upper()])
		return

	# 4) Shields (directional, perfect-guard decay).
	var sh = dfn.active_shield()
	if sh != null and sh.shield_zone == zone:
		var reduction: float = sh.perfect_guard_reduction(round_num)
		var absorbed: float = dmg * 0.4
		dfn.shield_hp = maxf(0.0, dfn.shield_hp - absorbed)
		dmg *= (1.0 - reduction)
		_log("Aegis Veil absorbs the blow (-%d%%, guard %s)." % [int(reduction * 100.0),
			"PERFECT" if reduction >= 0.7 else "fading"])
		if dfn.shield_hp <= 0.0:
			sh.lower_shield()
			_log("The Aegis Veil COLLAPSES!")
	elif sh != null:
		_log("The Veil guards %s — the %s zone is exposed!" % [sh.shield_zone.to_upper(), zone.to_upper()])

	# 5) Brace: small flat reduction.
	if dtype == "brace":
		dmg *= 0.9

	_apply_damage(dfn, zone, dmg, kind)

func _apply_damage(target, zone: String, dmg: float, kind: String) -> void:
	# Armor soaks a flat amount.
	dmg = maxf(2.0, dmg - target.armor)
	# Material properties.
	if target.material == "steel" and (kind == "cannon" or kind == "drone") and randf() < 0.30:
		dmg = minf(dmg, 6.0)
		_log("%s's steel hull DEFLECTS the hit!" % target.name)
	elif target.material == "wood":
		dmg *= 1.25
		if randf() < 0.25 and target.burning <= 0:
			target.burning = 2
			_log("%s's timber hull CATCHES FIRE!" % target.name)
	target.hull[zone] = maxf(0.0, target.hull[zone] - dmg)
	_log("%s takes %d to %s (%d left)." % [target.name, int(dmg), zone.to_upper(), int(target.hull[zone])])
	# Zone destruction: chain effects.
	if target.hull[zone] <= 0.0:
		_zone_destroyed(target, zone)
	if target.total_hull() <= 0.0:
		target.alive = false

func _zone_destroyed(target, zone: String) -> void:
	match zone:
		"front":
			if not target.weapons_damaged:
				target.weapons_damaged = true
				_log(">>> %s's FRONT is wrecked — weapon accuracy crippled!" % target.name)
		"side":
			target.speed = maxi(1, target.speed - 2)
			_log(">>> %s's SIDE is torn open — speed reduced!" % target.name)
		"rear":
			if not target.engine_damaged:
				target.engine_damaged = true
				_log(">>> %s's REAR is destroyed — engines crippled, no boosting!" % target.name)

# ------------------------------------------------------------------- ending --

func _ships_spent() -> bool:
	for s in [player, enemy]:
		var can_act := false
		for w in s.weapons:
			if w.ammo >= w.ammo_per_shot and s.energy >= w.energy_cost and not s.overheated:
				can_act = true
		if not s.drones.is_empty():
			can_act = true
		if can_act:
			return false
	return true

func _check_end_conditions() -> void:
	if not player.alive and not enemy.alive:
		_finish("DRAW", "mutual destruction")
	elif not player.alive:
		_finish(enemy.name, "ship destroyed")
	elif not enemy.alive:
		_finish(player.name, "ship destroyed")
	elif _ships_spent():
		_finish_by_attrition("both ships spent")
	elif round_num >= max_rounds:
		_finish_by_attrition("max rounds reached")

func _finish_by_attrition(reason: String) -> void:
	if player.total_hull() > enemy.total_hull():
		_finish(player.name, reason + " — sudden death")
	elif enemy.total_hull() > player.total_hull():
		_finish(enemy.name, reason + " — sudden death")
	else:
		_finish("DRAW", reason)

func _finish(winner: String, reason: String) -> void:
	over = true
	winner_name = winner
	win_reason = reason
	phase = PHASE_OVER
	_log("=== BATTLE OVER: %s wins (%s) ===" % [winner, reason])
	phase_changed.emit(phase)
	battle_finished.emit(winner, reason)

func _log(msg: String) -> void:
	battle_log.emit("[R%d] %s" % [round_num, msg])

# --------------------------------------------------------------- auto mode --

func auto_step_round(ai) -> void:
	"""Advance one full round with the AI controlling both sides."""
	if over:
		return
	var a_action: Dictionary = ai.choose_attacker_action(attacker, defender, self)
	submit_attacker_action(a_action)
	var d_action: Dictionary = ai.choose_defender_action(defender, attacker, intent_signal, self)
	submit_defender_action(d_action)
