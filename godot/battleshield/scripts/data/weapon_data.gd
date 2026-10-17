extends RefCounted
## Data + runtime state for one weapon system.
## Kinds: "cannon" (manual aim, focus improves accuracy),
##         "missile" (needs lock-on hold before firing),
##         "drone" (launches fighters that persist and can be shot down).

const KIND_CANNON := "cannon"
const KIND_MISSILE := "missile"
const KIND_DRONE := "drone"

var id: String = ""
var name: String = ""
var kind: String = KIND_CANNON
var damage: float = 10.0
var prime_turns: int = 0          # attacker turns of setup before first use
var shots_per_attack: int = 1    # missiles fire a small volley
var ammo_per_shot: int = 1
var energy_cost: int = 10
var heat_gen: float = 10.0
var base_accuracy: float = 0.7
var focus_bonus: float = 0.12     # accuracy gained per focus turn (cannon)
var max_focus: int = 3

# Runtime state
var ammo: int = 0
var prime_progress: int = 0
var primed: bool = false
var focus_turns: int = 0
var cooldown: int = 0
var lock_progress: float = 0.0    # 0..1, missiles only

func needs_priming() -> bool:
	return prime_turns > 0 and not primed

func prime_tick() -> bool:
	"""Advance priming by one attacker turn. Returns true when priming completes."""
	if primed:
		return true
	prime_progress += 1
	if prime_progress >= prime_turns:
		primed = true
	return primed

func can_fire(ship_energy: float, ship_overheated: bool) -> bool:
	if ship_overheated:
		return false
	if cooldown > 0:
		return false
	if ammo < ammo_per_shot:
		return false
	if ship_energy < energy_cost:
		return false
	if needs_priming():
		return false
	if kind == KIND_MISSILE and lock_progress < 0.5:
		return false
	return true

func accuracy() -> float:
	var acc := base_accuracy
	if kind == KIND_CANNON:
		acc += focus_turns * focus_bonus
	if kind == KIND_MISSILE:
		# partial lock = shaky shot, full lock = true accuracy
		acc *= 0.55 + 0.45 * lock_progress
	return clampf(acc, 0.05, 0.97)

func status_text() -> String:
	if ammo < ammo_per_shot:
		return "OUT OF AMMO"
	if cooldown > 0:
		return "COOLDOWN %d" % cooldown
	if needs_priming():
		return "PRIMING %d/%d" % [prime_progress, prime_turns]
	if kind == KIND_MISSILE and lock_progress < 0.5:
		return "NO LOCK"
	return "READY"

func on_fired() -> void:
	ammo -= ammo_per_shot
	focus_turns = 0
	lock_progress = 0.0
	cooldown = 1 if kind == KIND_CANNON else 0

func tick_round() -> void:
	if cooldown > 0:
		cooldown -= 1
