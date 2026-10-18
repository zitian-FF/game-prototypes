extends Node
## Entry point. Modes:
##   (default)      player vs AI, interactive
##   --demo         AI vs AI, watchable pacing
##   --autobattle   AI vs AI, instant, prints result (headless verification)

const ShipFactory = preload("res://scripts/data/ship_factory.gd")
const CombatEngine = preload("res://scripts/combat/combat_engine.gd")
const AICaptain = preload("res://scripts/combat/ai_captain.gd")
const BattleView = preload("res://scripts/ui/battle_view.gd")
const HUD = preload("res://scripts/ui/hud.gd")

var engine: Node
var view: Node2D
var hud: Control
var interactive := true
var autobattle := false

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if "--demo" in args:
		interactive = false
	if "--autobattle" in args:
		interactive = false
		autobattle = true

	var player = ShipFactory.make_player_ship()
	var enemy = ShipFactory.make_enemy_ship()

	view = BattleView.new()
	add_child(view)

	engine = CombatEngine.new()
	add_child(engine)
	view.engine = engine

	var layer := CanvasLayer.new()
	add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)

	engine.setup(player, enemy)
	hud.setup(engine, view, interactive)
	if autobattle:
		engine.battle_log.connect(print)
	engine.start_battle()

	if autobattle:
		_run_autobattle()

func _run_autobattle() -> void:
	var ai = AICaptain.new()
	var shot_taken := false
	while not engine.over:
		engine.auto_step_round(ai)
		if not shot_taken and engine.round_num >= 6:
			shot_taken = true
			await _screenshot("battle-mid")
	print("AUTOBATTLE RESULT: winner=%s reason=%s rounds=%d" % [
		engine.winner_name, engine.win_reason, engine.round_num])
	print("  player hull: %s" % str(engine.player.hull))
	print("  enemy hull:  %s" % str(engine.enemy.hull))
	await _screenshot("battle-end")
	get_tree().quit()

func _screenshot(tag: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	for i in 8:
		await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	var path := "user://shots/%s.png" % tag
	DirAccess.make_dir_recursive_absolute("user://shots")
	var err := img.save_png(path)
	print("screenshot %s: %s (err %d)" % [tag, path, err])
