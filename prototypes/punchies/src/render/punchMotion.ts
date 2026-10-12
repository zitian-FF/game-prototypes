import type { Fighter, PunchState } from '../sim/types';
import { activeEnd } from '../sim/sim';
import { tune } from '../sim/tune';
export { punchExtension, punchFist } from '../sim/fistPath';
export type { Point } from '../sim/fistPath';
import type { Point } from '../sim/fistPath';
const clamp = (v: number) => Math.max(0, Math.min(1, v));

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

// Tee's fingerless fists point right; the boxing mitts point up. Register the
// image axis and cuff distance together so corrected rotation keeps the join.
export function gloveRegistration(char:string,width:number,height:number,k:number,skin='default',hand=0):{scale:number;axis:number;cuff:number;originX?:number;originY?:number} {
  const rig=tune.view.puppet;
  const h=rig.gloveHeight*k*(char==='tee'?rig.teeHandScale:1);
  if(char==='kai'){
    const scale=14*k/height,originX=.52,originY=.5;
    const dx=(.10-originX)*width*scale,dy=(hand===0?-.03:.03)*height*scale;
    return {scale,axis:Math.atan2(dy,-dx),cuff:Math.hypot(dx,dy),originX,originY};
  }
  // Actual gold mitt landmarks: main knuckle centre(.44/.56,.33),
  // cuff centre(.70/.30,.82). Centre-of-canvas sat on the thumb fold and
  // rolled the hand around the wrong pivot, despite a numerically joined cuff.
  if(char==='tyke'){
    const originX=hand===0?.44:.56,originY=.33;
    const cuffX=hand===0?.70:.30,cuffY=.82;
    const dx=(cuffX-originX)*width/height*h,dy=(cuffY-originY)*h;
    return {scale:h/height,axis:Math.PI-Math.atan2(dy,dx),cuff:Math.hypot(dx,dy),originX,originY};
  }
  const facesRight = char==='tee' || char==='captain' || skin==='skin-marco-unique';
  return {scale:h/height,axis:char==='captain'||skin==='skin-marco-unique'?0:char==='tee'?rig.teeGloveAxisDegrees*Math.PI/180:Math.PI/2,
    cuff:(facesRight?h*width/height:h)*.4};
}
