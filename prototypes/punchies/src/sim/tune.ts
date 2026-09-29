import tuneJson from '../../tune.json';

// Single live tune object. The debug panel binds to this same object, so
// edits made in Tweakpane apply to the running sim immediately.
//
// The build's tune.json is always what loads. The main menu's SYNC TUNE
// button can replace it for the rest of the session with the latest
// tune.json committed to GitHub (main branch), so values can be tweaked
// without a rebuild. Online, the guest temporarily adopts the host's values
// for the match (see applyTuneJson / restoreTune).
export type Tune = typeof tuneJson;
export const tune: Tune = tuneJson;

export const TICK_RATE = 60;

const GITHUB_TUNE_URL = 'https://raw.githubusercontent.com/zitian-FF/game-prototypes/main/prototypes/punchies/tune.json';
const SYNC_TIMEOUT_MS = 6000;

type Obj = Record<string, unknown>;

let baseline: Tune = structuredClone(tuneJson);
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

// Online: adopt the host's tune for the match.
export function applyTuneJson(json: string): void {
  assignKnown(tune as unknown as Obj, JSON.parse(json) as Obj);
}

export function snapshotTune(): string {
  return JSON.stringify(tune);
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
    const applied = assignKnown(tune as unknown as Obj, parsed as Obj);
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
