import type { FrameInput } from '../sim/types';
import { t } from '../i18n';
import { NEUTRAL_INPUT } from '../sim/types';
import { loadLayouts, TRIGGER_THRESHOLD, type Bindings } from './layouts';

// Keyboard and gamepad bindings for the intent layer. Game logic never reads
// these directly: a scene asks for a FrameInput from a source and feeds it to
// the sim like any other input.
//
// Backward-compatible defaults; saved profiles are read at runtime:
//   kb1  (keyboard left):   WASD move, J jab, K cross, L hook, I uppercut,
//                           Space dodge, Shift (hold) guard
//   kb2  (keyboard right):  Arrows move, Numpad 1 jab, 2 cross, 3 hook,
//                           5 uppercut, 0 dodge, Numpad Enter (hold) guard
//   pad1 / pad2 (standard gamepad): left stick / D-pad move, X jab, Y cross,
//                           B hook, A dodge, RB/RT (hold) guard, LB/LT uppercut
//                           (PlayStation: square, triangle, circle, cross,
//                           R1/R2, L1/L2)

export type InputSource = 'touch' | 'kb1' | 'kb2' | 'pad1' | 'pad2';
export type DeviceKind = 'touch' | 'keyboard' | 'gamepad';

type KeyMap = Bindings<string>;
const STICK_DEADZONE = 0.25;
export function gameKeys(): Set<string> {
  const layouts = loadLayouts();
  return new Set([...Object.values(layouts.kb1).flat(), ...Object.values(layouts.kb2).flat()]);
}

export class DeviceHub {
  private down = new Set<string>();
  private edges = new Set<string>();
  private padPrev: boolean[][] = [[], []];
  private padEdges: Set<number>[] = [new Set(), new Set()];
  // Which kind of device the local player touched last (drives hiding the
  // on-screen controls).
  lastDevice: DeviceKind = 'touch';

  private suppressed = 0;
  private identities: (string | null)[] = [null, null];
  private blockedKeys = new Set<string>();
  private blockedPads: Set<number>[] = [new Set(), new Set()];
  lastSource: InputSource = 'touch';
  blockKey(code: string): void { this.blockedKeys.add(code); }
  private blockHeldPads(): void {
    for (let i = 0; i < 2; i++) this.pads()[i]?.buttons.forEach((b, n) => {
      if (b.pressed || b.value > TRIGGER_THRESHOLD) this.blockedPads[i].add(n);
    });
  }
  suspend(): () => void {
    this.down.forEach(code => this.blockedKeys.add(code));
    this.blockHeldPads();
    this.suppressed++; this.clear();
    let released = false;
    return () => { if (released) return; released = true; this.suppressed--; this.blockHeldPads(); this.clear(); };
  }
  pad(source: 'pad1' | 'pad2'): Gamepad | null { return this.pads()[source === 'pad1' ? 0 : 1] ?? null; }
  constructor() {
    window.addEventListener('keydown', (e) => {
      if (this.suppressed) { this.blockedKeys.add(e.code); return; }
      if (this.blockedKeys.has(e.code) || (e.repeat && !this.down.has(e.code)) || !gameKeys().has(e.code)) return;
      e.preventDefault(); // Space/arrows would scroll the page
      if (!this.down.has(e.code)) this.edges.add(e.code);
      this.down.add(e.code);
      this.lastDevice = 'keyboard';
      this.lastSource = Object.values(loadLayouts().kb2).some(c => c.includes(e.code)) ? 'kb2' : 'kb1';
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); this.blockedKeys.delete(e.code); });
    window.addEventListener('blur', () => { this.clear(); this.padPrev = [[], []]; this.identities = [null, null]; this.blockedKeys.clear(); });
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') { this.lastDevice = 'touch'; this.lastSource = 'touch'; }
      },
      { capture: true, passive: true },
    );
  }

  private pads(): (Gamepad | null)[] {
    try {
      return Array.from(navigator.getGamepads?.() ?? []).map(p => p?.connected ? p : null);
    } catch {
      return [];
    }
  }

  connectedPads(): number {
    return this.pads().filter(Boolean).length;
  }

  // Call once per rendered frame: records gamepad button presses so a tap
  // between sim ticks is never lost.
  poll(): void {
    const pads = this.pads();
    for (let i = 0; i < 2; i++) {
      const p = pads[i];
      if (!p) { this.padPrev[i] = []; this.padEdges[i].clear(); this.blockedPads[i].clear(); this.identities[i] = null; continue; }
      const identity = p.index + ':' + p.id;
      const connected = this.identities[i] !== identity;
      this.identities[i] = identity;
      if (connected) this.padEdges[i].clear();
      p.buttons.forEach((b, idx) => {
        const pressed = b.pressed || b.value > TRIGGER_THRESHOLD;
        if (!pressed) this.blockedPads[i].delete(idx);
        else if (this.suppressed || connected) this.blockedPads[i].add(idx);
        if (!this.suppressed && !connected && !this.blockedPads[i].has(idx) && pressed && !this.padPrev[i][idx]) {
          this.padEdges[i].add(idx);
          this.lastDevice = 'gamepad';
          this.lastSource = i === 0 ? 'pad1' : 'pad2';
        }
        this.padPrev[i][idx] = pressed;
      });
      if (!this.suppressed && (Math.abs(p.axes[0] ?? 0) > 0.5 || Math.abs(p.axes[1] ?? 0) > 0.5)) { this.lastDevice = 'gamepad'; this.lastSource = i === 0 ? 'pad1' : 'pad2'; }
    }
  }

  // FrameInput for one keyboard/gamepad source; consumes its tap edges.
  sample(source: Exclude<InputSource, 'touch'>): FrameInput {
    if (this.suppressed) return { ...NEUTRAL_INPUT };
    return source === 'kb1' || source === 'kb2' ? this.sampleKeys(loadLayouts()[source]) : this.samplePad(source === 'pad1' ? 0 : 1);
  }

  private sampleKeys(m: KeyMap): FrameInput {
    const any = (codes: string[]) => codes.some((c) => this.down.has(c));
    const edge = (codes: string[]) => {
      let hit = false;
      for (const c of codes) if (this.edges.delete(c)) hit = true;
      return hit;
    };
    let x = (any(m.right) ? 1 : 0) - (any(m.left) ? 1 : 0);
    let y = (any(m.down) ? 1 : 0) - (any(m.up) ? 1 : 0);
    if (x && y) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return {
      mx: Math.round(x * 100),
      my: Math.round(y * 100),
      jab: edge(m.jab),
      cross: edge(m.cross),
      hook: edge(m.hook),
      uppercut: edge(m.uppercut),
      dodge: edge(m.dodge),
      guard: any(m.guard),
    };
  }

  private samplePad(i: number): FrameInput {
    const p = this.pads()[i];
    if (!p) return { ...NEUTRAL_INPUT };
    const m = loadLayouts()[i === 0 ? 'pad1' : 'pad2'];
    const held = (idx: number) => this.padPrev[i][idx] === true && !this.blockedPads[i].has(idx);
    const edge = (...idx: number[]) => {
      let hit = false;
      for (const b of idx) if (this.padEdges[i].delete(b)) hit = true;
      return hit;
    };
    let x = p.axes[0] ?? 0;
    let y = p.axes[1] ?? 0;
    if (Math.sqrt(x * x + y * y) < STICK_DEADZONE) {
      x = 0;
      y = 0;
    }
    if (m.left.some(held)) x = -1;
    if (m.right.some(held)) x = 1;
    if (m.up.some(held)) y = -1;
    if (m.down.some(held)) y = 1;
    const mag = Math.sqrt(x * x + y * y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    return {
      mx: Math.round(x * 100),
      my: Math.round(y * 100),
      jab: edge(...m.jab),
      cross: edge(...m.cross),
      hook: edge(...m.hook),
      uppercut: edge(...m.uppercut),
      dodge: edge(...m.dodge),
      guard: m.guard.some(held),
    };
  }

  clear(): void {
    this.down.clear();
    this.edges.clear();
    this.padEdges.forEach((s) => s.clear());
  }
}

export const devices = new DeviceHub();

export function mergeInputs(inputs: FrameInput[]): FrameInput {
  let x = 0;
  let y = 0;
  const out: FrameInput = { ...NEUTRAL_INPUT };
  for (const i of inputs) {
    x += i.mx;
    y += i.my;
    out.jab ||= i.jab;
    out.cross ||= i.cross;
    out.hook ||= i.hook;
    out.uppercut ||= i.uppercut;
    out.dodge ||= i.dodge;
    out.guard ||= i.guard;
  }
  const mag = Math.sqrt(x * x + y * y);
  if (mag > 100) {
    x = (x / mag) * 100;
    y = (y / mag) * 100;
  }
  out.mx = Math.round(x);
  out.my = Math.round(y);
  return out;
}

export const SOURCE_LABEL: Record<InputSource, string> = {
  get touch() { return t('input.touch'); },
  get kb1() { return t('layouts.keyboard_1'); },
  get kb2() { return t('layouts.keyboard_2'); },
  get pad1() { return t('input.controller_1'); },
  get pad2() { return t('input.controller_2'); },
};
