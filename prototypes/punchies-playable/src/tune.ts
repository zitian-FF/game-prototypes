import raw from '../tune.json';

export type Tune = typeof raw;

// Live object: the debug panel edits it and the sim reads it every step.
export const tune: Tune = structuredClone(raw);
export const tuneBaseline = (): Tune => structuredClone(raw);
