class_name MyusePlayer
extends CharacterBody2D
## Player controller + animation state machine.
##
## AUTO_DEMO plays the full loop hands-free:
##   idle (1.6s) -> run (1.8s) -> jump with 360 spin -> land (0.45s) -> idle ...
## Set AUTO_DEMO = false for manual control:
##   A/D or arrows to run, Space to jump-spin.

const AUTO_DEMO := true
const RUN_SPEED := 230.0
const JUMP_VEL := -680.0
const GRAVITY := 1500.0
const IDLE_TIME := 1.6
const RUN_TIME := 1.8
const LAND_TIME := 0.45
const WRAP_X := 1150.0
const START_X := 100.0

enum S { IDLE, RUN, JUMP, LAND }

var state: int = S.IDLE
var state_t := 0.0
var air_total := 1.0
var rig: Node2D
var state_label: Label


func _ready() -> void:
	var shape := CollisionShape2D.new()
	var capsule := CapsuleShape2D.new()
	capsule.radius = 16.0
	capsule.height = 110.0
	shape.shape = capsule
	shape.position = Vector2(0, -55)
	add_child(shape)

	rig = load("res://scripts/myuse_rig.gd").new()
	add_child(rig)

	state_label = get_tree().current_scene.get_node_or_null("StateLabel") as Label
	_update_label()


func _to(s: int) -> void:
	state = s
	state_t = 0.0
	_update_label()


func _update_label() -> void:
	if state_label:
		state_label.text = "state: " + S.keys()[state]


func _physics_process(dt: float) -> void:
	state_t += dt
	if AUTO_DEMO:
		_auto(dt)
	else:
		_manual(dt)


func _auto(dt: float) -> void:
	match state:
		S.IDLE:
			velocity.x = 0.0
			velocity.y += GRAVITY * dt
			move_and_slide()
			rig.animate(&"idle", dt, {})
			if state_t >= IDLE_TIME:
				_to(S.RUN)
		S.RUN:
			velocity.x = RUN_SPEED
			velocity.y += GRAVITY * dt
			move_and_slide()
			if position.x > WRAP_X:
				position.x = START_X
			rig.animate(&"run", dt, {})
			if state_t >= RUN_TIME:
				velocity.y = JUMP_VEL
				air_total = 2.0 * absf(JUMP_VEL) / GRAVITY
				_to(S.JUMP)
		S.JUMP:
			velocity.y += GRAVITY * dt
			velocity.x = RUN_SPEED * 0.85
			move_and_slide()
			var air := clampf(state_t / air_total, 0.0, 1.0)
			rig.animate(&"jump", dt, {"air": air})
			if is_on_floor() and state_t > 0.2:
				_to(S.LAND)
		S.LAND:
			velocity.x = 0.0
			velocity.y += GRAVITY * dt
			move_and_slide()
			rig.animate(&"land", dt, {"k": clampf(state_t / LAND_TIME, 0.0, 1.0)})
			if state_t >= LAND_TIME:
				_to(S.IDLE)


func _manual(dt: float) -> void:
	var dir := Input.get_axis("ui_left", "ui_right")
	velocity.y += GRAVITY * dt
	match state:
		S.IDLE, S.RUN:
			velocity.x = dir * RUN_SPEED
			move_and_slide()
			if Input.is_action_just_pressed("ui_accept") and is_on_floor():
				velocity.y = JUMP_VEL
				air_total = 2.0 * absf(JUMP_VEL) / GRAVITY
				_to(S.JUMP)
			elif dir != 0.0:
				if state != S.RUN:
					_to(S.RUN)
				rig.animate(&"run", dt, {})
			else:
				if state != S.IDLE:
					_to(S.IDLE)
				rig.animate(&"idle", dt, {})
		S.JUMP:
			velocity.x = dir * RUN_SPEED
			move_and_slide()
			rig.animate(&"jump", dt, {"air": clampf(state_t / air_total, 0.0, 1.0)})
			if is_on_floor() and state_t > 0.2:
				_to(S.LAND)
		S.LAND:
			velocity.x = 0.0
			move_and_slide()
			rig.animate(&"land", dt, {"k": clampf(state_t / LAND_TIME, 0.0, 1.0)})
			if state_t >= LAND_TIME:
				_to(S.IDLE)
