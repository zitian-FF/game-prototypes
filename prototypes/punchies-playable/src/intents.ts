import type { Input } from './sim';

// Intent layer: devices bind to intents, game logic only reads intents.
export type Intent = 'jab' | 'cross';

export class Intents {
  private pending: Input = { jab: false, cross: false };

  press(intent: Intent): void {
    this.pending[intent] = true;
  }

  // Intents pressed since the last call.
  consume(): Input {
    const out = this.pending;
    this.pending = { jab: false, cross: false };
    return out;
  }
}

const KEYS: Record<string, Intent> = { KeyJ: 'jab', KeyK: 'cross' };

// Keyboard binding (bonus on desktop). Touch buttons are bound in the scene.
export function bindKeyboard(intents: Intents): void {
  window.addEventListener('keydown', (e) => {
    const intent = KEYS[e.code];
    if (intent && !e.repeat) intents.press(intent);
  });
}
