import type { SimState } from '../sim/types';
import { sfx } from './sfx';

/** Observe presented simulation ticks, never render-frame frequency or raw inputs. */
export class MovementSound {
  private tick = -1;
  private previous: { x: number; y: number; guard: boolean; dodge: boolean; distance: number; stepTick: number; alternate: boolean }[] = [];
  update(s: SimState): void {
    if (s.tick === this.tick) return;
    const fresh = this.tick < 0 || s.tick < this.tick || s.tick - this.tick > 6;
    this.tick = s.tick;
    s.fighters.forEach((f, i) => {
      const old = this.previous[i];
      let distance = old?.distance ?? 0, stepTick = old?.stepTick ?? s.tick;
      let alternate = old?.alternate ?? false;
      const active = !s.result && s.tick >= s.fightStartTick;
      if (!fresh && old && active) {
        if (f.guarding && !old.guard) sfx.guardRaise();
        if (f.dodge && !old.dodge) sfx.dodge();
        const moved = Math.hypot(f.x - old.x, f.y - old.y);
        if (!f.anchored && !f.dodge && !f.stunTimer && !f.pushFrames && !f.lock && !s.hitstop && moved > 0.1 && moved < 12) {
          distance += moved;
          if (distance >= 24 && s.tick - stepTick >= 14) { sfx.step(alternate); alternate = !alternate; distance %= 24; stepTick = s.tick; }
        } else distance = 0;
      } else distance = 0;
      this.previous[i] = { x: f.x, y: f.y, guard: f.guarding, dodge: !!f.dodge, distance, stepTick, alternate };
    });
  }
}
