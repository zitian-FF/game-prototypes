import type Phaser from 'phaser';
import {PIXEL_RATIO} from '../render/pixelRatio';

/** Backend-owned states. Unavailable never implies a zero rating. */
export type RatingPresentationState =
 | {phase:'loading'}
 | {phase:'available';rating:number}
 | {phase:'unavailable'}
 | {phase:'pending'}
 | {phase:'settled';rating:number;delta:number}
 | {phase:'expired'};

export function ratingLabel(
 state:RatingPresentationState,
 translate:(key:string,values?:Record<string,string|number>)=>string,
):string {
 switch(state.phase){
  case 'loading':return translate('rating.loading');
  case 'available':return Number.isFinite(state.rating)?translate('rating.points',{points:state.rating}):translate('rating.unavailable');
  case 'unavailable':return translate('rating.unavailable');
  case 'pending':return translate('rating.pending');
  case 'expired':return translate('rating.unsettled');
  case 'settled':return Number.isFinite(state.rating)&&Number.isFinite(state.delta)
   ?translate('rating.result',{points:state.rating,delta:`${state.delta>0?'+':''}${state.delta}`})
   :translate('rating.unavailable');
 }
}

/** A bounded status label, deliberately without interactive button chrome. */
export function ratingStatusText(scene:Phaser.Scene,x:number,y:number,width:number,depth:number){
 const label=scene.add.text(x,y,'',{fontFamily:'Arial',fontSize:16,fontStyle:'bold',color:'#ffe08b',
  align:'center',wordWrap:{width:width-12},padding:{left:6,right:6,top:3,bottom:3},resolution:PIXEL_RATIO})
  .setOrigin(.5).setDepth(depth);
 return {label,set(text:string){
  label.setScale(1).setText(text);
  label.setScale(Math.min(1,width/Math.max(1,label.width),42/Math.max(1,label.height)));
 }};
}
