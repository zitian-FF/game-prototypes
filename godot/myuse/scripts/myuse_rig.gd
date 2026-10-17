class_name MyuseRig
extends Node2D
## Procedural "bone" rig for Myuse.
##
## Builds a Node2D joint hierarchy with drawn body parts (no imported art),
## then poses it every physics frame from an animation state sent by the player.
## Swap the drawing helpers for your own sprites later; the joint names and
## the animate() contract stay the same.

const HAIR := Color(0.46, 0.23, 0.78)
const HAIR_DARK := Color(0.33, 0.15, 0.60)
const SKIN := Color(1.0, 0.87, 0.78)
const SUIT := Color(0.93, 0.93, 0.96)
const SUIT_DARK := Color(0.70, 0.70, 0.78)
const DARK := Color(0.15, 0.12, 0.22)

# Pivots. spinner rotates around the center of mass (used for the mid-air
# spin); offset pivots at the feet (used for lean, bob and squash recovery).
var spinner: Node2D
var offset: Node2D
# Named joints: hip_n, hip_f, knee_n, knee_f, chest, head,
#                sh_n, sh_f, el_n, el_f, hair_back
var j := {}

var _t := 0.0
var _run_phase := 0.0


func _ready() -> void:
	spinner = Node2D.new()
	spinner.name = "Spinner"
	spinner.position = Vector2(0, -90)
	add_child(spinner)

	offset = Node2D.new()
	offset.name = "Offset"
	offset.position = Vector2(0, 90)
	spinner.add_child(offset)

	_build_legs()
	_build_torso()
	_build_head()
	_build_arms()
	_build_hair_back()


# ---------------------------------------------------------------- build helpers

func _circle(r: float, color: Color, segments: int = 18) -> Polygon2D:
	var pts := PackedVector2Array()
	for i in segments:
		var a := TAU * float(i) / float(segments)
		pts.append(Vector2(cos(a), sin(a)) * r)
	var p := Polygon2D.new()
	p.polygon = pts
	p.color = color
	return p


func _limb(length: float, width: float, color: Color) -> Line2D:
	# A capsule drawn as a thick line; pivot stays at the joint (top).
	var l := Line2D.new()
	l.points = PackedVector2Array([Vector2.ZERO, Vector2(0, length)])
	l.width = width
	l.default_color = color
	l.begin_cap_mode = Line2D.LINE_CAP_ROUND
	l.end_cap_mode = Line2D.LINE_CAP_ROUND
	l.antialiased = true
	return l


func _poly(points: Array, color: Color) -> Polygon2D:
	var p := Polygon2D.new()
	p.polygon = PackedVector2Array(points)
	p.color = color
	return p


func _joint(parent: Node, node_name: String, pos: Vector2, z: int = 0) -> Node2D:
	var n := Node2D.new()
	n.name = node_name
	n.position = pos
	n.z_index = z
	parent.add_child(n)
	j[node_name] = n
	return n


# ------------------------------------------------------------------ body parts

func _build_legs() -> void:
	# Feet at y=0. Hip joints at y=-92, thigh 46 + shin 46.
	for side in ["n", "f"]:
		var x := 5.0 if side == "n" else -5.0
		var z := 0 if side == "n" else -2
		var hip := _joint(offset, "hip_" + side, Vector2(x, -92), z)
		var thigh := _limb(46.0, 20.0, SUIT)
		hip.add_child(thigh)
		var knee := _joint(hip, "knee_" + side, Vector2(0, 46))
		var shin := _limb(46.0, 15.0, SKIN)
		knee.add_child(shin)
		# Bare foot pointing forward (+x, we face right).
		var foot := _poly([Vector2(-7, 0), Vector2(16, 0), Vector2(16, 7), Vector2(-7, 7)], SKIN)
		foot.position = Vector2(0, 46)
		knee.add_child(foot)


func _build_torso() -> void:
	var torso := _poly(
		[Vector2(-12, 6), Vector2(12, 6), Vector2(9, -54), Vector2(-9, -54)],
		SUIT
	)
	torso.position = Vector2(0, -92)
	torso.z_index = -1
	offset.add_child(torso)
	# Suit side shading.
	var shade := _poly(
		[Vector2(6, 2), Vector2(12, 6), Vector2(9, -54), Vector2(5, -50)],
		SUIT_DARK
	)
	shade.position = Vector2(0, -92)
	shade.z_index = 0
	offset.add_child(shade)
	_joint(offset, "chest", Vector2(0, -142))


func _build_head() -> void:
	var chest: Node2D = j["chest"]
	var head := _joint(chest, "head", Vector2(0, -20), 1)
	var face := _circle(15.0, SKIN)
	head.add_child(face)
	# Closed, content eye (side view, facing right).
	var eye := Line2D.new()
	eye.points = PackedVector2Array([Vector2(4, -3), Vector2(11, -3)])
	eye.width = 2.0
	eye.default_color = DARK
	eye.begin_cap_mode = Line2D.LINE_CAP_ROUND
	eye.end_cap_mode = Line2D.LINE_CAP_ROUND
	eye.z_index = 2
	head.add_child(eye)
	# Choker.
	var choker := Line2D.new()
	choker.points = PackedVector2Array([Vector2(-9, 11), Vector2(9, 11)])
	choker.width = 5.0
	choker.default_color = DARK
	choker.z_index = 2
	head.add_child(choker)
	# Fringe.
	var fringe := _poly(
		[Vector2(-14, -8), Vector2(-14, -16), Vector2(-6, -20), Vector2(0, -13),
			Vector2(6, -20), Vector2(14, -16), Vector2(14, -8), Vector2(6, -11),
			Vector2(0, -8), Vector2(-6, -11)],
		HAIR
	)
	fringe.z_index = 2
	head.add_child(fringe)
	# Ahoge (cowlick).
	var ahoge := Line2D.new()
	ahoge.points = PackedVector2Array([Vector2(0, -15), Vector2(5, -25), Vector2(12, -27)])
	ahoge.width = 3.0
	ahoge.default_color = HAIR_DARK
	ahoge.begin_cap_mode = Line2D.LINE_CAP_ROUND
	ahoge.end_cap_mode = Line2D.LINE_CAP_ROUND
	ahoge.z_index = 2
	head.add_child(ahoge)


func _build_arms() -> void:
	var chest: Node2D = j["chest"]
	for side in ["n", "f"]:
		var x := 11.0 if side == "n" else -11.0
		var z := 0 if side == "n" else -2
		var sh := _joint(chest, "sh_" + side, Vector2(x, -4), z)
		# Detached sleeve: white upper arm.
		sh.add_child(_limb(30.0, 14.0, SUIT))
		var el := _joint(sh, "el_" + side, Vector2(0, 30))
		el.add_child(_limb(28.0, 11.0, SKIN))
		var hand := _circle(5.5, SKIN, 12)
		hand.position = Vector2(0, 29)
		el.add_child(hand)


func _build_hair_back() -> void:
	# Long back hair flowing behind (we face right, hair trails left).
	# Drawn relative to `offset` so it can sway independently of the head.
	var mass := _poly(
		[Vector2(-6, -178), Vector2(-30, -172), Vector2(-52, -152),
			Vector2(-66, -120), Vector2(-74, -80), Vector2(-76, -40),
			Vector2(-68, -8), Vector2(-54, -2), Vector2(-58, -40),
			Vector2(-50, -80), Vector2(-38, -118), Vector2(-24, -148),
			Vector2(-10, -166)],
		HAIR
	)
	mass.z_index = -3
	offset.add_child(mass)
	var strand := _poly(
		[Vector2(-2, -176), Vector2(-18, -168), Vector2(-34, -148),
			Vector2(-44, -116), Vector2(-48, -80), Vector2(-44, -48),
			Vector2(-36, -44), Vector2(-38, -80), Vector2(-30, -114),
			Vector2(-18, -142), Vector2(-6, -160)],
		HAIR_DARK
	)
	strand.z_index = -3
	offset.add_child(strand)
	j["hair_back"] = mass
	j["hair_strand"] = strand


# ------------------------------------------------------------------ animation

## Pose the rig. Called every physics frame by the player.
## state: &"idle" | &"run" | &"jump" | &"land"
## extra: {"air": 0..1} for jump, {"k": 0..1} for land.
func animate(state: StringName, dt: float, extra: Dictionary) -> void:
	_t += dt
	match state:
		&"idle":
			_animate_idle()
		&"run":
			_animate_run(dt)
		&"jump":
			_animate_jump(float(extra.get("air", 0.0)))
		&"land":
			_animate_land(float(extra.get("k", 0.0)))


func _reset_transforms() -> void:
	spinner.rotation = 0.0
	spinner.scale = Vector2.ONE
	offset.rotation = 0.0
	offset.position = Vector2(0, 90)


func _animate_idle() -> void:
	_reset_transforms()
	var b := sin(_t * 2.2) # breathing
	offset.position.y = 90.0 + b * 1.5
	j["chest"].position.y = -142.0 + b * 1.2
	j["head"].rotation = sin(_t * 1.3) * 0.06
	j["hair_back"].rotation = sin(_t * 1.7) * 0.07
	j["hair_strand"].rotation = sin(_t * 1.7 + 0.8) * 0.09
	j["sh_n"].rotation = 0.07 + b * 0.05
	j["sh_f"].rotation = 0.07 - b * 0.05
	j["el_n"].rotation = 0.18
	j["el_f"].rotation = 0.18
	j["hip_n"].rotation = 0.0
	j["hip_f"].rotation = 0.0
	j["knee_n"].rotation = 0.06
	j["knee_f"].rotation = 0.06


func _animate_run(dt: float) -> void:
	_reset_transforms()
	_run_phase += dt * 11.0
	var ph := _run_phase
	var swing := sin(ph)
	# Legs: opposite phase, knees bend on the swing-through.
	j["hip_n"].rotation = swing * 0.70
	j["hip_f"].rotation = -swing * 0.70
	j["knee_n"].rotation = 0.25 + maxf(0.0, sin(ph - 1.1)) * 1.25
	j["knee_f"].rotation = 0.25 + maxf(0.0, sin(ph + PI - 1.1)) * 1.25
	# Arms counter-swing, elbows bent.
	j["sh_n"].rotation = -swing * 0.55 + 0.10
	j["sh_f"].rotation = swing * 0.55 + 0.10
	j["el_n"].rotation = 0.55 + maxf(0.0, -swing) * 0.35
	j["el_f"].rotation = 0.55 + maxf(0.0, swing) * 0.35
	# Forward lean + vertical bob (two bounces per stride).
	offset.rotation = 0.12
	offset.position.y = 90.0 - absf(cos(ph)) * 5.0
	j["chest"].position.y = -142.0
	j["head"].rotation = -0.10
	j["hair_back"].rotation = -0.28 + sin(ph * 2.0) * 0.10
	j["hair_strand"].rotation = -0.30 + sin(ph * 2.0 + 0.9) * 0.12


func _animate_jump(air: float) -> void:
	# Full forward flip over the course of the jump. (Y-down: negative = CCW.)
	spinner.rotation = -TAU * air
	spinner.scale = Vector2.ONE
	offset.rotation = 0.0
	offset.position = Vector2(0, 90)
	# Tucked limbs.
	j["hip_n"].rotation = -0.85
	j["hip_f"].rotation = -0.70
	j["knee_n"].rotation = 1.70
	j["knee_f"].rotation = 1.55
	j["sh_n"].rotation = -0.35
	j["sh_f"].rotation = -0.30
	j["el_n"].rotation = 1.25
	j["el_f"].rotation = 1.25
	j["chest"].position.y = -142.0
	j["head"].rotation = 0.15
	# Hair whips with the spin.
	j["hair_back"].rotation = 0.45 * sin(air * TAU)
	j["hair_strand"].rotation = 0.55 * sin(air * TAU + 0.6)


func _animate_land(k: float) -> void:
	# k: 0 -> 1 across the landing. Squash and recover.
	spinner.rotation = 0.0
	var sq := sin(k * PI)
	spinner.scale = Vector2(1.0 + 0.16 * sq, 1.0 - 0.20 * sq)
	offset.rotation = 0.0
	offset.position = Vector2(0, 90)
	j["hip_n"].rotation = -0.45 * sq
	j["hip_f"].rotation = -0.40 * sq
	j["knee_n"].rotation = 0.06 + 0.95 * sq
	j["knee_f"].rotation = 0.06 + 0.90 * sq
	# Arms out for balance.
	j["sh_n"].rotation = 0.10 + 0.45 * sq
	j["sh_f"].rotation = 0.10 - 0.45 * sq
	j["el_n"].rotation = 0.18 + 0.25 * sq
	j["el_f"].rotation = 0.18 + 0.25 * sq
	j["chest"].position.y = -142.0
	j["head"].rotation = 0.05 * sq
	j["hair_back"].rotation = -0.15 * sq
	j["hair_strand"].rotation = -0.18 * sq
