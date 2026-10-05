import type { Fighter, PunchState } from '../sim/types';
import { activeEnd } from '../sim/sim';
import { tune } from '../sim/tune';

export type Point = { x: number; y: number };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const smooth = (t: number) => t * t * (3 - 2 * t);

// Presentation only: punch contact, reach and timing remain in the simulation.
export function punchExtension(p: PunchState): number {
  if (p.frame < p.startup) return 0;
  if (p.frame < activeEnd(p)) return clamp((p.frame - p.startup + 1) / (p.sourEarly + 1));
  return Math.pow(1 - clamp((p.frame - activeEnd(p)) / Math.max(1, p.recovery)), 3);
}

export function punchFist(f: Fighter, p: PunchState, k: number): Point {
  const side = p.hand === 0 ? 1 : -1;
  const rest = { x: f.x + (f.fx * 15 + f.fy * 15 * side) * k, y: f.y + (f.fy * 15 - f.fx * 15 * side) * k };
  const point = (angle: number): Point => ({ x: f.x + p.reach * (f.fx * Math.cos(angle) + f.fy * Math.sin(angle)), y: f.y + p.reach * (f.fy * Math.cos(angle) - f.fx * Math.sin(angle)) });
  if (p.type !== 'hook') {
    const t = p.frame < p.startup ? -0.15 * smooth(clamp(p.frame / Math.max(1, p.startup))) : punchExtension(p);
    return mix(rest, point(0), t);
  }
  const rig = tune.view.puppet;
  const windup = side * rig.hookWindupDegrees * Math.PI / 180;
  const follow = -side * rig.hookFollowDegrees * Math.PI / 180;
  if (p.frame < p.startup) return mix(rest, point(windup), smooth(clamp(p.frame / Math.max(1, p.startup))));
  const sweetStart = p.startup + p.sourEarly;
  if (p.frame <= sweetStart) {
    const t = clamp((p.frame - p.startup + 1) / (p.sourEarly + 1));
    return point(windup * Math.pow(1 - t, rig.hookSnapPower));
  }
  if (p.frame < activeEnd(p)) {
    const t = clamp((p.frame - sweetStart) / Math.max(1, p.sweet + p.sour));
    return point(follow * (1 - Math.pow(1 - t, rig.hookSnapPower)));
  }
  const lastT = clamp((p.sweet + p.sour - 1) / Math.max(1, p.sweet + p.sour));
  const last = point(follow * (1 - Math.pow(1 - lastT, rig.hookSnapPower)));
  return mix(last, rest, 1 - punchExtension(p));
}

// Cuff always lies on the forearm axis, so glove rotation cannot open a gap.
export function armPose(shoulder: Point, fist: Point, cuff: number, minSegment: number, outward: Point, straight: number): { elbow: Point; wrist: Point } {
  const dx = fist.x - shoulder.x, dy = fist.y - shoulder.y;
  const distance = Math.hypot(dx, dy) || 0.001;
  const segment = Math.max(minSegment, distance * 0.51);
  const bend = Math.sqrt(Math.max(0, segment * segment - distance * distance / 4)) * (1 - clamp(straight));
  const sign = (-dy * outward.x + dx * outward.y) < 0 ? -1 : 1;
  const elbow = { x: (shoulder.x + fist.x) / 2 - dy / distance * bend * sign, y: (shoulder.y + fist.y) / 2 + dx / distance * bend * sign };
  const forearm = Math.hypot(fist.x - elbow.x, fist.y - elbow.y) || 1;
  const wrist = { x: fist.x - (fist.x - elbow.x) / forearm * cuff, y: fist.y - (fist.y - elbow.y) / forearm * cuff };
  return { elbow, wrist };
}

export function uppercutFireIntensity(p: PunchState): number {
  if (p.type !== 'uppercut') return 0;
  if (p.frame < p.startup) return 0.35 + 0.65 * p.frame / Math.max(1, p.startup);
  if (p.frame < activeEnd(p)) return 1;
  return Math.max(0, 1 - (p.frame - activeEnd(p)) / Math.max(1, tune.view.puppet.uppercutFireFadeFrames));
}
