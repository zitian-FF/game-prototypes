class_name Capture
extends Node
## Verification helper: dumps viewport PNGs at fixed timestamps so the
## animation can be inspected without watching it live.
## Enabled by main.gd when `--capture` is passed after `--`.

const TIMES := [0.8, 2.4, 3.75, 4.05, 4.35, 5.3]
const OUT_DIR := "user://captures"

var _t := 0.0
var _idx := 0


func _process(dt: float) -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	_t += dt
	if _idx < TIMES.size() and _t >= TIMES[_idx]:
		var img := get_viewport().get_texture().get_image()
		var path := "%s/cap_%02d_t%.2f.png" % [OUT_DIR, _idx, TIMES[_idx]]
		img.save_png(path)
		print("capture: saved ", path)
		_idx += 1
