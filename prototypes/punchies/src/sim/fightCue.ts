import { tune, TICK_RATE } from './tune';

/** Shared by the entrance presentation and deterministic combat ready gate. */
export function fightCueTiming() {
  const cfg = tune.view.fightPresentation;
  // Never fade while the scale/crop entrance is still running. Quantize once
  // so presentation and both rollback peers use the same phase boundary.
  const entranceTicks = Math.ceil(Math.max(cfg.impactMs, cfg.fightHoldMs) * TICK_RATE / 1000);
  return { entranceTicks, entranceMs: entranceTicks * 1000 / TICK_RATE, fadeMs: cfg.fightFadeMs };
}
