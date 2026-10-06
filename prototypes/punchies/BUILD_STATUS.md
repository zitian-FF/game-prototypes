## Current milestone
Medium and Hard bots manage stamina; Hard retuned to beat Medium again.

## What was implemented
- Recovery mode (medium and hard): when stamina drops under `retreatStaminaBelow` or the bot is exhausted, it goes to a safe spot and stands perfectly still (no input at all is the fastest stamina regen), until stamina is back above `recoverUntil` (hysteresis, so it does not flicker at the threshold). A safe spot is at least `safeDistance` from the foe and off the ropes (`edgeMargin`).
- If the foe is closer than that, the bot picks the best of 16 directions: away from the foe but never into a wall or corner, so it circles instead of backing into a stun lock. If it still cannot gain distance and the foe is close, it blocks.
- Conservative while it still has stamina: under `conserveBelow` it attacks less often (scaled down toward the reserve), prefers cheap punches, does not chase an open foe, and never spends into the reserve on a plain attack (a punish may dip into it). It also no longer tries a dodge it cannot afford, and keeps guard up while the punch it blocked is still in the air (dropping guard costs a 24-frame penalty).
- New per-level tune values (`ai.medium.*`, `ai.hard.*`): `recoverUntil`, `conserveBelow`, `safeDistance`, `edgeMargin`. Hard `retreatStaminaBelow` 22 to 30. Easy bot untouched.
- New `scripts/verify-punchies-bots.mjs`.
- Hard retune (this pass): Hard presses in and attacks about 2.5x as often when the foe's stamina is under 55 (`pressureFoeBelow`, `pressureBoost`; Medium has it off), and its style numbers were reset to Medium's base plus faster reactions, more Perfect Guard and counter attempts and uppercut dodging. Hard now beats Medium about 3 of 4 and Easy 48 of 48.

## Key technical decisions
- Bot-only change (`src/sim/bot.ts`, tune.json); the sim and online play are untouched (bots are local only).
- Measured over 24 to 48 bot-vs-bot matches: time spent exhausted fell 2 to 5x, time pinned on the ropes fell about 90 percent for medium and 80 percent for hard, and matches end sooner.

## Open questions
- Hard now shares most of Medium's style numbers (the old aggressive set lost to Medium under the new stamina and guard rules) and differs by faster reactions, more Perfect Guard and counter attempts, dodging the uppercut, and pressure on a low-stamina foe. Is that Hard enough, or should Hard get its own personality back?

## Known issues
- A recovering bot that the foe keeps chasing circles instead of standing still, so it regenerates at the slower moving rate.
- Not verified against real players or on a phone.

## Next proposed step
Playtest all three levels with real players and adjust.
