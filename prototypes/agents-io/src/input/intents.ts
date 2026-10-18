import type Phaser from 'phaser';
import { IntentBus, bindKeys } from 'dig-kit';
import type { Kind, ModelId, NodeRef, WordId } from '../game/content';

export type Intent =
  | { type: 'select'; ref: NodeRef | null }
  | { type: 'selectWire'; index: number }
  /** A click on an empty cell of the blueprint, in board pixels. */
  | { type: 'cell'; bx: number; by: number }
  | { type: 'place'; model: ModelId }
  /** Drop a dragged agent; bx, by is where its top-left corner ended up, in board pixels. */
  | { type: 'move'; id: NodeRef; bx: number; by: number }
  | { type: 'remove'; id: NodeRef }
  | { type: 'delete' }
  | { type: 'word'; word: WordId }
  /** Wire the `kind` output port of `from` to the `kind` input port of `to`. */
  | { type: 'wire'; from: NodeRef; to: NodeRef; kind: Kind }
  | { type: 'run' }
  | { type: 'level'; index: number }
  | { type: 'clear' }
  | { type: 'closeResult' }
  | { type: 'escape' }
  // View intents: handled by the scene, not by the game rules.
  | { type: 'zoom'; factor: number; sx: number; sy: number }
  | { type: 'zoomStep'; dir: 1 | -1 }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'fit' };

export { IntentBus };

/** Keyboard device binding: Space runs, Escape deselects, Delete removes, F frames the network. */
export function bindDesktopKeys(scene: Phaser.Scene, bus: IntentBus<Intent>): void {
  bindKeys<Intent>(scene, bus, {
    SPACE: { type: 'run' },
    ESC: { type: 'escape' },
    DELETE: { type: 'delete' },
    BACKSPACE: { type: 'delete' },
    F: { type: 'fit' },
  });
}

/** Pointer device binding for buttons, chips and cards: a press emits the intent. */
export function bindTap(obj: Phaser.GameObjects.GameObject, bus: IntentBus<Intent>, intent: Intent): void {
  obj.setInteractive({ useHandCursor: true });
  obj.on('pointerdown', () => bus.emit(intent));
}

export type BoardHit =
  /** An output port of a node, of the given wire type. */
  | { kind: 'port'; ref: NodeRef; portKind: Kind }
  | { kind: 'node'; ref: NodeRef }
  | { kind: 'wire'; index: number }
  | { kind: 'empty'; inBoard: boolean };

/** Live feedback while a pointer gesture is in progress (null when it ends). */
export type Feedback =
  | { kind: 'wire'; from: NodeRef; wireKind: Kind; bx: number; by: number }
  | { kind: 'move'; id: NodeRef; bx: number; by: number }
  | { kind: 'hover'; bx: number; by: number }
  | null;

export interface BlueprintApi {
  /** Is this position (logical screen pixels) over the blueprint, and not over one of its controls? */
  over(sx: number, sy: number): boolean;
  toBoard(sx: number, sy: number): { x: number; y: number };
  hit(bx: number, by: number): BoardHit;
  /** Top-left of a node in board pixels, to keep the grab point while dragging. */
  originOf(ref: NodeRef): { x: number; y: number };
  feedback(f: Feedback): void;
}

/**
 * Pointer device binding for the blueprint.
 *  - press an output port and drag onto a node: wire (the wire carries that port's type)
 *  - press an agent and drag: move it (snaps to the grid on release)
 *  - click an empty cell: choose a spot for a new agent
 *  - click a wire: select it
 *  - drag empty space, or press the middle or right button and drag: pan
 *  - wheel: zoom around the pointer
 */
export function bindBlueprintPointer(scene: Phaser.Scene, bus: IntentBus<Intent>, api: BlueprintApi): void {
  type Mode = 'none' | 'wire' | 'node' | 'move' | 'wireClick' | 'empty' | 'pan';
  let mode: Mode = 'none';
  let start = { x: 0, y: 0 };
  let last = { x: 0, y: 0 };
  let moved = false;
  let from: NodeRef = '';
  let fromKind: Kind = 'text';
  let grab = { x: 0, y: 0 };
  let inBoard = false;
  let wireIndex = -1;
  const screen = (p: Phaser.Input.Pointer) => scene.cameras.main.getWorldPoint(p.x, p.y);
  scene.input.mouse?.disableContextMenu();

  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const s = screen(p);
    if (!api.over(s.x, s.y)) return;
    start = { x: s.x, y: s.y };
    last = start;
    moved = false;
    if (p.button === 1 || p.button === 2) {
      mode = 'pan';
      return;
    }
    const b = api.toBoard(s.x, s.y);
    const h = api.hit(b.x, b.y);
    if (h.kind === 'port') {
      mode = 'wire';
      from = h.ref;
      fromKind = h.portKind;
    } else if (h.kind === 'node') {
      from = h.ref;
      bus.emit({ type: 'select', ref: h.ref });
      if (h.ref === 'in' || h.ref === 'out') mode = 'node';
      else {
        mode = 'move';
        const o = api.originOf(h.ref);
        grab = { x: b.x - o.x, y: b.y - o.y };
      }
    } else if (h.kind === 'wire') {
      mode = 'wireClick';
      wireIndex = h.index;
    } else {
      mode = 'empty';
      inBoard = h.inBoard;
    }
  });

  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    const s = screen(p);
    if (mode === 'none' || !p.isDown) {
      if (api.over(s.x, s.y)) {
        const b = api.toBoard(s.x, s.y);
        api.feedback({ kind: 'hover', bx: b.x, by: b.y });
      } else api.feedback(null);
      return;
    }
    if (!moved && Math.hypot(s.x - start.x, s.y - start.y) > 4) moved = true;
    const b = api.toBoard(s.x, s.y);
    if (mode === 'empty' && moved) mode = 'pan';
    if (mode === 'pan') {
      if (moved || p.button !== 0) bus.emit({ type: 'pan', dx: s.x - last.x, dy: s.y - last.y });
      last = { x: s.x, y: s.y };
    } else if (mode === 'wire' && moved) api.feedback({ kind: 'wire', from, wireKind: fromKind, bx: b.x, by: b.y });
    else if (mode === 'move' && moved) api.feedback({ kind: 'move', id: from, bx: b.x - grab.x, by: b.y - grab.y });
  });

  const end = (p: Phaser.Input.Pointer) => {
    if (mode === 'none') return;
    const s = screen(p);
    const b = api.toBoard(s.x, s.y);
    if (mode === 'wire' && moved) {
      const h = api.hit(b.x, b.y);
      if ((h.kind === 'node' || h.kind === 'port') && h.ref !== from) bus.emit({ type: 'wire', from, to: h.ref, kind: fromKind });
    } else if (mode === 'move' && moved) bus.emit({ type: 'move', id: from, bx: b.x - grab.x, by: b.y - grab.y });
    else if (mode === 'wireClick' && !moved) bus.emit({ type: 'selectWire', index: wireIndex });
    else if (mode === 'empty' && !moved) bus.emit(inBoard ? { type: 'cell', bx: b.x, by: b.y } : { type: 'select', ref: null });
    mode = 'none';
    api.feedback(null);
  };
  scene.input.on('pointerup', end);
  scene.input.on('pointerupoutside', end);

  scene.input.on('wheel', (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
    const s = screen(p);
    if (!api.over(s.x, s.y)) return;
    bus.emit({ type: 'zoom', factor: dy > 0 ? 1 / 1.12 : 1.12, sx: s.x, sy: s.y });
  });
}
