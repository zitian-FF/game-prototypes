import type { InputSource } from './devices';

// Local VS input choice per player, remembered on this device (see
// "Persistence" in root CLAUDE.md: one versioned localStorage key).
const KEY = 'punchies:localInputs:v1';

export interface LocalInputs {
  p1: InputSource;
  p2: InputSource;
}

export const P1_OPTIONS: InputSource[] = ['kb1', 'pad1', 'touch', 'kb2', 'pad2'];
export const P2_OPTIONS: InputSource[] = ['pad1', 'kb2', 'pad2', 'kb1'];

const DEFAULTS: LocalInputs = { p1: 'kb1', p2: 'kb2' };

export function loadLocalInputs(): LocalInputs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw) as Partial<LocalInputs>;
    const p1 = P1_OPTIONS.includes(v.p1 as InputSource) ? (v.p1 as InputSource) : DEFAULTS.p1;
    const p2 = P2_OPTIONS.includes(v.p2 as InputSource) ? (v.p2 as InputSource) : DEFAULTS.p2;
    return { p1, p2 };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveLocalInputs(v: LocalInputs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable (private mode) */
  }
}
