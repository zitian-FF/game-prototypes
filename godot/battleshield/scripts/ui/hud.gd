extends Control
## Code-built HUD: ship status panels, weapon/defense buttons, contextual
## action bar, intent signal banner, combat log, and the phase timer.

const AICaptain = preload("res://scripts/combat/ai_captain.gd")

var engine = null
var view = null           # BattleView
var interactive := false   # false = AI vs AI demo

var _log_label: RichTextLabel
var _enemy_panel: VBoxContainer
var _player_panel: VBoxContainer
var _weapon_box: VBoxContainer
var _defense_box: VBoxContainer
var _action_bar: HBoxContainer
var _signal_label: Label
var _turn_label: Label
var _timer_label: Label
var _banner: Label

var _selected_weapon: String = ""
var _zone_pick_mode: String = ""   # "" | "fire" | "shield" | "repair"
var _phase_time := 0.0
var _ai_timer := 0.0
var _ai_pending := false
var _last_hull := {}

func setup(p_engine, p_view, p_interactive: bool) -> void:
	engine = p_engine
	view = p_view
	interactive = p_interactive
	_build()
	engine.battle_log.connect(_append_log)
	engine.phase_changed.connect(_on_phase)
	engine.battle_finished.connect(_on_finished)
	_snapshot_hull()
	refresh()

# ------------------------------------------------------------------ build --

func _build() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	# Enemy panel (top center).
	_enemy_panel = _mk_panel(Vector2(430, 6), Vector2(420, 150), "ENEMY")
	# Turn banner under it.
	var tb := PanelContainer.new()
	tb.position = Vector2(480, 162)
	tb.size = Vector2(320, 60)
	add_child(tb)
	var tv := VBoxContainer.new()
	tb.add_child(tv)
	_turn_label = Label.new()
	_turn_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tv.add_child(_turn_label)
	_signal_label = Label.new()
	_signal_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_signal_label.add_theme_font_size_override("font_size", 13)
	_signal_label.add_theme_color_override("font_color", Color(1.0, 0.75, 0.4))
	tv.add_child(_signal_label)
	# Player panel (bottom center).
	_player_panel = _mk_panel(Vector2(430, 564), Vector2(420, 150), "YOU")
	# Action bar above player panel.
	var ab := PanelContainer.new()
	ab.position = Vector2(430, 490)
	ab.size = Vector2(420, 68)
	add_child(ab)
	_action_bar = HBoxContainer.new()
	_action_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	_action_bar.add_theme_constant_override("separation", 6)
	ab.add_child(_action_bar)
	_timer_label = Label.new()
	_timer_label.position = Vector2(860, 514)
	add_child(_timer_label)
	# Weapon / defense side panels.
	_weapon_box = _mk_side_panel(Vector2(8, 110), "WEAPONS")
	_defense_box = _mk_side_panel(Vector2(1062, 110), "DEFENSES")
	# Combat log (bottom left).
	var lp := PanelContainer.new()
	lp.position = Vector2(8, 430)
	lp.size = Vector2(400, 284)
	add_child(lp)
	_log_label = RichTextLabel.new()
	_log_label.bbcode_enabled = true
	_log_label.scroll_following = true
	_log_label.custom_minimum_size = Vector2(390, 274)
	lp.add_child(_log_label)
	# Big center banner (winner / phase).
	_banner = Label.new()
	_banner.set_anchors_preset(Control.PRESET_CENTER)
	_banner.position = Vector2(440, 300)
	_banner.add_theme_font_size_override("font_size", 42)
	_banner.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	_banner.visible = false
	add_child(_banner)

func _mk_panel(pos: Vector2, size: Vector2, title: String) -> VBoxContainer:
	var p := PanelContainer.new()
	p.position = pos
	p.size = size
	add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	p.add_child(v)
	var t := Label.new()
	t.text = title
	t.add_theme_font_size_override("font_size", 13)
	v.add_child(t)
	return v

func _mk_side_panel(pos: Vector2, title: String) -> VBoxContainer:
	var p := PanelContainer.new()
	p.position = pos
	p.size = Vector2(210, 300)
	add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	p.add_child(v)
	var t := Label.new()
	t.text = title
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	return v

func _bar(parent: VBoxContainer, label: String, value: float, maxv: float, col: Color) -> ProgressBar:
	var h := HBoxContainer.new()
	var l := Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(52, 0)
	l.add_theme_font_size_override("font_size", 12)
	h.add_child(l)
	var b := ProgressBar.new()
	b.min_value = 0
	b.max_value = maxv
	b.value = value
	b.custom_minimum_size = Vector2(150, 14)
	b.show_percentage = false
	h.add_child(b)
	var v := Label.new()
	v.text = "%d/%d" % [int(value), int(maxv)]
	v.add_theme_font_size_override("font_size", 12)
	h.add_child(v)
	parent.add_child(h)
	return b

# ---------------------------------------------------------------- refresh --

func _fill_ship_panel(box: VBoxContainer, ship, title: String) -> void:
	for c in box.get_children():
		if c is HBoxContainer:
			c.queue_free()
	var t := box.get_child(0) as Label
	var status: String = title + "  " + ship.name
	if ship.burning > 0:
		status += "  [BURNING]"
	if ship.overheated:
		status += "  [OVERHEATED]"
	t.text = status
	for zone in ["front", "side", "rear"]:
		_bar(box, zone.capitalize(), ship.hull[zone], ship.hull_max[zone], Color(0.4, 0.9, 0.4))
	_bar(box, "Shield", ship.shield_hp, ship.shield_hp_max, Color(0.4, 0.7, 1.0))
	_bar(box, "Energy", ship.energy, ship.energy_max, Color(1.0, 0.85, 0.3))
	_bar(box, "Heat", ship.heat, ship.heat_max, Color(1.0, 0.4, 0.2))

func refresh() -> void:
	if engine == null:
		return
	_fill_ship_panel(_enemy_panel, engine.enemy, "ENEMY")
	_fill_ship_panel(_player_panel, engine.player, "YOU")
	_refresh_weapons()
	_refresh_defenses()
	_refresh_action_bar()
	_turn_label.text = "Round %d / %d" % [engine.round_num, engine.max_rounds]
	if engine.phase == "attacker":
		_turn_label.text += " — %s attacking" % engine.attacker.name
	elif engine.phase == "defender":
		_turn_label.text += " — %s defending" % engine.defender.name
	_signal_label.text = engine.intent_signal.get("text", "")
	_detect_damage()

func _refresh_weapons() -> void:
	for c in _weapon_box.get_children():
		if c is Button:
			c.queue_free()
	for w in engine.player.weapons:
		var b := Button.new()
		b.text = "%s\n[%s]" % [w.name, w.status_text()]
		b.custom_minimum_size = Vector2(190, 52)
		var can: bool = interactive and engine.phase == "attacker" \
			and engine.is_player_attacker() and not engine.over
		b.disabled = not can
		b.pressed.connect(_on_weapon.bind(w.id))
		_weapon_box.add_child(b)

func _refresh_defenses() -> void:
	for c in _defense_box.get_children():
		if c is Button:
			c.queue_free()
	for d in engine.player.defenses:
		var b := Button.new()
		b.text = "%s\n[%s]" % [d.name, d.status_text()]
		b.custom_minimum_size = Vector2(190, 52)
		var can: bool = interactive and engine.phase == "defender" \
			and engine.is_player_defender() and not engine.over
		if d.kind == "booster" and engine.player.weight_class != "light":
			can = false
		b.disabled = not can
		b.pressed.connect(_on_defense.bind(d.id))
		_defense_box.add_child(b)

func _mk_action_btn(text: String, callable: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(96, 52)
	_action_bar.add_child(b)
	b.pressed.connect(callable)
	return b

func _clear_actions() -> void:
	for c in _action_bar.get_children():
		c.queue_free()

func _refresh_action_bar() -> void:
	_clear_actions()
	if engine.over:
		return
	if engine.phase == "attacker" and interactive and engine.is_player_attacker():
		_attacker_buttons()
	elif engine.phase == "defender" and interactive and engine.is_player_defender():
		_defender_buttons()
	elif not interactive or (engine.phase == "attacker" and not engine.is_player_attacker()) \
		or (engine.phase == "defender" and not engine.is_player_defender()):
		var l := Label.new()
		l.text = "Enemy thinking..."
		_action_bar.add_child(l)

func _attacker_buttons() -> void:
	if _zone_pick_mode == "fire":
		for zone in ["front", "side", "rear"]:
			_mk_action_btn(zone.capitalize(), _on_zone.bind(zone))
		_mk_action_btn("Cancel", _on_cancel_zone)
		return
	var w = engine.player.get_weapon(_selected_weapon)
	if w == null:
		var l := Label.new()
		l.text = "Select a weapon"
		_action_bar.add_child(l)
		_mk_action_btn("Vent", func(): _act({"type": "vent"}))
		_mk_action_btn("Pass", func(): _act({"type": "pass"}))
		return
	if w.needs_priming():
		_mk_action_btn("Prime", func(): _act({"type": "prime", "weapon": w.id}))
	if w.kind == "cannon":
		_mk_action_btn("Focus", func(): _act({"type": "focus", "weapon": w.id}))
		_mk_action_btn("FIRE >", _on_fire_pick)
	elif w.kind == "missile":
		_mk_action_btn("Hold Lock", func(): _act({"type": "lock"}))
		_mk_action_btn("FIRE >", _on_fire_pick)
	elif w.kind == "drone":
		_mk_action_btn("Launch", func(): _act({"type": "launch"}))
	_mk_action_btn("Vent", func(): _act({"type": "vent"}))
	_mk_action_btn("Pass", func(): _act({"type": "pass"}))

func _defender_buttons() -> void:
	if _zone_pick_mode != "":
		for zone in ["front", "side", "rear"]:
			_mk_action_btn(zone.capitalize(), _on_zone.bind(zone))
		_mk_action_btn("Cancel", _on_cancel_zone)
		return
	var incoming: bool = not engine.pending_attack.is_empty()
	if incoming:
		_mk_action_btn("CWIS", func(): _dact({"type": "cwis"}))
		_mk_action_btn("Shield >", _on_shield_pick)
		if engine.player.has_booster():
			_mk_action_btn("Boosters", func(): _dact({"type": "booster"}))
		_mk_action_btn("Brace", func(): _dact({"type": "brace"}))
	else:
		_mk_action_btn("Repair >", _on_repair_pick)
		_mk_action_btn("Recharge", func(): _dact({"type": "recharge"}))
		_mk_action_btn("Vent", func(): _dact({"type": "vent"}))
		_mk_action_btn("Hold", func(): _dact({"type": "hold"}))

# ----------------------------------------------------------------- input --

func _on_weapon(wid: String) -> void:
	_selected_weapon = wid
	_zone_pick_mode = ""
	refresh()

func _on_fire_pick() -> void:
	_zone_pick_mode = "fire"
	refresh()

func _on_shield_pick() -> void:
	_zone_pick_mode = "shield"
	refresh()

func _on_repair_pick() -> void:
	_zone_pick_mode = "repair"
	refresh()

func _on_cancel_zone() -> void:
	_zone_pick_mode = ""
	refresh()

func _on_zone(zone: String) -> void:
	var mode := _zone_pick_mode
	_zone_pick_mode = ""
	if mode == "fire":
		_act({"type": "fire", "weapon": _selected_weapon, "zone": zone})
	elif mode == "shield":
		_dact({"type": "shield", "zone": zone})
	elif mode == "repair":
		_dact({"type": "repair", "zone": zone})

func _act(a: Dictionary) -> void:
	_selected_weapon = ""
	if not engine.submit_attacker_action(a):
		_append_log("[i]That action isn't available right now.[/i]")
	refresh()

func _dact(a: Dictionary) -> void:
	engine.submit_defender_action(a)
	refresh()

func _on_defense(did: String) -> void:
	# Quick defense buttons: CWIS/booster/brace fire immediately, shield needs a zone.
	var d = engine.player.get_defense(did)
	if d == null:
		return
	if d.kind == "shield":
		_on_shield_pick()
	elif d.kind == "cwis":
		_dact({"type": "cwis"})
	elif d.kind == "booster":
		_dact({"type": "booster"})

# ----------------------------------------------------------------- phases --

func _on_phase(phase: String) -> void:
	_selected_weapon = ""
	_zone_pick_mode = ""
	if phase == "defender" and not engine.pending_attack.is_empty():
		var atk: bool = engine.attacker == engine.player
		view.fire_tracer(atk, engine.pending_attack.get("kind", "cannon"))
	if phase == "over":
		_banner.visible = false
	_phase_time = engine.phase_time_limit() if interactive else 0.0
	# Schedule AI when it's not the human's turn.
	_ai_pending = false
	if not engine.over:
		var human_turn: bool = interactive and (
			(phase == "attacker" and engine.is_player_attacker()) \
			or (phase == "defender" and engine.is_player_defender()))
		if not human_turn:
			_ai_pending = true
			_ai_timer = 0.9
	refresh()

func _process(delta: float) -> void:
	if engine == null or engine.over:
		return
	if _ai_pending:
		_ai_timer -= delta
		if _ai_timer <= 0.0:
			_ai_pending = false
			_ai_act()
	if interactive and _phase_time > 0.0 and not engine.over:
		_phase_time -= delta
		_timer_label.text = "%.0fs" % maxf(0.0, _phase_time)
		if _phase_time <= 0.0:
			_phase_time = 0.0
			if engine.phase == "attacker" and engine.is_player_attacker():
				_act({"type": "pass"})
			elif engine.phase == "defender" and engine.is_player_defender():
				_dact({"type": "brace"})

func _ai_act() -> void:
	if engine.over:
		return
	if engine.phase == "attacker":
		var a := AICaptain.choose_attacker_action(engine.attacker, engine.defender, engine)
		engine.submit_attacker_action(a)
	elif engine.phase == "defender":
		var d := AICaptain.choose_defender_action(engine.defender, engine.attacker, engine.intent_signal, engine)
		engine.submit_defender_action(d)
	refresh()

func _on_finished(winner: String, reason: String) -> void:
	_banner.text = "%s WINS\n(%s)" % [winner, reason]
	_banner.visible = true
	refresh()

# ------------------------------------------------------------------- misc --

func _append_log(msg: String) -> void:
	_log_label.append_text(msg + "\n")

func _snapshot_hull() -> void:
	_last_hull = {
		"p": [engine.player.hull["front"], engine.player.hull["side"], engine.player.hull["rear"]],
		"e": [engine.enemy.hull["front"], engine.enemy.hull["side"], engine.enemy.hull["rear"]],
	}

func _detect_damage() -> void:
	var zones := ["front", "side", "rear"]
	for i in 3:
		if engine.player.hull[zones[i]] < _last_hull["p"][i] - 0.5:
			view.flash_zone(true, zones[i])
		if engine.enemy.hull[zones[i]] < _last_hull["e"][i] - 0.5:
			view.flash_zone(false, zones[i])
	_snapshot_hull()
