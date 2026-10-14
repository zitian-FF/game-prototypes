import type Phaser from 'phaser';
import {PIXEL_RATIO} from '../render/pixelRatio';
import {t} from '../i18n';
import {navRegister} from './menuNav';
import {bindButtonFeedback} from './cartoonChrome';
import type {ControlMode} from './controlMode';

/** Actual two-position flip switch; pointer, keyboard and Xbox navigation share callback. */
export function controlModeSelector(scene:Phaser.Scene,x:number,y:number,width:number,initial:ControlMode,onChange:(mode:ControlMode)=>void,depth=412) {
  let mode=initial,pressed=false;
  const g=scene.add.graphics().setDepth(depth);
  const hit=scene.add.rectangle(x,y,width,38,0,0).setDepth(depth).setInteractive({useHandCursor:true});
  const labels=(['modern','classic'] as const).map((m,i)=>scene.add.text(x+(i?1:-1)*width*.25,y,t(`controls.${m}`),{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#fff4df',resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(depth+1));
  labels.forEach(label=>label.setScale(Math.min(1,(width*.5-18)/Math.max(1,label.width))));
  const draw=()=>{g.clear();g.fillStyle(0x081522).fillRoundedRect(x-width/2,y-19,width,38,18);
    const px=x+(mode==='modern'?-width*.25:width*.25);
    g.fillStyle(mode==='modern'?0x168aa8:0xb17b32).fillRoundedRect(px-width*.25+3,y-16+(pressed?2:0),width*.5-6,32,15);
    g.fillStyle(0xffffff,.14).fillRoundedRect(px-width*.25+7,y-13+(pressed?2:0),width*.5-14,10,6);
    labels.forEach((label,i)=>label.setAlpha((i===0)===(mode==='modern')?1:.48));
  };
  const toggle=()=>{mode=mode==='modern'?'classic':'modern';draw();onChange(mode);};
  bindButtonFeedback(hit,state=>{pressed=state==='pressed';draw();});
  hit.on('pointerup',()=>{if(hit.getData('buttonReleasedInside'))toggle();});
  navRegister(scene,hit,toggle,'confirm');draw();
  const destroy=()=>{hit.destroy();g.destroy();labels.forEach(label=>label.destroy());};
  return {setMode(next:ControlMode){mode=next;draw();},destroy,hit};
}
