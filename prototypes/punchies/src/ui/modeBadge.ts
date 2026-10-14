import type Phaser from 'phaser';
import {PIXEL_RATIO} from '../render/pixelRatio';
import {t} from '../i18n';
import type {ControlMode} from './controlMode';
/** Passive status: letter and silhouette remain distinguishable without colour. */
export function modeBadge(scene:Phaser.Scene,x:number,y:number,depth=92) {
  const g=scene.add.graphics().setDepth(depth);
  const label=scene.add.text(x,y,'',{fontFamily:'Arial Black, Arial',fontSize:'12px',fontStyle:'bold',color:'#fff4dd',resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(depth+1);
  let previous:ControlMode|null=null;
  return {
    setMode(mode:ControlMode){if(previous===mode)return;previous=mode;g.clear();
      if(mode==='modern')g.fillStyle(0x168aa8).fillRoundedRect(x-12,y-12,24,24,6).lineStyle(1,0x73eaff,.7).strokeRoundedRect(x-12,y-12,24,24,6);
      else {const p=[{x,y:y-14},{x:x+14,y},{x,y:y+14},{x:x-14,y}];g.fillStyle(0x92622b).fillPoints(p,true).lineStyle(1,0xffd475,.7).strokePoints(p,true);}
      label.setText(mode==='modern'?'M':'C');label.setData('statusLabel',t(`controls.${mode}`));
    },
    setVisible(visible:boolean){g.setVisible(visible);label.setVisible(visible);},
    destroy(){g.destroy();label.destroy();},
  };
}
