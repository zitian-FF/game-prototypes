import tuneJson from '../../tune.json';
import tuneMeta from '../../tune.meta.json';
import {readArchetypes} from './workshopText';
import {setEnglishOverrides} from '../i18n';

// Single live tune object. The debug panel binds to this same object, so
// edits made in Tweakpane apply to the running sim immediately.
//
// The build's tune.json is always what loads. The main menu's SYNC TUNE
// button can replace it for the rest of the session with the latest
// tune.json committed to GitHub (main branch), so values can be tweaked
// without a rebuild. Online, the guest temporarily adopts the host's values
// for the match (see applyTuneJson / restoreTune).
// Workshop revision metadata must never become simulation/debug tune fields,
// including after a build bundles a tune.json containing saved history.
export type Tune = Omit<typeof tuneJson, 'balanceWorkshop'>;
const { balanceWorkshop: _workshopHistory, ...gameTune } = tuneJson as typeof tuneJson & { balanceWorkshop?: unknown };
export const tune: Tune = gameTune;
let archetypes=readArchetypes(tuneJson);
setEnglishOverrides(archetypes);

export const TICK_RATE = 60;

const GITHUB_TUNE_URL = 'https://raw.githubusercontent.com/zitian-FF/game-prototypes/main/prototypes/punchies/tune.json';
const SYNC_TIMEOUT_MS = 6000;

type Obj = Record<string, unknown>;

let baseline: Tune = structuredClone(tune);
let source = 'built-in';
const listeners: (() => void)[] = [];

// The values the current session started from (build or last sync). Shown as
// "was" in the debug panel.
export function tuneBaseline(): Tune {
  return baseline;
}

export function tuneSource(): string {
  return source;
}

export function onTuneReplaced(cb: () => void): void {
  listeners.push(cb);
}

// Deep-assign only keys that already exist with the same type, so a partial
// or slightly wrong file can't inject junk into the sim.
function assignKnown(dst: Obj, src: Obj): number {
  let applied = 0;
  for (const k of Object.keys(dst)) {
    const d = dst[k];
    const s = src[k];
    if (s === undefined) continue;
    if (d && typeof d === 'object') {
      if (s && typeof s === 'object') applied += assignKnown(d as Obj, s as Obj);
    } else if (typeof s === typeof d && (typeof s !== 'number' || Number.isFinite(s))) {
      dst[k] = s;
      applied++;
    }
  }
  return applied;
}

type TuneCheck = { ok: true; value: Obj } | { ok: false; error: string };
type Range = { min: number; max: number };

// Strict check of a tune that came from someone else (the online host, the
// GitHub sync). Parses, then walks the live tune: every known value must
// have the same type, and every number must be finite and inside the
// min/max in tune.meta.json. Unknown keys are ignored, as in assignKnown.
// It never applies anything and never clamps: a guest that clamped would
// simulate different numbers from the host and desync.
export function validateTuneJson(json: string): TuneCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, error: 'not an object' };
  const meta = tuneMeta as unknown as Record<string, Range | undefined>;
  const walk = (dst: Obj, src: Obj, path: string): string | null => {
    for (const k of Object.keys(dst)) {
      const d = dst[k];
      const v = src[k];
      if (v === undefined) continue;
      const at = path ? `${path}.${k}` : k;
      if (d && typeof d === 'object') {
        if (!v || typeof v !== 'object' || Array.isArray(v) !== Array.isArray(d)) return `${at} has the wrong type`;
        const err = walk(d as Obj, v as Obj, at);
        if (err) return err;
      } else if (typeof v !== typeof d) {
        return `${at} has the wrong type`;
      } else if (typeof v === 'number') {
        const r = meta[at];
        if (!Number.isFinite(v)) return `${at} is not a finite number`;
        if (!r || typeof r.min !== 'number' || typeof r.max !== 'number') return `${at} has no allowed range`;
        if (v < r.min || v > r.max) return `${at} is out of range`;
      }
    }
    return null;
  };
  const error = walk(tune as unknown as Obj, parsed as Obj, '');
  if(error)return {ok:false,error};
  try{readArchetypes(parsed);}catch(e){return {ok:false,error:(e as Error).message};}
  return {ok:true,value:parsed as Obj};
}

// Online: adopt the host's tune for the match. Call validateTuneJson first.
export function applyTuneJson(json: string): void {
  const parsed=JSON.parse(json),texts=readArchetypes(parsed);
  assignKnown(tune as unknown as Obj, parsed as Obj);
  archetypes=texts;setEnglishOverrides(archetypes);
}

export function snapshotTune(): string {
  return JSON.stringify(Object.keys(archetypes).length?{...tune,balanceWorkshop:{archetypes}}:tune);
}

export function restoreTune(snapshot: string): void {
  applyTuneJson(snapshot);
}

export async function syncTuneFromGitHub(): Promise<{ ok: true; applied: number } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const res = await fetch(`${GITHUB_TUNE_URL}?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) return { ok: false, error: `GitHub responded ${res.status}` };
    let parsed: unknown;
    try {
      parsed = JSON.parse(await res.text());
    } catch {
      return { ok: false, error: 'tune.json on GitHub is not valid JSON' };
    }
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'tune.json on GitHub is empty' };
    const check = validateTuneJson(JSON.stringify(parsed));
    if (!check.ok) return { ok: false, error: `tune.json on GitHub rejected: ${check.error}` };
    const applied = assignKnown(tune as unknown as Obj, check.value);
    archetypes=readArchetypes(check.value);setEnglishOverrides(archetypes);
    baseline = structuredClone(tune);
    source = `GitHub ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    for (const cb of listeners) cb();
    return { ok: true, applied };
  } catch (e) {
    return { ok: false, error: controller.signal.aborted ? 'timed out' : 'network error' };
  } finally {
    clearTimeout(timer);
  }
}
