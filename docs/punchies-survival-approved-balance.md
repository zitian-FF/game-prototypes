# Approved Zombie balance batch

This batch starts from Ranked staging `7d47e73` and changes Survival only.

- Boss ordinary-add lifetime quota: first boss 8, then 12, 16, 20, capped at 24. Successful initial adds count; blocked placement and alive-cap attempts do not. The counter resets on the next wave. Boss alive-add cap remains 4, ordinary alive cap 12 and renderer cap 24.
- Boss HP: `round(base fighter HP × min(2, 0.5 + 0.25 × (boss number − 1)))`, minimum 1. The selected player never affects boss HP.
- Ordinary Zombie damage: `min(0.80, 0.50 + 0.03 × (wave − 1))` applied once to normal punch damage. Standard quality, defense, fatigue and other contact multipliers remain intact.
- Cross starts at wave 4: chance `min(0.40, 0.15 + 0.03 × (wave − 4))`. Selection uses the run RNG at an allowed close-range attack attempt. It uses the real Cross geometry and contact rules, with minimum startup 20 frames; Jab keeps minimum 12. At most one ordinary Cross occupies startup/active time. Recovery releases the slot. Existing global 2/3 attack slots, start gap, boss reservation and Easy AI remain unchanged.

## Checkpoints

New saves use schema 2 and balance fingerprint `survival-v3-*`. `waveZombieSpawns` persists successful ordinary spawns in the completed wave. The fingerprint includes the actual runtime fighter inventory as well as tune, Survival config and Super balance data; it hashes all UTF-16 code units.

Old schema 1 / old-balance checkpoints are read for their personal-best record but return the existing **incompatible** resume state. They cannot resume under the new balance. Active interrupted attempts remain abandoned, and save-before-advance behavior is unchanged. No old run is silently reconstructed with a guessed spawn counter.

## Validation

`test-punchies-survival-balance.mjs` checks quotas and caps, failed placements, every available fighter's boss HP, exact ramps, seeded replay, real Cross damage/guard/dodge, Cross slots and schema compatibility. Existing Survival regression and renderer churn tests remain applicable. No shared fighter tune, Ranked, art, audio or translation keys change in this batch.
