import type { Fighter } from '../sim/types';
export class WalkMotion {
  private x = NaN; private y = NaN; private time = NaN;
  phase = 0; stride = 0; direction = { x: 0, y: 0 };
  update(f: Fighter, now: number, phasePerPixel: number): boolean {
    const elapsed = Number.isNaN(this.time) ? 16.667 : Math.max(0, Math.min(100, now-this.time));
    const dx=f.x-this.x,dy=f.y-this.y, distance=Math.hypot(dx,dy);
    const walking=Number.isFinite(distance)&&distance<20&&elapsed>0&&distance/elapsed>.006&&!f.dodge&&!f.stunTimer&&!f.pushFrames&&!f.anchored;
    if(walking){
      this.phase+=distance*phasePerPixel;
      const target={x:dx/distance,y:dy/distance},blend=1-Math.exp(-elapsed/85);
      if(this.stride===0)this.direction=target;
      else this.direction={x:this.direction.x+(target.x-this.direction.x)*blend,y:this.direction.y+(target.y-this.direction.y)*blend};
    }
    this.stride+=((walking?1:0)-this.stride)*(1-Math.exp(-elapsed/102.55));
    if(this.stride<.001){this.stride=0;this.direction={x:0,y:0};}
    this.x=f.x;this.y=f.y;this.time=now;
    return walking;
  }
}
/** Stance holds a planted foot; only the returning swing lifts the boot. */
export function footCycle(phase: number): { travel: number; lift: number } {
  const u=((phase/(2*Math.PI))%1+1)%1;
  if(u<.6)return {travel:1-2*u/.6,lift:0};
  const t=(u-.6)/.4, smooth=t*t*(3-2*t);
  return {travel:-1+2*smooth,lift:Math.sin(Math.PI*t)};
}

/** Continuous blend in the fighter's facing space; diagonals retain both steps. */
export function blendedFootStep(phase:number,forward:number,lateral:number,stride:number):{u:number;v:number;yaw:number;lift:number}{
 const cycle=footCycle(phase);
 return {u:9*forward*stride*cycle.travel,v:7*lateral*stride*cycle.travel,yaw:.3*lateral*stride,lift:cycle.lift*stride};
}
/** Collar attachment follows the same rotation and lift scale as its boot. */
export function bootCollar(x:number,y:number,rotation:number,width:number):{x:number;y:number}{
 const offset=-.3*width;
 return {x:x+Math.cos(rotation)*offset,y:y+Math.sin(rotation)*offset};
}
