extends Node2D
## Scene assembly: background, ground, player, camera, state label.
## Run with `-- --capture` to dump verification screenshots.

const W := 1280.0
const H := 720.0
const GROUND_Y := 560.0


func _ready() -> void:
	_build_background()
	_build_ground()
	_build_label()
	_build_player()
	_build_camera()
	if "--capture" in OS.get_cmdline_user_args():
		var cap = load("res://scripts/capture.gd").new()
		add_child(cap)


func _circle_poly(center: Vector2, r: float, segments: int = 32) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in segments:
		var a := TAU * float(i) / float(segments)
		pts.append(center + Vector2(cos(a), sin(a)) * r)
	return pts


func _build_background() -> void:
	var sky := ColorRect.new()
	sky.color = Color(0.07, 0.05, 0.14)
	sky.position = Vector2.ZERO
	sky.size = Vector2(W, H)
	sky.z_index = -100
	add_child(sky)

	# Moon.
	var moon := Polygon2D.new()
	moon.polygon = _circle_poly(Vector2(1050, 140), 55)
	moon.color = Color(0.92, 0.90, 0.80, 0.9)
	moon.z_index = -99
	add_child(moon)

	# Stars.
	var rng := RandomNumberGenerator.new()
	rng.seed = 1234
	for i in 70:
		var s := Polygon2D.new()
		var r := rng.randf_range(1.0, 2.4)
		s.polygon = _circle_poly(Vector2(rng.randf_range(0, W), rng.randf_range(0, 420)), r, 6)
		s.color = Color(1, 1, 1, rng.randf_range(0.25, 0.8))
		s.z_index = -99
		add_child(s)

	# Distant hills.
	var hills := Polygon2D.new()
	hills.polygon = PackedVector2Array([
		Vector2(0, GROUND_Y), Vector2(220, 470), Vector2(480, GROUND_Y),
		Vector2(700, 490), Vector2(980, GROUND_Y), Vector2(1280, 500),
		Vector2(1280, GROUND_Y),
	])
	hills.color = Color(0.10, 0.09, 0.20)
	hills.z_index = -98
	add_child(hills)


func _build_ground() -> void:
	var g := Polygon2D.new()
	g.polygon = PackedVector2Array([
		Vector2(0, GROUND_Y), Vector2(W, GROUND_Y),
		Vector2(W, H), Vector2(0, H),
	])
	g.color = Color(0.13, 0.17, 0.13)
	g.z_index = -50
	add_child(g)
	# Grass lip.
	var lip := Polygon2D.new()
	lip.polygon = PackedVector2Array([
		Vector2(0, GROUND_Y), Vector2(W, GROUND_Y),
		Vector2(W, GROUND_Y + 10), Vector2(0, GROUND_Y + 10),
	])
	lip.color = Color(0.20, 0.30, 0.18)
	lip.z_index = -49
	add_child(lip)

	var body := StaticBody2D.new()
	var shape := CollisionShape2D.new()
	var line := WorldBoundaryShape2D.new()
	line.normal = Vector2(0, -1)
	line.distance = -GROUND_Y
	shape.shape = line
	body.add_child(shape)
	add_child(body)


func _build_player() -> void:
	var player = load("res://scripts/player.gd").new()
	player.name = "Player"
	player.position = Vector2(140, GROUND_Y - 1)
	add_child(player)


func _build_camera() -> void:
	var cam := Camera2D.new()
	cam.position = Vector2(W / 2, H / 2)
	cam.enabled = true
	add_child(cam)


func _build_label() -> void:
	var label := Label.new()
	label.name = "StateLabel"
	label.position = Vector2(16, 12)
	label.add_theme_font_size_override("font_size", 30)
	label.add_theme_color_override("font_color", Color(1, 1, 1, 0.85))
	label.text = "state: IDLE"
	label.z_index = 100
	add_child(label)
