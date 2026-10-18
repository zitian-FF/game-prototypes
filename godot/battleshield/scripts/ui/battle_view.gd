extends Node2D
## Code-drawn battle scene: two airships facing off, projectile tracers,
## shield shimmer, damage flashes, and fire effects. Pure _draw, no assets.

var engine = null  # CombatEngine, set by main.gd

var _projectiles: Array = []   # {"from":Vector2,"to":Vector2,"t":float,"dur":float,"color":Color}
var _flashes: Array = []       # {"pos":Vector2,"t":float,"dur":float}
var _time := 0.0

const PLAYER_POS := Vector2(300, 330)
const ENEMY_POS := Vector2(980, 330)

func _ready() -> void:
	set_process(true)

func _process(delta: float) -> void:
	_time += delta
	var dirty := false
	for p in _projectiles:
		p["t"] += delta
		dirty = true
	_projectiles = _projectiles.filter(func(p): return p["t"] < p["dur"])
	for f in _flashes:
		f["t"] += delta
		dirty = true
	_flashes = _flashes.filter(func(f): return f["t"] < f["dur"])
	if dirty or _time < 100000.0:
		queue_redraw()

func fire_tracer(from_player: bool, kind: String) -> void:
	var a := PLAYER_POS if from_player else ENEMY_POS
	var b := ENEMY_POS if from_player else PLAYER_POS
	var col := Color(1.0, 0.8, 0.3)
	match kind:
		"missile": col = Color(1.0, 0.4, 0.2)
		"drone": col = Color(0.6, 1.0, 0.6)
	_projectiles.append({"from": a, "to": b, "t": 0.0, "dur": 0.45, "color": col})

func flash_zone(is_player: bool, zone: String) -> void:
	var base := PLAYER_POS if is_player else ENEMY_POS
	var facing := 1.0 if is_player else -1.0
	var off := Vector2.ZERO
	match zone:
		"front": off = Vector2(70 * facing, 10)
		"rear": off = Vector2(-70 * facing, 10)
		"side": off = Vector2(0, -55)
	_flashes.append({"pos": base + off, "t": 0.0, "dur": 0.5})

func _draw() -> void:
	_draw_sky()
	if engine != null and engine.player != null:
		_draw_ship(PLAYER_POS, true, engine.player)
	if engine != null and engine.enemy != null:
		_draw_ship(ENEMY_POS, false, engine.enemy)
	for p in _projectiles:
		var t: float = clampf(p["t"] / p["dur"], 0.0, 1.0)
		var pos: Vector2 = p["from"].lerp(p["to"], t)
		draw_circle(pos, 6.0, p["color"])
		draw_circle(pos, 10.0, Color(p["color"], 0.35))
	for f in _flashes:
		var t: float = 1.0 - f["t"] / f["dur"]
		draw_circle(f["pos"], 34.0 * t + 8.0, Color(1.0, 0.3, 0.1, 0.55 * t))

func _draw_sky() -> void:
	# Tribal-punk dusk: gradient bands + drifting rune motes.
	var bands := [Color(0.10, 0.08, 0.16), Color(0.16, 0.10, 0.20), Color(0.24, 0.14, 0.22)]
	for i in 3:
		draw_rect(Rect2(0, i * 240, 1280, 240), bands[i])
	for i in 26:
		var x := fmod(float(i * 197 + 40), 1280.0)
		var y := fmod(float(i * 131 + 90), 700.0)
		var tw := 0.25 + 0.25 * sin(_time * 2.0 + float(i))
		draw_circle(Vector2(x, y), 2.0, Color(1.0, 0.75, 0.4, tw))
	# Distant mesas.
	draw_polygon(PackedVector2Array([Vector2(0, 620), Vector2(180, 480), Vector2(360, 620)]), PackedColorArray([Color(0.13, 0.09, 0.16)]))
	draw_polygon(PackedVector2Array([Vector2(920, 620), Vector2(1120, 470), Vector2(1280, 620)]), PackedColorArray([Color(0.13, 0.09, 0.16)]))
	draw_rect(Rect2(0, 620, 1280, 100), Color(0.08, 0.06, 0.11))

func _draw_ship(pos: Vector2, faces_right: bool, ship) -> void:
	var f := 1.0 if faces_right else -1.0
	var dmg_ratio: float = 1.0 - ship.total_hull() / ship.total_hull_max()
	var hull_col := Color(0.55, 0.42, 0.30).lerp(Color(0.25, 0.18, 0.15), dmg_ratio)
	var balloon_col := Color(0.75, 0.30, 0.22) if ship.material == "wood" \
		else Color(0.35, 0.45, 0.60)
	if ship.material == "wood":
		balloon_col = Color(0.72, 0.42, 0.20)
	# Balloon.
	var bob := sin(_time * 1.6 + (0.0 if faces_right else 2.0)) * 6.0
	var bc := pos + Vector2(0, -70 + bob)
	draw_ellipse(bc, 95, 58, balloon_col)
	draw_ellipse(bc + Vector2(0, -12), 70, 38, balloon_col.lightened(0.18))
	# Tribal markings.
	for i in 3:
		var mx := bc.x - 45 + i * 45
		draw_line(Vector2(mx, bc.y - 40), Vector2(mx, bc.y + 40), Color(0.12, 0.08, 0.10, 0.6), 3.0)
	# Gondola.
	var gp := pos + Vector2(0, 10)
	draw_rect(Rect2(gp.x - 70, gp.y - 14, 140, 30), hull_col)
	draw_rect(Rect2(gp.x - 70, gp.y - 14, 140, 8), hull_col.lightened(0.15))
	# Front / rear markers: glowing runes show zone damage.
	_draw_zone_rune(gp + Vector2(55 * f, 2), ship.hull["front"] / ship.hull_max["front"])
	_draw_zone_rune(gp + Vector2(0, 2), ship.hull["side"] / ship.hull_max["side"])
	_draw_zone_rune(gp + Vector2(-55 * f, 2), ship.hull["rear"] / ship.hull_max["rear"])
	# Ropes.
	draw_line(bc + Vector2(-50, 40), gp + Vector2(-50, -14), Color(0.2, 0.15, 0.12), 2.0)
	draw_line(bc + Vector2(50, 40), gp + Vector2(50, -14), Color(0.2, 0.15, 0.12), 2.0)
	# Rear propeller.
	var pp := gp + Vector2(-85 * f, 0)
	var spin := _time * 9.0
	draw_line(pp + Vector2(0, -16).rotated(spin), pp + Vector2(0, 16).rotated(spin), Color(0.8, 0.8, 0.85, 0.8), 4.0)
	draw_circle(pp, 4.0, Color(0.3, 0.3, 0.35))
	# Shield shimmer on guarded zone.
	var sh = ship.active_shield()
	if sh != null:
		var soff := Vector2.ZERO
		match sh.shield_zone:
			"front": soff = Vector2(70 * f, 0)
			"rear": soff = Vector2(-70 * f, 0)
			"side": soff = Vector2(0, -60)
		var pulse := 0.45 + 0.25 * sin(_time * 6.0)
		draw_arc(gp + soff, 46.0, 0, TAU, 24, Color(0.4, 0.8, 1.0, pulse), 4.0)
	# Burning (wood).
	if ship.burning > 0:
		for i in 4:
			var fp := gp + Vector2(randf_range(-50, 50), -20 - randf_range(0, 25))
			draw_circle(fp, 7.0 + 3.0 * sin(_time * 12.0 + float(i)), Color(1.0, 0.45, 0.1, 0.8))
	# Drones buzzing around.
	for i in ship.drones.size():
		var dp := gp + Vector2(cos(_time * 3.0 + float(i) * 2.1) * 90.0, -40 + sin(_time * 4.0 + float(i)) * 1.0)
		draw_circle(dp, 5.0, Color(0.6, 1.0, 0.6))
	# Name plate.
	draw_string(ThemeDB.fallback_font, gp + Vector2(-60, 44), ship.name,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1, 1, 1, 0.9))

func _draw_zone_rune(p: Vector2, ratio: float) -> void:
	var col := Color(0.4, 1.0, 0.5).lerp(Color(1.0, 0.2, 0.1), 1.0 - ratio)
	draw_circle(p, 8.0, Color(col, 0.9))
	draw_circle(p, 11.0, Color(col, 0.3))

func draw_ellipse(center: Vector2, rx: float, ry: float, col: Color) -> void:
	# draw_circle can't ellipse; approximate with a polygon.
	var pts := PackedVector2Array()
	for i in 25:
		var a := TAU * float(i) / 24.0
		pts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
	draw_colored_polygon(pts, col)
