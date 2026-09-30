import type { FrameInput } from '../sim/types';

// Intent layer for touch: the on-screen controls write intents here, and
// the sim only ever reads a sampled FrameInput. Game logic never reads a
// key, pointer, or touch event directly.
export type TapIntent = 'jab' | 'cross' | 'hook' | 'uppercut' | 'dodge';

export class IntentLayer {
  private touchMove = { x: 0, y: 0 };
  private taps = new Set<TapIntent>();
  private guardSources = new Set<string>();

  setTouchMove(x: number, y: number): void {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  tap(intent: TapIntent): void {
    this.taps.add(intent);
  }

  setGuard(source: string, held: boolean): void {
    if (held) this.guardSources.add(source);
    else this.guardSources.delete(source);
  }

  clearAll(): void {
    this.touchMove = { x: 0, y: 0 };
    this.taps.clear();
    this.guardSources.clear();
  }

  // Consumes tap edges. Call exactly once per sim tick.
  sample(): FrameInput {
    let x = this.touchMove.x;
    let y = this.touchMove.y;
    const mag = Math.sqrt(x * x + y * y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    const input: FrameInput = {
      mx: Math.round(x * 100),
      my: Math.round(y * 100),
      jab: this.taps.has('jab'),
      cross: this.taps.has('cross'),
      hook: this.taps.has('hook'),
      uppercut: this.taps.has('uppercut'),
      dodge: this.taps.has('dodge'),
      guard: this.guardSources.size > 0,
    };
    this.taps.clear();
    return input;
  }
}
