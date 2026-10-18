extends RefCounted
## Data + runtime state for one defensive system.
## Kinds: "cwis" (shoot down missiles/drones, limited charges),
##         "shield" (directional barrier, perfect guard decays while held),
##         "booster" (dodge maneuver, light ships only).

const KIND_CWIS := "cwis"
const KIND_SHIELD := "shield"
const KIND_BOOSTER := "booster"

var id: String = ""
var name: String = ""
var kind: String = KIND_CWIS
var energy_cost: int = 8
var charges: int = 0        # cwis only
var max_charges: int = 0
var cooldown: int = 0

# Shield runtime state
var shield_zone: String = ""        # "front" | "side" | "rear"
var shield_raised_round: int = -999
var shield_active: bool = false

func can_use(ship_energy: float, ship_weight: String) -> bool:
	if cooldown > 0:
		return false
	if ship_energy < energy_cost:
		return false
	if kind == KIND_CWIS and charges <= 0:
		return false
	if kind == KIND_BOOSTER and ship_weight != "light":
		return false
	return true

func perfect_guard_reduction(current_round: int) -> float:
	"""75% reduction on a fresh raise, decaying 15% per round held (min 25%)."""
	if not shield_active:
		return 0.0
	var held: int = current_round - shield_raised_round
	return maxf(0.25, 0.75 - 0.15 * float(held))

func raise_shield(zone: String, current_round: int) -> void:
	shield_zone = zone
	shield_raised_round = current_round
	shield_active = true

func lower_shield() -> void:
	shield_active = false
	shield_zone = ""

func status_text() -> String:
	if cooldown > 0:
		return "COOLDOWN %d" % cooldown
	if kind == KIND_CWIS:
		return "CHARGES %d/%d" % [charges, max_charges] if charges > 0 else "DEPLETED"
	if kind == KIND_SHIELD:
		return "GUARDING %s" % shield_zone.to_upper() if shield_active else "READY"
	return "READY"
