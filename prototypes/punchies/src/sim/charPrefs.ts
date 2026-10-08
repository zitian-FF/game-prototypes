import { isCharId, type CharId } from './character';
import { BOT_LEVELS, type BotLevel } from './bot';

// Last character picks, remembered on this device (one versioned
// localStorage key, see root CLAUDE.md "Persistence").
const KEY = 'punchies:chars:v1';

export interface CharPrefs {
  p1: CharId;
  p2: CharId;
  ai: CharId;
  skins:Record<string,Record<string,string>>;
  // Single Player bot difficulty.
  level: BotLevel;
}

const DEFAULTS: CharPrefs = { p1: 'marco', p2: 'marco', ai: 'marco', level: 'easy', skins:{} };

export function loadCharPrefs(): CharPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return {
      skins: sanitizeSkins(v.skins),
      p1: isCharId(v.p1) ? v.p1 : DEFAULTS.p1,
      p2: isCharId(v.p2) ? v.p2 : DEFAULTS.p2,
      ai: isCharId(v.ai) ? v.ai : DEFAULTS.ai,
      level: (BOT_LEVELS as unknown[]).includes(v.level) ? (v.level as BotLevel) : DEFAULTS.level,
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

function sanitizeSkins(value:unknown):CharPrefs['skins'] {
  const result:CharPrefs['skins']={};
  if(!value||typeof value!=='object'||Array.isArray(value))return result;
  for(const slot of ['p1','p2','ai']) {
    const map=(value as Record<string,unknown>)[slot];
    if(!map||typeof map!=='object'||Array.isArray(map))continue;
    result[slot]=Object.fromEntries(Object.entries(map).filter(([id,skin])=>isCharId(id)&&typeof skin==='string')) as Record<string,string>;
  }
  return result;
}
