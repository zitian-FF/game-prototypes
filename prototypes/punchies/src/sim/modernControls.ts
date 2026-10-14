import type {Fighter,FrameInput,PunchType} from './types';
import {punchCfg} from './character';
import {coreRadius,normalHurtRadius,separation} from './geometry';

export type ControlMode='modern'|'classic';
export const MODERN_DAMAGE_MULT=.8;
export const MODERN_DODGE_WINDOW=12;
/** Selection only: never changes punch geometry. Included in online rules hash. */
export const MODERN_SELECTION_TOLERANCE=Object.freeze({crossReachFraction:.20,contactBoundaryEpsilon:1e-6});
const ENTER_NEUTRAL=.12,LEAVE_NEUTRAL=.20;
export function controlMode(value:unknown):ControlMode{return value==='classic'?'classic':'modern';}
export interface ModernStickState {neutral:boolean;dodgeWindow:number;dx:number;dy:number}
export function newModernStickState():ModernStickState{return {neutral:true,dodgeWindow:0,dx:0,dy:0};}
/** Once per active combat step, before candidate contacts. Never during intro/hitstop. */
export function modernMovement(state:ModernStickState,input:Pick<FrameInput,'mx'|'my'>):{mx:number;my:number} {
  const mx=Number.isFinite(input.mx)?Math.max(-100,Math.min(100,input.mx)):0;
  const my=Number.isFinite(input.my)?Math.max(-100,Math.min(100,input.my)):0;
  const length=Math.sqrt(mx*mx+my*my),magnitude=length/100,wasNeutral=state.neutral;
  if(state.neutral){if(magnitude>=LEAVE_NEUTRAL)state.neutral=false;}
  else if(magnitude<=ENTER_NEUTRAL)state.neutral=true;
  if(wasNeutral&&!state.neutral){state.dodgeWindow=MODERN_DODGE_WINDOW;state.dx=mx/length;state.dy=my/length;}
  if(state.neutral)return {mx:0,my:0};
  const scale=length>100?100/length:1;return {mx:mx*scale,my:my*scale};
}
/** End of an active combat step: first armed step is one of the twelve. */
export function advanceModernWindow(state:ModernStickState):void{state.dodgeWindow=Math.max(0,state.dodgeWindow-1);}
/** Call only on a real collision candidate and after existing dodge legality checks. */
export function consumeModernDodge(state:ModernStickState,legal:boolean):{dx:number;dy:number}|null {
  if(!legal||state.dodgeWindow<=0)return null;
  state.dodgeWindow=0;return {dx:state.dx,dy:state.dy};
}
/** Raw fist extension remains unchanged; selection uses real contact geometry below. */
export function modernPunchRange(att:Fighter,_target:Fighter,type:'jab'|'cross'|'hook'):number{return punchCfg(att,type).reach;}
export function modernPunchZones(att:Fighter,target:Fighter){
  const hook=punchCfg(att,'hook'),jab=punchCfg(att,'jab'),cross=punchCfg(att,'cross'),core=coreRadius(target);
  const hookMax=hook.reach+hook.hitRadius+core;
  // Any closer than this can touch the head before full extension (early sour).
  const lastEarlyReach=cross.reach*(cross.startReachFrac+(1-cross.startReachFrac)*cross.sourEarly/(cross.sourEarly+1));
  const crossSweetMin=lastEarlyReach+cross.hitRadius+core;
  const jabMax=Math.max(jab.reach+jab.hitRadius+core,crossSweetMin+MODERN_SELECTION_TOLERANCE.contactBoundaryEpsilon);
  const crossContactMax=cross.reach+cross.hitRadius+normalHurtRadius(target);
  return {bodyContact:separation(att,target),hookMax,jabMax,crossSweetMin,crossContactMax,crossMax:crossContactMax+cross.reach*MODERN_SELECTION_TOLERANCE.crossReachFraction};
}
/** Commit once at legal action start. Moving in too early can still jam a Cross; no auto-hit/auto-sweet. */
export function contextualModernPunch(att:Fighter,target:Fighter):PunchType {
  const dx=target.x-att.x,dy=target.y-att.y,distance=Math.sqrt(dx*dx+dy*dy),zones=modernPunchZones(att,target);
  if(distance<=zones.hookMax)return 'hook';
  if(distance>zones.jabMax&&distance<=zones.crossMax)return 'cross';
  return 'jab';
}
