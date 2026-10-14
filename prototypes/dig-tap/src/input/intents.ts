import type Phaser from 'phaser';
import { IntentBus } from 'dig-kit';
import type { UpgradeId } from '../game/economy';

export type Intent = { type: 'tapBlock'; row: number; col: number } | { type: 'buy'; id: UpgradeId };

export { IntentBus };

/**
 * Pointer/touch device binding: a press on a block emits a tapBlock intent.
 * `locate` turns a world position into a block, or null when nothing is there.
 */
export function bindShaftPointer(
  scene: Phaser.Scene,
  bus: IntentBus<Intent>,
  locate: (x: number, y: number) => { row: number; col: number } | null,
): void {
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const w = scene.cameras.main.getWorldPoint(p.x, p.y);
    const hit = locate(w.x, w.y);
    if (hit) bus.emit({ type: 'tapBlock', ...hit });
  });
}
