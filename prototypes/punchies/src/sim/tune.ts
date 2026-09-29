import tuneJson from '../../tune.json';

// Single live tune object. The debug panel binds to this same object, so
// edits made in Tweakpane apply to the running sim immediately.
export type Tune = typeof tuneJson;
export const tune: Tune = tuneJson;

export const TICK_RATE = 60;
