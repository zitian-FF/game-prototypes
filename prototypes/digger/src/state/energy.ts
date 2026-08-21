import tune from '../../tune.json';

// Advances energy/timestamp from elapsed real time. Only advances the
// timestamp by whole regen intervals actually applied toward the cap, so
// time spent capped isn't lost — the next call (whenever it happens) still
// sees the full elapsed gap from the last real interval consumed. Safe to
// call repeatedly (idempotent for any elapsed < one regen interval).
export function applyEnergyRegen(
  energy: number,
  timestamp: number,
  now: number
): { energy: number; timestamp: number } {
  const elapsedMs = Math.max(0, now - timestamp);
  const pointsAvailable = Math.floor(elapsedMs / tune.energyRegenMs);
  const pointsApplied = Math.min(pointsAvailable, tune.energyMax - energy);
  if (pointsApplied <= 0) return { energy, timestamp };
  return {
    energy: energy + pointsApplied,
    timestamp: timestamp + pointsApplied * tune.energyRegenMs,
  };
}
