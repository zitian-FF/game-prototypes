import {rosterHintKeys,type KeyboardProfile} from '../input/rosterMenu';
const contexts=new WeakMap<object,{local:boolean;profile:KeyboardProfile;owned:KeyboardProfile[]}>();
export function setRosterHintContext(scene:object,context:{local:boolean;profile:KeyboardProfile;owned:KeyboardProfile[]}):void{contexts.set(scene,context);}
import type Phaser from 'phaser';
import {t} from '../i18n';
import {inputModality} from '../input/modality';
import {inputGlyph,keyLabel,padLabel} from './inputGlyph';
import {loadLayouts} from '../input/layouts';
/** Passive hints use existing keycaps/Xbox glyphs. Caller owns row visibility. */
export function controlHint(scene:Phaser.Scene,x:number,y:number,depth:number,action:'back'|'format'|'difficulty'|'navigate'|'confirm'|'skins',parent?:Phaser.GameObjects.Container,maxWidth=140){
 const row=scene.add.container(x,y).setDepth(depth);parent?.add(row);let previous='';
 const update=()=>{
  if(!row.active)return;
  const kind=inputModality.kind,context=contexts.get(scene),layouts=loadLayouts(),profile=context?.local?context.profile:inputModality.source==='kb2'?'kb2':'kb1',bindings=layouts[profile];
  const label=action==='back'?t('common.back'):action==='format'?t('ui.match_format'):action==='difficulty'?t('ui.bot_difficulty'):action==='navigate'?t('ui.navigate'):action==='skins'?t('ui.skins'):t('ui.confirm');
  const signature=kind+profile+label+JSON.stringify([layouts,context]);if(signature===previous)return;previous=signature;row.removeAll(true);
  const keys=rosterHintKeys(action,layouts,profile,context?.local??false,kind==='gamepad',context?.owned);
  const value=kind==='touch'&&action!=='format'&&action!=='difficulty'?t('tutorial.tap_button',{button:label}):label;
  const text=scene.add.text(0,0,value,{fontFamily:'Arial',fontSize:11,color:'#dbe9fa'}).setOrigin(0,.5);row.add(text);
  const widths=kind==='touch'?[]:keys.map(key=>.75*(typeof key==='number'&&key<=3?26:Math.max(26,Math.min(104,(typeof key==='number'?padLabel(key):keyLabel(key)).length*7+16))));
  const glyphWidth=widths.reduce((sum,w)=>sum+w,0)+Math.max(0,widths.length-1)*4;
  const total=glyphWidth+(widths.length?8:0)+text.width;let cursor=-total/2;
  if(kind!=='touch')keys.forEach((key,i)=>{row.add(inputGlyph(scene,cursor+widths[i]/2,0,key,depth).setScale(.75));cursor+=widths[i]+4;});
  text.setX(-total/2+glyphWidth+(widths.length?8:0));row.setScale(Math.min(1,maxWidth/Math.max(1,total)));
 };
 scene.events.on('update',update);row.once('destroy',()=>scene.events.off('update',update));update();return row;
}


