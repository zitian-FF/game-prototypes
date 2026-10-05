## Current milestone

Online netcode experiment behind a host-authoritative switch, plus an always-visible red bug button for debug mode (internal testing). Default behaviour is unchanged.

## What was implemented

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

- Verified headless with a two-peer simulator (latency, jitter, 10% packet loss, live tap-delay changes, 12 runs): no desyncs. Also ran the real MatchScene against a mocked session in desktop Chromium: bug button, panel toggle, net stats, enhanced and standard modes, no desync, no console errors. That headless browser renders very slowly, so its latency and depth numbers are meaningless.
- Not tested with two real phones or a real relay.
- Smoothing only eases position; punch poses still pop after a rollback.
- Existing Phaser bundle-size warning.

## Next proposed step

Two-phone test: play a few matches with `net.enhanced` 0 and 1 (set it on the host in the panel before the match) and compare the stats readout and the feel. Then tune the three numbers.
