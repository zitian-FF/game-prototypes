// Devices produce intents. Neither the simulation nor scene commands read DOM events.
export type Intent = { type: 'tap' | 'hover'; x: number; y: number }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'zoom'; factor: number }
  | { type: 'key'; key: string };
export class Intents {
  private queue: Intent[] = [];
  private fingers = new Map<number, { x: number; y: number; startX: number; startY: number; moved: boolean }>();
  private cleanup: (() => void)[] = [];
  constructor(canvas: HTMLCanvasElement, dimensions: () => { w: number; h: number }) {
    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect(), d = dimensions();
      return { x: (e.clientX - r.left) * d.w / r.width, y: (e.clientY - r.top) * d.h / r.height };
    };
    const on = (target: EventTarget, event: string, cb: EventListener, options?: AddEventListenerOptions) => {
      target.addEventListener(event, cb, options); this.cleanup.push(() => target.removeEventListener(event, cb));
    };
    on(canvas, 'pointerdown', ((e: PointerEvent) => {
      const p = point(e); canvas.setPointerCapture(e.pointerId);
      this.fingers.set(e.pointerId, { ...p, startX: p.x, startY: p.y, moved: false });
      if (this.fingers.size > 1) for (const f of this.fingers.values()) f.moved = true;
    }) as EventListener);
    on(canvas, 'pointermove', ((e: PointerEvent) => {
      const p = point(e), f = this.fingers.get(e.pointerId);
      this.queue.push({ type: 'hover', ...p });
      if (!f) return;
      const other = [...this.fingers.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(f.x - other.x, f.y - other.y), after = Math.hypot(p.x - other.x, p.y - other.y);
        if (before > 5) this.queue.push({ type: 'zoom', factor: after / before });
      } else if (f.moved || Math.hypot(p.x - f.startX, p.y - f.startY) > 7) {
        f.moved = true; this.queue.push({ type: 'pan', dx: p.x - f.x, dy: p.y - f.y });
      }
      f.x = p.x; f.y = p.y;
    }) as EventListener);
    on(canvas, 'pointerup', ((e: PointerEvent) => {
      const f = this.fingers.get(e.pointerId);
      if (f && !f.moved) this.queue.push({ type: 'tap', ...point(e) });
      this.fingers.delete(e.pointerId);
    }) as EventListener);
    on(canvas, 'pointercancel', ((e: PointerEvent) => { this.fingers.delete(e.pointerId); }) as EventListener);
    on(canvas, 'wheel', ((e: WheelEvent) => { e.preventDefault(); this.queue.push({ type: 'zoom', factor: e.deltaY < 0 ? 1.12 : 1 / 1.12 }); }) as EventListener, { passive: false });
    on(window, 'keydown', ((e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ([' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
      this.queue.push({ type: 'key', key: e.key.toLowerCase() });
    }) as EventListener);
    on(canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
  }
  drain(): Intent[] { const events = this.queue; this.queue = []; return events; }
  destroy(): void { this.cleanup.forEach(fn => fn()); }
}
