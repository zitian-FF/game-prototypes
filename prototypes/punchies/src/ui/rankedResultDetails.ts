import type Phaser from 'phaser';
import { rankedIdentityCapsule,type RankedResultPresentation,type RankedPlayers } from './rankedIdentityCapsule';
import {ratingLabel} from './ratingPresentation';
import {titleName} from '../progress/titles';
import {t} from '../i18n';
import {VIEW,PIXEL_RATIO} from '../render/pixelRatio';

/** One scene-owned result subscription; no rating requests or global outcome reads. */
export function rankedResultDetails(scene:Phaser.Scene,x:number,width:number,primary:0|1,data:RankedResultPresentation){
 const first=rankedIdentityCapsule(scene,{x:x-width/2+12,y:VIEW.top+87,width:width-24,height:43},0,data.players[primary],150);
 const text=(y:number,size:number,color:string)=>scene.add.text(x,VIEW.top+y,'',{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color,align:'center',wordWrap:{width:width-20},padding:{left:4,right:6,top:2,bottom:2},resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(150);
 const result=text(174,23,'#fff0cf'),other=text(205,11,'#d3c3e9'),otherResult=text(223,12,'#ffe08b');
 const fit=(label:Phaser.GameObjects.Text,value:string,height:number)=>{label.setScale(1).setText(value).setScale(Math.min(1,(width-20)/Math.max(1,label.width),height/Math.max(1,label.height)));};
 const outcome=(player:RankedPlayers[number])=>player.rating.phase==='settled'&&player.snapshot
  ?t('rating.transition',{before:player.snapshot.before,after:player.snapshot.after,delta:`${player.snapshot.delta>0?'+':''}${player.snapshot.delta}`})
  :ratingLabel(player.rating.phase==='settled'?{phase:'unavailable'}:player.rating,t);
 let alive=true;
 const update=(players:RankedPlayers)=>{if(!alive||!result.active)return;const a=players[primary],b=players[1-primary];first.set(a);
  fit(result,outcome(a),31);const p=b.profile;fit(other,p?`${p.alias} · ${t('profile.level',{level:p.level})} · ${titleName(p.title)}`:t('match.waiting'),18);fit(otherResult,outcome(b),18);
 };update(data.players);
 const stop=data.subscribe?.(update);
 const shutdown=()=>{if(!alive)return;alive=false;stop?.();};scene.events.once('shutdown',shutdown);
 return {shutdown};
}
