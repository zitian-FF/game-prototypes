# Survival logic contract

Branch: `proto/punchies/zombie-survival`. This assignment does not merge or deploy.
Art owns MenuScene, CharSelectScene, SurvivalScene and all presentation.

## Scene integration

- Import `SurvivalStore` from `src/survival/save`, `survivalView` from `src/survival/sim`, and `{store as storage}` from `src/portal/store`.
- Construct `new SurvivalStore(storage)` after portal initialization/preload. `best()` returns the highest cleared wave with fighter, skin, run ID and balance version.
- `loadResume()` returns `ready {run}`, `none`, `abandoned`, `corrupt`, or `incompatible {savedVersion,currentVersion}`. Show explicit balance incompatibility; do not silently reset or retune the checkpoint.
- Start with `store.begin({fighter:CharId,skin:string,seed:number,runId:string})`. Generate ID/seed outside the simulation. Preserve chosen fighter/skin for the run.
- Drive `store.step(run, FrameInput)` at 60 Hz. It automatically saves on `waveCleared` and `runEnded`. Pause by not stepping. No wall-clock catch-up.
- Between waves `store.advance(run)` persists consumption of the checkpoint before starting the next wave. Do not call bare `startNextWave` from the scene.
- Save & Exit only when `view.canSave`: `store.saveAndExit(run)` returns success. Active exit calls `store.abandon(run)` and ends the attempt. Reloading an active attempt also abandons it, preserving PB but offering no resumable active snapshot.
- All persistence uses one registered portal key, `punchies:survival:v1`. Writes verify immediate readback and throw on unavailable storage; the scene must display save failure.

`survivalView(run)` supplies player, enemies, fighter/skin, wave, clearedWave,
secondsLeft, `timeText` (m:ss), waveKills, zombieKills, totalKills, status,
endReason, bossChar, nextBossWave, actual healing, canSave, maxHealth/maxStamina,
balanceVersion and `xpEnabled:false`.

Enemies have unique `id`, `kind:'zombie'|'boss'`, `visualId`, `fighter`, and
mode-specific maxHealth. **Generic zombie fighter.char is marco for combat stats;
visualId is zombie.** Puppet must accept a visual override without changing char.
Boss fighter.char and visualId are the actual configured fighter ID, base artwork.
Do not use character maxHealth for the enemy HUD: use enemy.maxHealth.

## Events and rules

`SurvivalEvent` includes combat `{event:SimEvent,entityIds:['player',enemyId]}`,
spawn/kill `{enemyId,enemyKind}`, waveCleared `{wave,kills,zombieKills,healing}`,
and runEnded `{reason,clearedWave}`. SimEvent indices refer to entityIds.
Empty enemyId on a player-only combat event means there is no current target.
Renderer should consume IDs before removing killed puppets.

Each wave lasts exactly 60 seconds of fixed ticks, including hit-stop. Surviving
timer expiry despawns all survivors **including a boss**; defeating a boss is not
required. Death on the final tick takes priority over wave clear. Every fifth
wave has one randomly selected existing fighter using seeded Easy AI. Spawns
retry bounded safe edge positions, never overlap existing fighters, never exceed
the active cap; a blocked boss spawn is retried later, taking priority over zombies.

Facing tracks the nearest living enemy whenever no punch or dodge is committed, including neutral hitstop and final movement/separation positions. Full swings
lock facing through recovery; dodges keep their committed facing. The production scene uses that closest enemy for its stage context. Each swing may contact multiple enemies but only
once per enemy; perfect guard can cancel the remaining swing. Each defender gets
individual stun and knockback. Separation is independent of pair combat. No core
boxing step changes; the new adapter exports existing operations for opt-in use.

Healing is min(missing HP, zombie kills × configured heal). Boss kills do not heal.
Intermission clears transient actions/stun/push, retains stamina, fatigue and stars.
No XP, tokens, shop rewards, progression or Elo are awarded by Survival.

All numeric Survival placeholders are in `src/survival/config.json`; existing
fighter tune is unchanged. `survivalBalanceVersion()` hashes tune and mode config.
Checkpoint resume supports intermissions only, recreating seeded boss AI next wave.
Boss AI reaction history and RNG are included in run state; fixed-input active
simulation can be cloned/replayed deterministically, but cannot be persisted as a resumable save.

## Existing service inventory

- **Live:** private room-code Trystero `NetSession`, host/guest profile exchange;
  `loadProgress`, `progressView`, `awardMatch`; profile aliases and title display.
- **Not live:** casual Elo Worker/client are uncommitted work on a separate branch
  `proto/punchies/casual-elo`. No deployed rating API, ranks, global queue or leaderboard.
- Do not label ranked matchmaking available or imply Survival grants XP. Future
  approved reward integration can use runId + clearedWave for deduplication.

## Owner correction (2026-10-11)
Ordinary Zombie health is a seeded inclusive integer draw from `zombieMinHp:5` through `zombieMaxHp:10`, at every wave. This supersedes the earlier durability growth rule. Only speed/spawn pacing continue their existing wave growth. Boss health remains its selected fighter’s roster HP. Changes invalidate old versioned checkpoints through the existing config hash.

QA: `test-punchies-survival.mjs` covers deterministic replay, all six HP values across seeds and waves 1/2/5/50, boss health, nearest switches, neutral hitstop, punch recovery and dodge locks. `tools/survival-target-review.html?screen=active` uses the actual production Survival scene and sim with explicit test-position/input controls and mock saves, never player saves. The Test jab control moves the closest target during the swing and asserts retained direction through recovery, then reacquisition. Brave evidence: outputs/ranked-survival-fixes/target-lock-reacquire.png, no console errors.
