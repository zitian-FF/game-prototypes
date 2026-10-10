import { tune } from './tune';

// One scale for artwork and simulation geometry. Character proportions live in
// tune.body.proportions; damage, speed and frame timings are independent of body size.
export function fighterScale(f: string | { char: string }): number {
  return tune.view.fighterScale * ((tune.body.proportions as Record<string, number>)[typeof f === 'string' ? f : f.char] ?? 1);
}
export const normalHurtRadius = (f: string | { char: string }) => tune.body.hurtRadius * fighterScale(f);
export const coreRadius = (f: string | { char: string }) => tune.body.coreRadius * fighterScale(f);
export const separation = (a: { char: string }, b: { char: string }) =>
  tune.movement.minSeparation * (fighterScale(a) + fighterScale(b)) / 2;
