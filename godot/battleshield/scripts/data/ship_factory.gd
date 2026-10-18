extends RefCounted
## Builds the two v1 combatants: the player's Sparrowhawk vs the AI Iron Boar.

const WeaponData = preload("res://scripts/data/weapon_data.gd")
const DefenseData = preload("res://scripts/data/defense_data.gd")
const ShipData = preload("res://scripts/data/ship_data.gd")

static func _mk_cannon(damage: float, ammo: int) -> RefCounted:
	var w = WeaponData.new()
	w.id = "cannon"
	w.name = "Stormcaller Deck Guns"
	w.kind = WeaponData.KIND_CANNON
	w.damage = damage
	w.prime_turns = 1
	w.ammo_per_shot = 1
	w.ammo = ammo
	w.energy_cost = 12
	w.heat_gen = 18.0
	w.base_accuracy = 0.60
	w.focus_bonus = 0.12
	return w

static func _mk_missiles(damage: float, ammo: int) -> RefCounted:
	var w = WeaponData.new()
	w.id = "missiles"
	w.name = "Skyhook Lock-On Missiles"
	w.kind = WeaponData.KIND_MISSILE
	w.damage = damage
	w.prime_turns = 0
	w.shots_per_attack = 2
	w.ammo_per_shot = 2
	w.ammo = ammo
	w.energy_cost = 10
	w.heat_gen = 12.0
	w.base_accuracy = 0.78
	return w

static func _mk_drones(ammo: int) -> RefCounted:
	var w = WeaponData.new()
	w.id = "drones"
	w.name = "Wasp Drone Bay"
	w.kind = WeaponData.KIND_DRONE
	w.damage = 7.0
	w.prime_turns = 1
	w.ammo_per_shot = 1
	w.ammo = ammo
	w.energy_cost = 14
	w.heat_gen = 10.0
	w.base_accuracy = 0.85
	return w

static func _mk_cwis(charges: int) -> RefCounted:
	var d = DefenseData.new()
	d.id = "cwis"
	d.name = "Flak Screen (CWIS)"
	d.kind = DefenseData.KIND_CWIS
	d.energy_cost = 8
	d.charges = charges
	d.max_charges = charges
	return d

static func _mk_shield() -> RefCounted:
	var d = DefenseData.new()
	d.id = "shield"
	d.name = "Aegis Veil (Shield)"
	d.kind = DefenseData.KIND_SHIELD
	d.energy_cost = 10
	return d

static func _mk_booster() -> RefCounted:
	var d = DefenseData.new()
	d.id = "booster"
	d.name = "Gust Boosters (Dodge)"
	d.kind = DefenseData.KIND_BOOSTER
	d.energy_cost = 12
	return d

static func make_player_ship() -> RefCounted:
	var s = ShipData.new()
	s.name = "Sparrowhawk"
	s.flavor = "Tribal-punk scout skiff, runescribed steel hull."
	s.speed = 9
	s.weight_class = "light"
	s.material = "steel"
	s.armor = 4.0
	s.shield_hp = 40.0
	s.shield_hp_max = 40.0
	s.energy = 60.0
	s.energy_max = 60.0
	s.weapons = [_mk_cannon(24.0, 12), _mk_missiles(16.0, 6), _mk_drones(4)]
	s.defenses = [_mk_cwis(5), _mk_shield(), _mk_booster()]
	return s

static func make_enemy_ship() -> RefCounted:
	var s = ShipData.new()
	s.name = "Iron Boar"
	s.flavor = "Heavy tribal gun-barge, lacquered timber armor."
	s.speed = 6
	s.weight_class = "heavy"
	s.material = "wood"
	s.armor = 7.0
	s.shield_hp = 55.0
	s.shield_hp_max = 55.0
	s.energy = 60.0
	s.energy_max = 60.0
	s.energy_regen = 22.0
	s.hull = {"front": 120.0, "side": 120.0, "rear": 120.0}
	s.hull_max = {"front": 120.0, "side": 120.0, "rear": 120.0}
	s.weapons = [_mk_cannon(30.0, 12), _mk_missiles(18.0, 6)]
	s.defenses = [_mk_cwis(4), _mk_shield()]
	return s
