import type { FrameInput } from '../sim/types';
import { NEUTRAL_INPUT } from '../sim/types';

// Keyboard and gamepad bindings for the intent layer. Game logic never reads
// these directly: a scene asks for a FrameInput from a source and feeds it to
// the sim like any other input.
//
// Fixed layouts:
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

interface KeyMap {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  jab: string[];
  cross: string[];
  hook: string[];
  uppercut: string[];
  dodge: string[];
  guard: string[];
}

const KEYS: Record<'kb1' | 'kb2', KeyMap> = {
  kb1: {
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    jab: ['KeyJ'],
    cross: ['KeyK'],
    hook: ['KeyL'],
    uppercut: ['KeyI'],
    dodge: ['Space'],
    guard: ['ShiftLeft', 'ShiftRight'],
  },
  kb2: {
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    jab: ['Numpad1'],
    cross: ['Numpad2'],
    hook: ['Numpad3'],
    uppercut: ['Numpad5'],
    dodge: ['Numpad0'],
    guard: ['NumpadEnter'],
  },
};

// Standard gamepad mapping button indices.
const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, up: 12, down: 13, left: 14, right: 15 };
const STICK_DEADZONE = 0.25;
const TRIGGER_THRESHOLD = 0.4;

const GAME_KEYS = new Set(Object.values(KEYS).flatMap((m) => Object.values(m).flat()));

class DeviceHub {
  private down = new Set<string>();
  private edges = new Set<string>();
  private padPrev: boolean[][] = [[], []];
  private padEdges: Set<number>[] = [new Set(), new Set()];
  // Which kind of device the local player touched last (drives hiding the
  // on-screen controls).
  lastDevice: DeviceKind = 'touch';

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault(); // Space/arrows would scroll the page
      if (!this.down.has(e.code)) this.edges.add(e.code);
      this.down.add(e.code);
      this.lastDevice = 'keyboard';
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') this.lastDevice = 'touch';
      },
      { capture: true, passive: true },
    );
  }

  private pads(): (Gamepad | null)[] {
    try {
      return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected);
    } catch {
      return [];
    }
  }

  connectedPads(): number {
    return this.pads().length;
  }

  // Call once per rendered frame: records gamepad button presses so a tap
  // between sim ticks is never lost.
  poll(): void {
    const pads = this.pads();
    for (let i = 0; i < 2; i++) {
      const p = pads[i];
      if (!p) continue;
      p.buttons.forEach((b, idx) => {
        const pressed = b.pressed || b.value > TRIGGER_THRESHOLD;
        if (pressed && !this.padPrev[i][idx]) {
          this.padEdges[i].add(idx);
          this.lastDevice = 'gamepad';
        }
        this.padPrev[i][idx] = pressed;
      });
      if (Math.abs(p.axes[0] ?? 0) > 0.5 || Math.abs(p.axes[1] ?? 0) > 0.5) this.lastDevice = 'gamepad';
    }
  }

  // FrameInput for one keyboard/gamepad source; consumes its tap edges.
  sample(source: Exclude<InputSource, 'touch'>): FrameInput {
    return source === 'kb1' || source === 'kb2' ? this.sampleKeys(KEYS[source]) : this.samplePad(source === 'pad1' ? 0 : 1);
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
    const held = (idx: number) => this.padPrev[i][idx] === true;
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
    if (held(PAD.left)) x = -1;
    if (held(PAD.right)) x = 1;
    if (held(PAD.up)) y = -1;
    if (held(PAD.down)) y = 1;
    const mag = Math.sqrt(x * x + y * y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    return {
      mx: Math.round(x * 100),
      my: Math.round(y * 100),
      jab: edge(PAD.x),
      cross: edge(PAD.y),
      hook: edge(PAD.b),
      uppercut: edge(PAD.lb, PAD.lt),
      dodge: edge(PAD.a),
      guard: held(PAD.rb) || held(PAD.rt),
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
  touch: 'TOUCH',
  kb1: 'KEYS WASD',
  kb2: 'KEYS ARROWS',
  pad1: 'CONTROLLER 1',
  pad2: 'CONTROLLER 2',
};
