extends RefCounted
## A combatant airship: stats, resources, systems, and battle state.

const ZONES := ["front", "side", "rear"]

var name: String = "Airship"
var flavor: String = ""
var speed: int = 5
var weight_class: String = "light"   # "light" | "heavy"
var material: String = "steel"       # "wood" | "steel"

# Resources
var hull := {"front": 100.0, "side": 100.0, "rear": 100.0}
var hull_max := {"front": 100.0, "side": 100.0, "rear": 100.0}
var armor: float = 4.0
var shield_hp: float = 40.0
var shield_hp_max: float = 40.0
var energy: float = 60.0
var energy_max: float = 60.0
var energy_regen: float = 18.0
var heat: float = 0.0
var heat_max: float = 100.0
var overheated: bool = false

var weapons: Array = []    # Array[WeaponData]
var defenses: Array = []   # Array[DefenseData]
var drones: Array = []     # Array of Dictionaries: {"hp": int, "owner": ShipData}

var burning: int = 0       # wood: turns of fire damage remaining
var engine_damaged: bool = false   # rear zone destroyed
var weapons_damaged: bool = false  # front zone destroyed
var alive: bool = true

func total_hull() -> float:
	return hull["front"] + hull["side"] + hull["rear"]

func total_hull_max() -> float:
	return hull_max["front"] + hull_max["side"] + hull_max["rear"]

func weakest_zone() -> String:
	var z := "front"
	for zone in ZONES:
		if hull[zone] < hull[z]:
			z = zone
	return z

func get_weapon(wid: String):
	for w in weapons:
		if w.id == wid:
			return w
	return null

func get_defense(did: String):
	for d in defenses:
		if d.id == did:
			return d
	return null

func has_booster() -> bool:
	return get_defense("booster") != null

func active_shield():
	for d in defenses:
		if d.kind == "shield" and d.shield_active:
			return d
	return null

func tick_round() -> void:
	energy = minf(energy_max, energy + energy_regen * (0.5 if engine_damaged else 1.0))
	for w in weapons:
		w.tick_round()
	for d in defenses:
		if d.cooldown > 0:
			d.cooldown -= 1
	if burning > 0:
		burning -= 1
		for zone in ZONES:
			hull[zone] = maxf(0.0, hull[zone] - 3.0)
		if total_hull() <= 0.0:
			alive = false

func apply_heat(amount: float) -> void:
	heat = minf(heat_max, heat + amount)
	if heat >= heat_max and not overheated:
		overheated = true

func vent_heat() -> void:
	heat = maxf(0.0, heat - 45.0)
	if heat < heat_max * 0.5:
		overheated = false
