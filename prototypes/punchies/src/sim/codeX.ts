import config from './super-config.json';
import type {CodeXState,CodeXTrack} from './types';
/** Fixed 60 Hz schedule. Uses logical combat frames; hitstop freezes it. */
export const CODE_X_TIMING=config.codeXTiming;
export const CODE_X_END=CODE_X_TIMING.telegraph+CODE_X_TIMING.stagger+CODE_X_TIMING.dash+CODE_X_TIMING.recovery;
export function codeXTrackPosition(track:CodeXTrack,frame:number){
 const progress=Math.max(0,Math.min(1,(frame-track.startFrame)/CODE_X_TIMING.dash));
 return {x:track.startX+(track.endX-track.startX)*progress,y:track.startY+(track.endY-track.startY)*progress,
 phase:frame<track.startFrame?'telegraph':frame<track.startFrame+CODE_X_TIMING.dash?'dash':'recovery'} as const;
}
export function codeXTracks(x:number,y:number,fx:number,fy:number,distance:number,stagger=CODE_X_TIMING.stagger,telegraph=CODE_X_TIMING.telegraph):[CodeXTrack,CodeXTrack]{
 const inv=1/Math.sqrt(2);
 return [-1,1].map((sign,index)=>{const dx=(fx-sign*fy)*inv,dy=(fy+sign*fx)*inv;return {startX:x-dx*distance,startY:y-dy*distance,endX:x+dx*distance,endY:y+dy*distance,startFrame:telegraph+index*stagger};}) as [CodeXTrack,CodeXTrack];
}
/** Swept contact at the rendered track segment, no forced target-center hit. */
export function codeXContactPoint(state:CodeXState,shadow:0|1,x:number,y:number,radius:number):{x:number;y:number}|null{
 const track=state.tracks[shadow];if(state.frame<track.startFrame||state.frame>=track.startFrame+CODE_X_TIMING.dash)return null;
 const a=codeXTrackPosition(track,state.frame),b=codeXTrackPosition(track,state.frame+1),dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0,px=a.x+t*dx,py=a.y+t*dy;
 return (x-px)**2+(y-py)**2<=radius*radius?{x:px,y:py}:null;
}
