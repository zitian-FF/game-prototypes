## Current milestone
Medium and Hard bots manage stamina: they recover in a safe spot and stay conservative while they still have some.

## What was implemented
- Recovery mode (medium and hard): when stamina drops under `retreatStaminaBelow` or the bot is exhausted, it goes to a safe spot and stands perfectly still (no input at all is the fastest stamina regen), until stamina is back above `recoverUntil` (hysteresis, so it does not flicker at the threshold). A safe spot is at least `safeDistance` from the foe and off the ropes (`edgeMargin`).
- If the foe is closer than that, the bot picks the best of 16 directions: away from the foe but never into a wall or corner, so it circles instead of backing into a stun lock. If it still cannot gain distance and the foe is close, it blocks.
- Conservative while it still has stamina: under `conserveBelow` it attacks less often (scaled down toward the reserve), prefers cheap punches, does not chase an open foe, and never spends into the reserve on a plain attack (a punish may dip into it). It also no longer tries a dodge it cannot afford, and keeps guard up while the punch it blocked is still in the air (dropping guard costs a 24-frame penalty).
- New per-level tune values (`ai.medium.*`, `ai.hard.*`): `recoverUntil`, `conserveBelow`, `safeDistance`, `edgeMargin`. Hard `retreatStaminaBelow` 22 to 30. Easy bot untouched.
- New `scripts/verify-punchies-bots.mjs`.

## Key technical decisions
- Bot-only change (`src/sim/bot.ts`, tune.json); the sim and online play are untouched (bots are local only).
- Measured over 24 to 48 bot-vs-bot matches: time spent exhausted fell 2 to 5x, time pinned on the ropes fell about 90 percent for medium and 80 percent for hard, and matches end sooner.

## Open questions
- Hard now loses to Medium (about 16 of 48 matches). Hard's aggressive style pays more under the new stamina and guard-release rules, and a chased bot cannot stand still for long, so the difficulty order needs a retune. Not changed.

## Known issues
- A recovering bot that the foe keeps chasing circles instead of standing still, so it regenerates at the slower moving rate.
- Not verified against real players or on a phone.

## Next proposed step
Retune Hard so it beats Medium again (smarter offence against a recovering foe), then playtest all three levels.
