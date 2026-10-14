import tune from '../../tune.json';

// Advances energy/timestamp from elapsed real time. Time spent sitting at
// the cap is discarded, not banked: once energy reaches energyMax, the
// timestamp snaps to `now` rather than staying frozen, so no backlog of
// elapsed time can build up behind it and get redeemed as a free refill
// the moment energy next drops below the cap.
export function applyEnergyRegen(
  energy: number,
  timestamp: number,
  now: number
): { energy: number; timestamp: number } {
  const elapsedMs = Math.max(0, now - timestamp);
  const pointsAvailable = Math.floor(elapsedMs / tune.energyRegenMs);
  const pointsApplied = Math.min(pointsAvailable, tune.energyMax - energy);
  const newEnergy = energy + pointsApplied;
  const newTimestamp =
    newEnergy >= tune.energyMax ? now : timestamp + pointsApplied * tune.energyRegenMs;
  return { energy: newEnergy, timestamp: newTimestamp };
}
