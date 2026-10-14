import type {Fighter,FrameInput,PunchType} from './types';
import {punchCfg} from './character';

export type ControlMode='modern'|'classic';
export const MODERN_DAMAGE_MULT=.8;
export const MODERN_DODGE_WINDOW=12;
/** Selection only: never changes punch geometry. Included in online rules hash. */
export const MODERN_SELECTION_TOLERANCE=Object.freeze({hookReachFraction:.10,hookHitRadiusFraction:.50,crossJabInsetFraction:.15,crossReachFraction:.10});
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
/** Approved context boundaries are fist reach, already scaled in world units.
 * Hurt envelopes classify the actual hit, not the chosen action. */
export function modernPunchRange(att:Fighter,_target:Fighter,type:'jab'|'cross'|'hook'):number {
  return punchCfg(att,type).reach;
}
/** Only at legal action start; the committed PunchState owns the choice thereafter. */
export function contextualModernPunch(att:Fighter,target:Fighter):PunchType {
  const dx=target.x-att.x,dy=target.y-att.y,distance=Math.sqrt(dx*dx+dy*dy);
  const hook=punchCfg(att,'hook'),tolerance=MODERN_SELECTION_TOLERANCE;
  const hookLimit=hook.reach+Math.min(hook.reach*tolerance.hookReachFraction,hook.hitRadius*tolerance.hookHitRadiusFraction);
  const crossStart=modernPunchRange(att,target,'jab')*(1-tolerance.crossJabInsetFraction);
  if(distance<=hookLimit)return 'hook';
  if(distance>crossStart&&distance<=modernPunchRange(att,target,'cross')*(1+tolerance.crossReachFraction))return 'cross';
  return 'jab';
}
