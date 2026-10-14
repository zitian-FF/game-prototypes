import {ITCH_BETA_EDITION} from '../edition';
import type Phaser from 'phaser';
import type { WireProfile } from '../progress/alias';
import { titleName } from '../progress/titles';
import { t } from '../i18n';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { ratingLabel, type RatingPresentationState } from './ratingPresentation';
import type { RatingSnapshot } from '../net/rating';

export interface RankedIdentity { profile:WireProfile|null; rating:RatingPresentationState; snapshot?:RatingSnapshot; }
export type RankedPlayers=[RankedIdentity,RankedIdentity];
export interface RankedResultPresentation {
 players:RankedPlayers; localIdx:0|1;
 subscribe?:(update:(players:RankedPlayers)=>void)=>()=>void;
 nextMatch:()=>void;
}
/** Symmetric clearance reserves a44px menu target and14px breathing room. */
export function rankedCapsuleBounds(side:number,view=VIEW){
 const gap=68,inner=64,w=Math.max(100,view.width/2-gap-inner);
 return {x:side===0?view.left+gap:view.cx+inner,y:view.top+1,width:w,height:30};
}
/** Passive chrome. It has no hit area, hover, button bevel or input listener. */
export function rankedIdentityCapsule(scene:Phaser.Scene,bounds:{x:number;y:number;width:number;height:number},side:number,identity:RankedIdentity,depth=92){
 const {x,y,width,height}=bounds,root=scene.add.container(x,y).setDepth(depth);
 const bg=scene.add.graphics();bg.fillStyle(0x071222,.91).fillRoundedRect(0,0,width,height,6);
 bg.lineStyle(1,0x32445d,.65).strokeRoundedRect(0,0,width,height,6);
 bg.fillStyle(side===0?0x63ccfa:0xf87591).fillRoundedRect(side===0?0:width-2,5,2,height-10,1);
 const text=(yy:number,size:number,color:string)=>scene.add.text(side===0?9:width-9,yy,'',{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color,align:side===0?'left':'right',resolution:PIXEL_RATIO,padding:{left:2,right:3}}).setOrigin(side===0?0:1,.5);
 const expanded=height>35;
 const name=text(expanded?(height-16)/2:9,expanded?14:11,'#fff2dc'),meta=text(height-7,expanded?11:9,'#cdb5e9');root.add([bg,name,meta]);
 if(expanded)name.setWordWrapWidth(width-18,true);
 const fit=(label:Phaser.GameObjects.Text,value:string,maxWidth:number)=>{label.setScale(1).setText(value).setScale(Math.min(1,maxWidth/Math.max(1,label.width)));};
 const set=(value:RankedIdentity)=>{
  fit(name,value.profile?(ITCH_BETA_EDITION?value.profile.alias:`${value.profile.alias} · ${t('profile.level',{level:value.profile.level})}`):t('match.waiting'),width-18);
  if(expanded)name.setScale(Math.min(name.scaleX,(height-18)/Math.max(1,name.height)));
  fit(meta,[!ITCH_BETA_EDITION&&value.profile?titleName(value.profile.title):'',ratingLabel(value.rating,t)].filter(Boolean).join(' · '),width-18);
 };set(identity);
 return {root,set,setVisible:(visible:boolean)=>root.setVisible(visible),destroy:()=>root.destroy(true)};
}
