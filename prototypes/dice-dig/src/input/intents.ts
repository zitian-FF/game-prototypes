import type Phaser from 'phaser';
import { IntentBus, bindKeys } from 'dig-kit';
import type { ToolId } from '../game/types';

export type Intent = { type: 'roll' } | { type: 'selectTool'; tool: ToolId };
export { IntentBus };

/** Keyboard device binding. Touch/pointer bindings live on the UI buttons. */
export function bindKeyboard(scene: Phaser.Scene, bus: IntentBus<Intent>): void {
  bindKeys<Intent>(scene, bus, {
    SPACE: { type: 'roll' },
    ENTER: { type: 'roll' },
    ONE: { type: 'selectTool', tool: 'pickaxe' },
    TWO: { type: 'selectTool', tool: 'hammer' },
    THREE: { type: 'selectTool', tool: 'c4' },
  });
}
