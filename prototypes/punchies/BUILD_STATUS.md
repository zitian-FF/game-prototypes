## Current milestone

Layered boxer wired in (head, gloves, torso, feet, round shadow, each with its own Y offset), an online netcode experiment behind a host-authoritative switch, and an always-visible red bug button for debug mode (internal testing). Default netcode behaviour is unchanged.

## What was implemented

- Layered boxer (`FighterView.drawArt`): the new `_torso`, `_gloves`, `_head` and `_effects` art layers are drawn top to bottom effects, head, gloves, torso, then the feet layer and the round shadow (`groundLayer.ts`). Each layer has its own screen-Y offset in `tune.view`: `headOffsetY` -4, gloves 0, `bodyOffsetY` 2, `feetOffsetY` 5, `shadowOffsetY` 8. The sim position and hitboxes stay on the body. Missing layers fall back to the baked body sprite, then to the drawn fallback. The KO keeps the baked `_ko` body with the ground layer.
- Separate hit flash: a hit on the Vulnerable row (face reached, or defender vulnerable) flashes only the head layer; a Normal-row hit (arms and body) flashes only the torso. The hit event's existing `row` decides it, so no sim change. The baked body and the drawn fallback still flash whole.
- The baked stun stars in the `_effects` layer are skipped (the runtime star orbit draws them, now centred on the raised head).
- Red bug button, bottom centre, always on screen: toggles debug mode (Tweakpane tune panel, hitbox overlay, online net stats readout). State is remembered in localStorage (`punchies:debug:v1`); `?debug=1` still starts with it on. `isDebug()` replaces the old `DEBUG_ENABLED` constant.
- `tune.net.enhanced` (0 = default, plain rollback; 1 = experiment). Host authoritative: guests already adopt the host's tune at match start, so both phones run the same mode. Only read when a match starts.
- Enhanced mode, four parts:
  1. Split input delay: stick and guard use `net.moveDelayFrames` (1); punches and dodges keep the full delay, buffered by an extra tap queue in `Rollback` (`opts.tapExtra`), hidden by the punch startup frames.
  2. Eased corrections: after a rollback that moved a boxer more than 3 px, the drawn position eases back over `net.smoothFrames` (4). Picture only; sim, hit effects and hitboxes stay exact.
  3. Adaptive punch delay: the ping is re-measured every second during the match; each peer moves its own punch delay one frame at a time toward `net.adaptFactor` (0.5) times the one-way ping, capped by `net.adaptMaxFrames` (6) and floored at the normal delay.
  4. Net stats readout (debug mode, any online match): rollbacks per second, frames per second, depth average and max, stalls, ping, stick and punch delay.
- Stun stars, ground shadow and feet layer, logo and gym art from earlier this session are already merged.

## Key technical decisions

- With `net.enhanced` at 0 the code path is the old one. Verified headless: the new `Rollback` produced a byte-identical sim to the previous version in three latency scenarios (1500 ticks each).
- Inputs are stamped with sim ticks, so each peer can change its own delay at any time without coordination. Raising the tap delay leaves one tick without taps; lowering it merges the oldest buffered taps into one tick.
- Both peers must use the same `moveDelayFrames` (the initial neutral ticks assume it); that is guaranteed by the guest adopting the host's tune.
- Guard rides the fast stick stream (Perfect Guard timing), so a defender's guard can be a frame or two faster than the attacker's punch in enhanced mode.
- The bug button is a plain DOM button, like the Tweakpane panel (a debug aid, not game UI).

## Open questions

- All the numbers (`moveDelayFrames`, `adaptFactor`, `smoothFrames`) are first guesses. They need real two-phone testing; nothing here has been measured on a phone.
- Should guard stay in the fast stream or move with the punches?
- BRIEF.md does not mention the online experiment or the debug button; it may need a line.

## Known issues

- Download size: the R2 bundle now holds the old baked bodies plus all the new layers (about 14 MB zip, about 2.1 MB per character group, over twice the previous 0.9 MB). Tell Codex to drop the baked non-KO full-body keys (keep `*_ko` and `*_feet`) and consider WebP atlases (`sharp` is already a dependency) to bring it back down.
- Layers checked in desktop Chromium (idle, punch, head flash with a long test flash time, zero console errors). Body-zone flash and the effects layer in a dodge or guard were not seen live. Not checked on a phone.
- Verified headless with a two-peer simulator (latency, jitter, 10% packet loss, live tap-delay changes, 12 runs): no desyncs. Also ran the real MatchScene against a mocked session in desktop Chromium: bug button, panel toggle, net stats, enhanced and standard modes, no desync, no console errors. That headless browser renders very slowly, so its latency and depth numbers are meaningless.
- Not tested with two real phones or a real relay.
- Smoothing only eases position; punch poses still pop after a rollback.
- Existing Phaser bundle-size warning.

## Next proposed step

Two-phone test: play a few matches with `net.enhanced` 0 and 1 (set it on the host in the panel before the match) and compare the stats readout and the feel. Then tune the three numbers.
