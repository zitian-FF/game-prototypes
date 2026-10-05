// The only place that reads keys, the pointer or the wheel. Scenes read intents.
//   move      pan the camera (held keys, or dragging the map)
//   zoom      step the camera zoom
//   primary   select / press (a click)
//   secondary give an order at the pointer (right click)
//   pause     back out: close panels, clear the selection
//   home      pan the camera to your own HQ
// Plus text input for the lobby fields, which is a device stream rather than a game action.

export type IntentEvent =
  | { type: 'primary'; x: number; y: number }
  | { type: 'secondary'; x: number; y: number }
  | { type: 'pause' }
  | { type: 'zoom'; steps: number; x: number; y: number }
  /** Two fingers: scale by factor about the midpoint, which also moved from (px, py) to (x, y). */
  | { type: 'pinch'; factor: number; x: number; y: number; px: number; py: number }
  | { type: 'home' }
  | { type: 'drag'; dx: number; dy: number; startX: number; startY: number }
  | { type: 'text'; char: string }
  | { type: 'backspace' }
  | { type: 'submit' };

const DRAG_THRESHOLD = 5;
/** Holding a finger still this long gives the secondary order (there is no right click on a phone). */
const LONG_PRESS_MS = 450;

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
  /** True on a phone or tablet: set from the pointer type, so a laptop with a touch screen switches on first touch. */
  touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  /** Logical pixels are CSS pixels divided by this (the responsive UI scale). */
  scale = 1;
  private down: { x: number; y: number; lastX: number; lastY: number; moved: boolean; button: number; pressed: boolean; timer: number } | null = null;
  private fingers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };
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
    return { x: (e.clientX - r.left) / this.scale, y: (e.clientY - r.top) / this.scale };
  }

  private onDown(e: PointerEvent): void {
    const p = this.local(e);
    this.pointer = p;
    if (e.pointerType === 'touch') {
      this.touch = true;
      this.inside = true;
      this.fingers.set(e.pointerId, p);
      if (this.fingers.size >= 2) {
        // A second finger turns the gesture into a pinch: drop the tap and the long press.
        this.cancelDown();
        this.pinchDist = this.fingerSpread();
        this.pinchMid = this.fingerMid();
        return;
      }
    }
    this.cancelDown();
    const timer = e.pointerType === 'touch' ? window.setTimeout(() => this.longPress(), LONG_PRESS_MS) : 0;
    this.down = { x: p.x, y: p.y, lastX: p.x, lastY: p.y, moved: false, button: e.button, pressed: false, timer };
  }

  private cancelDown(): void {
    if (this.down) window.clearTimeout(this.down.timer);
    this.down = null;
  }

  private longPress(): void {
    const d = this.down;
    if (!d || d.moved) return;
    d.pressed = true;
    this.queue.push({ type: 'secondary', x: d.x, y: d.y });
  }

  private fingerMid(): { x: number; y: number } {
    const [a, b] = [...this.fingers.values()];
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
  }

  private fingerSpread(): number {
    const [a, b] = [...this.fingers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onMove(e: PointerEvent): void {
    const p = this.local(e);
    this.pointer = p;
    this.inside = p.x >= 0 && p.y >= 0 && p.x <= this.canvas!.clientWidth / this.scale && p.y <= this.canvas!.clientHeight / this.scale;
    if (e.pointerType === 'touch' && this.fingers.has(e.pointerId)) {
      this.fingers.set(e.pointerId, p);
      if (this.fingers.size >= 2) {
        const spread = this.fingerSpread();
        const mid = this.fingerMid();
        if (this.pinchDist > 0 && spread > 0) {
          this.queue.push({ type: 'pinch', factor: spread / this.pinchDist, x: mid.x, y: mid.y, px: this.pinchMid.x, py: this.pinchMid.y });
        }
        this.pinchDist = spread;
        this.pinchMid = mid;
        return;
      }
    }
    const d = this.down;
    if (!d) return;
    if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > DRAG_THRESHOLD) {
      d.moved = true;
      window.clearTimeout(d.timer);
    }
    if (d.moved) {
      this.queue.push({ type: 'drag', dx: p.x - d.lastX, dy: p.y - d.lastY, startX: d.x, startY: d.y });
    }
    d.lastX = p.x;
    d.lastY = p.y;
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.fingers.delete(e.pointerId);
      this.pinchDist = 0;
      if (this.fingers.size === 0) this.inside = false;
    }
    const d = this.down;
    this.cancelDown();
    if (!d || d.moved || d.pressed) return;
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
      if ((e.key === 'h' || e.key === 'H' || e.key === 'Home') && !this.textMode) {
        this.queue.push({ type: 'home' });
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
