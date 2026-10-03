import { isCharId, type CharId } from './character';

// Last character picks, remembered on this device (one versioned
// localStorage key, see root CLAUDE.md "Persistence").
const KEY = 'punchies:chars:v1';

export interface CharPrefs {
  p1: CharId;
  p2: CharId;
  ai: CharId;
}

const DEFAULTS: CharPrefs = { p1: 'marco', p2: 'marco', ai: 'marco' };

export function loadCharPrefs(): CharPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return {
      p1: isCharId(v.p1) ? v.p1 : DEFAULTS.p1,
      p2: isCharId(v.p2) ? v.p2 : DEFAULTS.p2,
      ai: isCharId(v.ai) ? v.ai : DEFAULTS.ai,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveCharPrefs(p: Partial<CharPrefs>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadCharPrefs(), ...p }));
  } catch {
    /* storage unavailable: picks just aren't remembered */
  }
}
