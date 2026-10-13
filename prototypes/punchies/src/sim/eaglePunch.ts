import config from './super-config.json';
import type {EagleState} from './types';
export const EAGLE_PUNCH=config.eaglePunch;
export function eaglePhase(state:EagleState){return state.frame<state.startup?'startup':state.frame<state.startup+state.dashFrames?'dash':'recovery';}
/** Actual physics-owned body position; never a renderer-predicted teleport. */
export function eaglePosition(state:EagleState){return {x:state.bodyX,y:state.bodyY,phase:eaglePhase(state)};}
export function eagleDashDelta(state:EagleState){const step=state.distance/state.dashFrames;return {x:state.fx*step,y:state.fy*step};}
/** Clip a committed ray at body-radius ring bounds without bending its aim. */
export function eagleEndpoint(x:number,y:number,fx:number,fy:number,distance:number,ring:{left:number;right:number;top:number;bottom:number},radius:number){
 let length=distance;if(fx>0)length=Math.min(length,(ring.right-radius-x)/fx);else if(fx<0)length=Math.min(length,(ring.left+radius-x)/fx);
 if(fy>0)length=Math.min(length,(ring.bottom-radius-y)/fy);else if(fy<0)length=Math.min(length,(ring.top+radius-y)/fy);
 length=Math.max(0,length);return {x:x+fx*length,y:y+fy*length,distance:length};
}
