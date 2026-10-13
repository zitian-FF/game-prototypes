import config from './super-config.json';
import type {WaveState} from './types';
export const WAVE_MOTION=config.waveMotion;
/** Instantaneous velocity in authored world pixels per 60 Hz tick. */
export function waveVelocity(state:WaveState,frame=state.frame){const elapsed=Math.max(0,frame-state.startup),progress=state.accelerationFrames>0?Math.min(1,elapsed/state.accelerationFrames):1;return state.speed*(state.startSpeedRatio+(1-state.startSpeedRatio)*progress);}
/** Integrated linear acceleration: collision and rendering share this exact path. */
export function wavePosition(state:WaveState,frame=state.frame){
 const elapsed=Math.max(0,frame-state.startup),ramp=Math.min(elapsed,state.accelerationFrames);
 const ticks=state.accelerationFrames>0?ramp*state.startSpeedRatio+(1-state.startSpeedRatio)*ramp*ramp/(2*state.accelerationFrames)+Math.max(0,elapsed-state.accelerationFrames):elapsed;
 return {x:state.originX+state.fx*state.speed*ticks,y:state.originY+state.fy*state.speed*ticks,phase:state.launched?'travel':'startup'} as const;
}
/** Earliest swept circle contact, including an already overlapping origin. */
export function waveContact(a:{x:number;y:number},b:{x:number;y:number},x:number,y:number,radius:number){
 const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-x,oy=a.y-y,c=ox*ox+oy*oy-radius*radius;
 if(c<=0)return {x:a.x,y:a.y,t:0};
 const length=dx*dx+dy*dy;if(!length)return null;
 const dot=ox*dx+oy*dy,disc=dot*dot-length*c;if(disc<0)return null;
 const t=(-dot-Math.sqrt(disc))/length;return t>=0&&t<=1?{x:a.x+dx*t,y:a.y+dy*t,t}:null;
}
