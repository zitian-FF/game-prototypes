import type Phaser from 'phaser';
import { IntentBus, bindKeys } from 'dig-kit';
import type { ModelId, NodeRef, SlotId, WordId } from '../game/content';

export type Intent =
  | { type: 'select'; ref: NodeRef | null }
  | { type: 'place'; slot: SlotId; model: ModelId }
  | { type: 'remove'; slot: SlotId }
  | { type: 'word'; word: WordId }
  | { type: 'cycleOut' }
  | { type: 'wire'; from: NodeRef; to: NodeRef }
  | { type: 'run' }
  | { type: 'level'; index: number }
  | { type: 'clear' }
  | { type: 'closeResult' }
  | { type: 'escape' };

export { IntentBus };

/** Keyboard device binding: Space runs, Escape deselects. */
export function bindDesktopKeys(scene: Phaser.Scene, bus: IntentBus<Intent>): void {
  bindKeys<Intent>(scene, bus, { SPACE: { type: 'run' }, ESC: { type: 'escape' } });
}

/** Pointer/touch device binding for buttons, chips and cards: a press emits the intent. */
export function bindTap(obj: Phaser.GameObjects.GameObject, bus: IntentBus<Intent>, intent: Intent): void {
  obj.setInteractive({ useHandCursor: true });
  obj.on('pointerdown', () => bus.emit(intent));
}

/**
 * Pointer/touch device binding for the network: a tap on a node selects it, a drag from one
 * node to another wires them. `locate` turns a world position into a node, or null.
 * `rubber` receives the drag line so the scene can draw it (null when the drag ends).
 */
export function bindNetworkPointer(
  scene: Phaser.Scene,
  bus: IntentBus<Intent>,
  locate: (x: number, y: number) => NodeRef | null,
  canDrag: (ref: NodeRef) => boolean,
  inNetwork: (x: number, y: number) => boolean,
  rubber: (from: NodeRef | null, x: number, y: number) => void,
): void {
  let from: NodeRef | null = null;
  let moved = false;
  const world = (p: Phaser.Input.Pointer) => scene.cameras.main.getWorldPoint(p.x, p.y);
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const w = world(p);
    const hit = locate(w.x, w.y);
    from = hit && canDrag(hit) ? hit : null;
    moved = false;
    if (hit && !from) bus.emit({ type: 'select', ref: hit });
    else if (!hit && inNetwork(w.x, w.y)) bus.emit({ type: 'select', ref: null });
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (!from || !p.isDown) return;
    const w = world(p);
    if (locate(w.x, w.y) !== from) moved = true;
    if (moved) rubber(from, w.x, w.y);
  });
  const end = (p: Phaser.Input.Pointer) => {
    if (!from) return;
    const w = world(p);
    const to = locate(w.x, w.y);
    if (to && to !== from) bus.emit({ type: 'wire', from, to });
    else if (to === from) bus.emit({ type: 'select', ref: from });
    from = null;
    rubber(null, 0, 0);
  };
  scene.input.on('pointerup', end);
  scene.input.on('pointerupoutside', end);
}
