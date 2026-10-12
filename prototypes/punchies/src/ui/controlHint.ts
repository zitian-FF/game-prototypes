import type Phaser from 'phaser';
import {t} from '../i18n';
import {inputModality} from '../input/modality';
import {inputGlyph,keyLabel,padLabel} from './inputGlyph';
import {loadLayouts} from '../input/layouts';
/** Passive hints use existing keycaps/Xbox glyphs. Caller owns row visibility. */
export function controlHint(scene:Phaser.Scene,x:number,y:number,depth:number,action:'back'|'format'|'difficulty'|'navigate'|'confirm',parent?:Phaser.GameObjects.Container,maxWidth=140){
 const row=scene.add.container(x,y).setDepth(depth);parent?.add(row);let previous='';
 const update=()=>{
  if(!row.active)return;
  const kind=inputModality.kind,bindings=loadLayouts()[inputModality.source==='kb2'?'kb2':'kb1'];
  const label=action==='back'?t('common.back'):action==='format'?t('ui.match_format'):action==='difficulty'?t('ui.bot_difficulty'):action==='navigate'?t('ui.navigate'):t('ui.confirm');
  const signature=kind+label+JSON.stringify(bindings);if(signature===previous)return;previous=signature;row.removeAll(true);
  const keys:(string|number)[]=action==='navigate'?(kind==='gamepad'?[10]:(['up','left','down','right'] as const).map(a=>bindings[a][0])):action==='confirm'?[kind==='gamepad'?0:'Enter']:action==='back'?[kind==='gamepad'?1:'Escape']:action==='format'?[kind==='gamepad'?3:'F1']:kind==='gamepad'?[4,5]:['F2','F3'];
  const value=kind==='touch'?t('tutorial.tap_button',{button:label}):label;
  const text=scene.add.text(0,0,value,{fontFamily:'Arial',fontSize:11,color:'#dbe9fa'}).setOrigin(0,.5);row.add(text);
  const widths=kind==='touch'?[]:keys.map(key=>.75*(typeof key==='number'&&key<=3?26:Math.max(26,Math.min(104,(typeof key==='number'?padLabel(key):keyLabel(key)).length*7+16))));
  const glyphWidth=widths.reduce((sum,w)=>sum+w,0)+Math.max(0,widths.length-1)*4;
  const total=glyphWidth+(widths.length?8:0)+text.width;let cursor=-total/2;
  if(kind!=='touch')keys.forEach((key,i)=>{row.add(inputGlyph(scene,cursor+widths[i]/2,0,key,depth).setScale(.75));cursor+=widths[i]+4;});
  text.setX(-total/2+glyphWidth+(widths.length?8:0));row.setScale(Math.min(1,maxWidth/Math.max(1,total)));
 };
 scene.events.on('update',update);row.once('destroy',()=>scene.events.off('update',update));update();return row;
}
