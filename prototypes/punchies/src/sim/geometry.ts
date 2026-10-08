import { tune } from './tune';

// One scale for artwork and simulation geometry. Character proportions are
// preserved; damage, speed and frame timings are independent of body size.
const PROPORTIONS: Record<string, number> = { marco: 1, mia: 0.88, bruno: 1.12, tee: .90 };
export function fighterScale(f: string | { char: string }): number {
  return tune.view.fighterScale * (PROPORTIONS[typeof f === 'string' ? f : f.char] ?? 1);
}
export const normalHurtRadius = (f: string | { char: string }) => tune.body.hurtRadius * fighterScale(f);
export const coreRadius = (f: string | { char: string }) => tune.body.coreRadius * fighterScale(f);
export const separation = (a: { char: string }, b: { char: string }) =>
  tune.movement.minSeparation * (fighterScale(a) + fighterScale(b)) / 2;
