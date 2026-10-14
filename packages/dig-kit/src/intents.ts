import type Phaser from 'phaser';

// Intent layer: devices bind to intents, game logic only reads intents.
export class IntentBus<I> {
  private listeners: ((intent: I) => void)[] = [];

  on(fn: (intent: I) => void): void {
    this.listeners.push(fn);
  }

  emit(intent: I): void {
    for (const fn of this.listeners) fn(intent);
  }
}

/** Keyboard device binding. Keys use Phaser key names, e.g. 'SPACE', 'ONE'. */
export function bindKeys<I>(scene: Phaser.Scene, bus: IntentBus<I>, map: Record<string, I>): void {
  const kb = scene.input.keyboard;
  if (!kb) return;
  for (const [key, intent] of Object.entries(map)) kb.on(`keydown-${key}`, () => bus.emit(intent));
}
