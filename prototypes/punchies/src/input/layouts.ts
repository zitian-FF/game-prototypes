import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import { tune } from '../sim/tune';

export const ACTIONS = ['up', 'down', 'left', 'right', 'jab', 'cross', 'hook', 'uppercut', 'dodge', 'guard'] as const;
export type Action = typeof ACTIONS[number];
export type Profile = 'kb1' | 'kb2' | 'pad1' | 'pad2';
export type Bindings<T> = Record<Action, T[]>;
export type TouchId = 'stick' | 'main' | 'hook' | 'guard' | 'dodge' | 'uppercut';
export type TouchLayout = Record<TouchId, { x: number; y: number }>;
export interface Layouts {
  kb1: Bindings<string>; kb2: Bindings<string>;
  pad1: Bindings<number>; pad2: Bindings<number>;
  touch: TouchLayout;
}
export interface ViewRect { left: number; top: number; width: number; height: number }
export const TOUCH_IDS: TouchId[] = ['stick', 'main', 'hook', 'guard', 'dodge', 'uppercut'];
export const TOUCH_RADII: Record<TouchId, number> = { get stick() { return tune.input.joystickRadius; }, main: 58, hook: 28, guard: 28, dodge: 26, uppercut: 32 };
export const TOUCH_SLOP = 8;
export const TRIGGER_THRESHOLD = .4;
export const PAD_CHOICES = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15];
const keyboard1: Bindings<string> = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jab: ['KeyJ'], cross: ['KeyK'], hook: ['KeyL'], uppercut: ['KeyI'], dodge: ['Space'], guard: ['ShiftLeft', 'ShiftRight'] };
const keyboard2: Bindings<string> = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], jab: ['Numpad1'], cross: ['Numpad2'], hook: ['Numpad3'], uppercut: ['Numpad5'], dodge: ['Numpad0'], guard: ['NumpadEnter'] };
const controller: Bindings<number> = { up: [12], down: [13], left: [14], right: [15], jab: [2], cross: [3], hook: [1], uppercut: [4, 6], dodge: [0], guard: [5, 7] };
export function defaultTouch(): TouchLayout {
  const point = (x: number, y: number) => ({ x: x / 844, y: y / 390 });
  return { stick: point(110, 300), main: point(752, 300), hook: point(652, 318), guard: point(668, 236), dodge: point(722, 190), uppercut: point(794, 184) };
}
export function defaults(): Layouts {
  return { kb1: structuredClone(keyboard1), kb2: structuredClone(keyboard2), pad1: structuredClone(controller), pad2: structuredClone(controller), touch: defaultTouch() };
}
export function validCode(code: unknown): code is string {
  return typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Space|Numpad(Enter|Add|Subtract|Multiply|Divide|Decimal)|Backspace|Tab|CapsLock|Bracket(Left|Right)|Semicolon|Quote|Backquote|Backslash|Comma|Period|Slash|Minus|Equal)$/.test(code);
}
// Profiles repair independently, but a damaged profile repairs atomically: no lost actions.
function validateBindings<T extends string | number>(raw: unknown, fallback: Bindings<T>, valid: (v: unknown) => boolean): Bindings<T> {
  if (!raw || typeof raw !== 'object') return structuredClone(fallback);
  const seen = new Set<T>();
  const out = {} as Bindings<T>;
  for (const action of ACTIONS) {
    const values = (raw as Bindings<T>)[action];
    if (!Array.isArray(values) || values.length < 1 || values.length > 2) return structuredClone(fallback);
    for (const value of values) {
      if (!valid(value) || seen.has(value)) return structuredClone(fallback);
      seen.add(value);
    }
    out[action] = [...values];
  }
  return out;
}
export function resolveTouch(layout: TouchLayout, view: ViewRect) {
  return Object.fromEntries(TOUCH_IDS.map(id => [id, { x: view.left + layout[id].x * view.width, y: view.top + layout[id].y * view.height, r: TOUCH_RADII[id] }])) as Record<TouchId, { x: number; y: number; r: number }>;
}
export function touchValid(layout: TouchLayout, view: ViewRect): boolean {
  const resolved = resolveTouch(layout, view);
  for (const id of TOUCH_IDS) {
    const p = resolved[id], margin = p.r + TOUCH_SLOP;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < view.left + margin || p.x > view.left + view.width - margin || p.y < view.top + 84 + margin || p.y > view.top + view.height - margin) return false;
    // The floating stick retains its left-side activation zone.
    if (id === 'stick' && p.x + margin > view.left + view.width * .45) return false;
    if (id !== 'stick' && p.x - margin < view.left + view.width * .45) return false;
  }
  for (let i = 0; i < TOUCH_IDS.length; i++) for (let j = i + 1; j < TOUCH_IDS.length; j++) {
    const a = resolved[TOUCH_IDS[i]], b = resolved[TOUCH_IDS[j]];
    // Defaults have small overlapping touch slop; drawn discs must stay separated.
    if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 4) return false;
  }
  return true;
}
export function safeTouch(raw: unknown, view: ViewRect): TouchLayout {
  if (raw && typeof raw === 'object' && TOUCH_IDS.every(id => {
    const p = (raw as TouchLayout)[id]; return p && typeof p.x === 'number' && typeof p.y === 'number' && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  }) && touchValid(raw as TouchLayout, view)) return structuredClone(raw as TouchLayout);
  return defaultTouch();
}
export function validateLayouts(raw: unknown): Layouts {
  const out = defaults(), value = raw as Partial<Layouts> | null;
  if (!value || typeof value !== 'object') return out;
  out.kb1 = validateBindings(value.kb1, out.kb1, validCode);
  out.kb2 = validateBindings(value.kb2, out.kb2, validCode);
  for (const id of ['pad1', 'pad2'] as const) out[id] = validateBindings(value[id], out[id], v => typeof v === 'number' && PAD_CHOICES.includes(v));
  out.touch = safeTouch(value.touch, { left: 0, top: 0, width: 844, height: 390 });
  return out;
}
let cachedRaw: string | null | undefined;
let cached = defaults();
export function loadLayouts(): Layouts {
  const raw = store.getItem(KEYS.localInputs);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try { cached = validateLayouts(JSON.parse(raw ?? '{}')?.layouts); } catch { cached = defaults(); }
  }
  return structuredClone(cached);
}
export function saveLayouts(layouts: Layouts): void {
  let value: Record<string, unknown> = {};
  try { const raw = JSON.parse(store.getItem(KEYS.localInputs) ?? '{}'); if (raw && typeof raw === 'object' && !Array.isArray(raw)) value = raw; } catch { /* repaired below */ }
  store.setItem(KEYS.localInputs, JSON.stringify({ ...value, layouts: validateLayouts(layouts) }));
}
export function hitTouch(layout: TouchLayout, view: ViewRect, x: number, y: number, shown: ReadonlySet<string> | null = null): Exclude<Action, 'up' | 'down' | 'left' | 'right'> | null {
  const p = resolveTouch(layout, view);
  for (const id of ['hook', 'guard', 'dodge', 'uppercut'] as const) if ((!shown || shown.has(id)) && Math.hypot(x - p[id].x, y - p[id].y) <= p[id].r + TOUCH_SLOP) return id;
  if (Math.hypot(x - p.main.x, y - p.main.y) > p.main.r + TOUCH_SLOP) return null;
  const half = x < p.main.x ? 'jab' : 'cross';
  return !shown || shown.has(half) ? half : null;
}
/** Reject duplicates without destroying another action or its alternate binding. */
export function assignBinding<T>(bindings: Bindings<T>, action: Action, value: T): 'duplicate' | null {
  if (ACTIONS.some(a => a !== action && bindings[a].includes(value))) return 'duplicate';
  bindings[action] = [value]; return null;
}
/** Seeds held buttons on entry and reconnect; only this chosen pad can capture. */
export class PadCapture {
  private previous: boolean[];
  private identity: string | null;
  constructor(pad: Gamepad | null) { this.previous = this.snapshot(pad); this.identity = pad ? `${pad.index}:${pad.id}` : null; }
  private snapshot(pad: Gamepad | null): boolean[] { return pad?.buttons.map(b => b.pressed || b.value > TRIGGER_THRESHOLD) ?? []; }
  poll(pad: Gamepad | null): number | 'cancel' | null {
    const next = this.snapshot(pad), identity = pad ? `${pad.index}:${pad.id}` : null;
    const edge = identity === this.identity ? [8, 9].some(n => next[n] && !this.previous[n]) ? 'cancel' : PAD_CHOICES.find(n => next[n] && !this.previous[n]) ?? null : null;
    this.previous = next; this.identity = identity; return edge;
  }
}

export class LayoutDraft {
  readonly value = loadLayouts();
  private closed = false;
  constructor(readonly profile: Profile | 'touch') {}
  reset(): void { if (!this.closed) Object.assign(this.value, { [this.profile]: defaults()[this.profile] }); }
  cancel(): void { this.closed = true; }
  save(): boolean {
    if (this.closed) return false;
    if (this.profile === 'touch' && !touchValid(this.value.touch, { left: 0, top: 0, width: 844, height: 390 })) return false;
    saveLayouts({ ...loadLayouts(), [this.profile]: this.value[this.profile] });
    this.closed = true; return true;
  }
}
