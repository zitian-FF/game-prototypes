import tuneJson from '../../tune.json';

// Single live tune object. The debug panel binds to this same object, so
// edits made in Tweakpane apply to the running sim immediately.
export type Tune = typeof tuneJson;
export const tune: Tune = tuneJson;

export const TICK_RATE = 60;

// Online: the host sends its live tune at match start so both peers simulate
// with identical values (e.g. if the host tweaked them via ?debug=1).
export function applyTuneJson(json: string): void {
  const assign = (dst: Record<string, unknown>, src: Record<string, unknown>) => {
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v && typeof v === 'object' && dst[k] && typeof dst[k] === 'object') {
        assign(dst[k] as Record<string, unknown>, v as Record<string, unknown>);
      } else {
        dst[k] = v;
      }
    }
  };
  assign(tune as unknown as Record<string, unknown>, JSON.parse(json) as Record<string, unknown>);
}
