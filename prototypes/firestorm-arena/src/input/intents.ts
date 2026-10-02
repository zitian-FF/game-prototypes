// The only place that reads keys, the pointer or the wheel. Scenes read intents.
//   move      pan the camera (held keys, or dragging the map)
//   zoom      step the camera zoom
//   primary   select / press (a click)
//   secondary give an order at the pointer (right click)
//   pause     back out: close panels, clear the selection
// Plus text input for the lobby fields, which is a device stream rather than a game action.

export type IntentEvent =
  | { type: 'primary'; x: number; y: number }
  | { type: 'secondary'; x: number; y: number }
  | { type: 'pause' }
  | { type: 'zoom'; steps: number; x: number; y: number }
  | { type: 'drag'; dx: number; dy: number; startX: number; startY: number }
  | { type: 'text'; char: string }
  | { type: 'backspace' }
  | { type: 'submit' };

const DRAG_THRESHOLD = 5;

export class Intents {
  /** Pan direction from held keys, each axis -1..1. */
  move = { x: 0, y: 0 };
  /** Pointer position in logical (CSS) pixels over the canvas. */
  pointer = { x: -1, y: -1 };
  /** True while the pointer is inside the canvas. */
  inside = false;
  /** When true, letters go to a text field instead of the move intent. */
  textMode = false;
  private queue: IntentEvent[] = [];
  private held = new Set<string>();
  private down: { x: number; y: number; moved: boolean; button: number } | null = null;
  private canvas: HTMLElement | null = null;

  attach(canvas: HTMLElement): void {
    if (this.canvas) return;
    this.canvas = canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointerleave', () => (this.inside = false));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = this.local(e);
        this.queue.push({ type: 'zoom', steps: -Math.sign(e.deltaY), x: p.x, y: p.y });
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.refreshMove();
    });
  }

  /** Events since the last call, oldest first. */
  drain(): IntentEvent[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  private local(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent): void {
    const p = this.local(e);
    this.pointer = p;
    this.down = { x: p.x, y: p.y, moved: false, button: e.button };
  }

  private onMove(e: PointerEvent): void {
    const p = this.local(e);
    this.pointer = p;
    this.inside = p.x >= 0 && p.y >= 0 && p.x <= this.canvas!.clientWidth && p.y <= this.canvas!.clientHeight;
    const d = this.down;
    if (!d) return;
    if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > DRAG_THRESHOLD) d.moved = true;
    if (d.moved) {
      this.queue.push({ type: 'drag', dx: e.movementX, dy: e.movementY, startX: d.x, startY: d.y });
    }
  }

  private onUp(e: PointerEvent): void {
    const d = this.down;
    this.down = null;
    if (!d || d.moved) return;
    const p = this.local(e);
    if (d.button === 0) this.queue.push({ type: 'primary', x: p.x, y: p.y });
    else if (d.button === 2) this.queue.push({ type: 'secondary', x: p.x, y: p.y });
  }

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isDown) {
      if (e.key === 'Escape') {
        this.queue.push({ type: 'pause' });
        return;
      }
      if (e.key === 'Enter') {
        this.queue.push({ type: 'submit' });
        return;
      }
      if (e.key === 'Backspace') {
        if (this.textMode) {
          e.preventDefault();
          this.queue.push({ type: 'backspace' });
        }
        return;
      }
      if (this.textMode && e.key.length === 1) {
        e.preventDefault();
        this.queue.push({ type: 'text', char: e.key });
        return;
      }
      if (e.key === '+' || e.key === '=') this.queue.push({ type: 'zoom', steps: 1, x: -1, y: -1 });
      if (e.key === '-' || e.key === '_') this.queue.push({ type: 'zoom', steps: -1, x: -1, y: -1 });
    }
    const k = e.key.toLowerCase();
    const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    if (moveKeys.includes(k) && !this.textMode) {
      if (isDown) {
        this.held.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
      } else this.held.delete(k);
      this.refreshMove();
    }
  }

  private refreshMove(): void {
    const h = (a: string, b: string) => (this.held.has(a) || this.held.has(b) ? 1 : 0);
    this.move = { x: h('d', 'arrowright') - h('a', 'arrowleft'), y: h('s', 'arrowdown') - h('w', 'arrowup') };
  }
}

export const intents = new Intents();
