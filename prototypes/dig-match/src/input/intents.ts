import type Phaser from 'phaser';
import { IntentBus, bindKeys } from 'dig-kit';

export type Intent =
  | { type: 'tap'; idx: number }
  | { type: 'swap'; from: number; to: number }
  | { type: 'cursor'; dc: number; dr: number }
  | { type: 'confirm' };

export { IntentBus };

export interface BoardGeometry {
  x: number;
  y: number;
  cw: number;
  ch: number;
  cols: number;
  rows: number;
}

/** Keyboard device binding: arrows move a cursor (or swap when something is selected), Space selects. */
export function bindKeyboard(scene: Phaser.Scene, bus: IntentBus<Intent>): void {
  bindKeys<Intent>(scene, bus, {
    LEFT: { type: 'cursor', dc: -1, dr: 0 },
    RIGHT: { type: 'cursor', dc: 1, dr: 0 },
    UP: { type: 'cursor', dc: 0, dr: -1 },
    DOWN: { type: 'cursor', dc: 0, dr: 1 },
    SPACE: { type: 'confirm' },
    ENTER: { type: 'confirm' },
  });
}

/**
 * Pointer/touch device binding. Dragging a block toward a neighbour emits a
 * swap; a plain tap emits a tap on that cell (tap one block, then a neighbour).
 */
export function bindBoardPointer(scene: Phaser.Scene, geo: BoardGeometry, bus: IntentBus<Intent>, threshold: () => number): void {
  let downIdx = -1;
  let downX = 0;
  let downY = 0;
  let handled = false;
  const cellAt = (px: number, py: number): number => {
    const p = scene.cameras.main.getWorldPoint(px, py);
    const c = Math.floor((p.x - geo.x) / geo.cw);
    const r = Math.floor((p.y - geo.y) / geo.ch);
    return c < 0 || r < 0 || c >= geo.cols || r >= geo.rows ? -1 : r * geo.cols + c;
  };
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    downIdx = cellAt(p.x, p.y);
    const w = scene.cameras.main.getWorldPoint(p.x, p.y);
    downX = w.x;
    downY = w.y;
    handled = false;
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (!p.isDown || downIdx < 0 || handled) return;
    const w = scene.cameras.main.getWorldPoint(p.x, p.y);
    const dx = w.x - downX;
    const dy = w.y - downY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold()) return;
    const c = downIdx % geo.cols;
    const r = Math.floor(downIdx / geo.cols);
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const nc = c + (horizontal ? Math.sign(dx) : 0);
    const nr = r + (horizontal ? 0 : Math.sign(dy));
    handled = true;
    if (nc < 0 || nr < 0 || nc >= geo.cols || nr >= geo.rows) return;
    bus.emit({ type: 'swap', from: downIdx, to: nr * geo.cols + nc });
  });
  scene.input.on('pointerup', () => {
    if (!handled && downIdx >= 0) bus.emit({ type: 'tap', idx: downIdx });
    downIdx = -1;
  });
}
