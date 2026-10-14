import Phaser from 'phaser';
import type { ToolId } from '../game/types';

// Intent layer: devices bind to intents, game logic only reads intents.
export type Intent = { type: 'roll' } | { type: 'selectTool'; tool: ToolId };
type Listener = (intent: Intent) => void;

export class IntentBus {
  private listeners: Listener[] = [];

  on(fn: Listener): void {
    this.listeners.push(fn);
  }

  emit(intent: Intent): void {
    for (const fn of this.listeners) fn(intent);
  }
}

/** Keyboard device binding. Touch/pointer bindings live on the UI buttons. */
export function bindKeyboard(scene: Phaser.Scene, bus: IntentBus): void {
  const kb = scene.input.keyboard;
  if (!kb) return;
  const roll = () => bus.emit({ type: 'roll' });
  kb.on('keydown-SPACE', roll);
  kb.on('keydown-ENTER', roll);
  kb.on('keydown-ONE', () => bus.emit({ type: 'selectTool', tool: 'pickaxe' }));
  kb.on('keydown-TWO', () => bus.emit({ type: 'selectTool', tool: 'hammer' }));
  kb.on('keydown-THREE', () => bus.emit({ type: 'selectTool', tool: 'c4' }));
}
