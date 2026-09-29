import Phaser from 'phaser';
import type { FrameInput } from '../sim/types';

// Intent layer: devices (touch controls, keyboard) write intents here, and
// the sim only ever reads a sampled FrameInput. Game logic never reads a
// key, pointer, or touch event directly.
export type TapIntent = 'jab' | 'cross' | 'hook' | 'uppercut' | 'dodge';

export class IntentLayer {
  private touchMove = { x: 0, y: 0 };
  private keyMove = { x: 0, y: 0 };
  private taps = new Set<TapIntent>();
  private guardSources = new Set<string>();

  setTouchMove(x: number, y: number): void {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  setKeyMove(x: number, y: number): void {
    this.keyMove.x = x;
    this.keyMove.y = y;
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
    this.keyMove = { x: 0, y: 0 };
    this.taps.clear();
    this.guardSources.clear();
  }

  // Consumes tap edges. Call exactly once per sim tick.
  sample(): FrameInput {
    let x = this.touchMove.x + this.keyMove.x;
    let y = this.touchMove.y + this.keyMove.y;
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

// Desktop keyboard binding, for testing without a phone.
// WASD/arrows move, J jab, K cross, L hook, I uppercut, Space dodge,
// Shift hold guard.
export function bindKeyboard(scene: Phaser.Scene, intents: IntentLayer): () => void {
  const kb = scene.input.keyboard;
  if (!kb) return () => {};
  const K = Phaser.Input.Keyboard.KeyCodes;
  const keys = kb.addKeys({
    up: K.W,
    down: K.S,
    left: K.A,
    right: K.D,
    up2: K.UP,
    down2: K.DOWN,
    left2: K.LEFT,
    right2: K.RIGHT,
    guard: K.SHIFT,
  }) as Record<string, Phaser.Input.Keyboard.Key>;

  const taps: [number, TapIntent][] = [
    [K.J, 'jab'],
    [K.K, 'cross'],
    [K.L, 'hook'],
    [K.I, 'uppercut'],
    [K.SPACE, 'dodge'],
  ];
  for (const [code, intent] of taps) {
    kb.addKey(code).on('down', () => intents.tap(intent));
  }

  return () => {
    const x = (keys.right.isDown || keys.right2.isDown ? 1 : 0) - (keys.left.isDown || keys.left2.isDown ? 1 : 0);
    const y = (keys.down.isDown || keys.down2.isDown ? 1 : 0) - (keys.up.isDown || keys.up2.isDown ? 1 : 0);
    intents.setKeyMove(x, y);
    intents.setGuard('keyboard', keys.guard.isDown);
  };
}
