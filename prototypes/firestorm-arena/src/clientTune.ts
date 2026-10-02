import raw from '../client.tune.json';

/**
 * Client-only feel values (camera, effects, timings). The match rules live in
 * tune.json and come from the server; these never affect the simulation.
 */
export const clientTune = raw;
export type ClientTune = typeof raw;
