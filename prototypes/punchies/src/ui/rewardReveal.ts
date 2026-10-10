import Phaser from 'phaser';
import { t } from '../i18n';
import { itemName } from '../shop/itemText';
import { playStinger } from '../audio/stingers';
import { artKey } from '../render/art';
import { skinTexture } from '../render/skins';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { tune } from '../sim/tune';
import type { ShopItem } from '../shop/draft';
import { reducedMotion } from './presentation';
import { bindButtonFeedback, cartoonButton } from './cartoonChrome';
import { navRegister } from './menuNav';

/** Reward is already saved before this presentation starts. */
export class RewardReveal {
  private root: Phaser.GameObjects.Container;
  private timers: Phaser.Time.TimerEvent[] = [];
  private destroyed = false;
  private stopStinger: () => void;

  constructor(private scene: Phaser.Scene, item: ShopItem, close: () => void) {
    this.stopStinger = playStinger(scene, 'reward');
    const cfg = tune.view.menu.rewardReveal;
    const motion = !reducedMotion();
    this.root = scene.add.container().setDepth(600);
    const shade = scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x030711, 1).setAlpha(0)
      .setInteractive(); // Absorb taps until acknowledgement becomes available.
    this.root.add(shade);
    scene.tweens.add({targets:shade,alpha:cfg.darkenAlpha,duration:motion?cfg.fadeMs:0});

    const key = item.boxer
      ? (item.skinType === 'unique' ? artKey(scene,item.portraitKey!)
        : skinTexture(scene,item.boxer,item.kind==='skins'?item.id:'default',`portrait_${item.boxer}`))
      : null;
    if (key && scene.textures.exists(key)) {
      const portrait=scene.add.image(VIEW.cx,VIEW.bottom,key,'__BASE').setOrigin(.5,1).setFlipX(item.boxer==='tyke');
      const source=scene.textures.get(key).getSourceImage() as HTMLImageElement;
      const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
      const context=canvas.getContext('2d',{willReadFrequently:true})!;
      context.drawImage(source,0,0);
      const data=context.getImageData(0,0,canvas.width,canvas.height).data;
      let left=canvas.width,top=canvas.height,right=0,bottom=0;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        if(data[(y*canvas.width+x)*4+3]<16)continue;
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
      }
      if(right<=left||bottom<=top){left=0;top=0;right=canvas.width;bottom=canvas.height;}
      const scale=Math.min(VIEW.height*cfg.portraitHeight/(bottom-top),VIEW.width*.88/(right-left));
      portrait.x-=(item.boxer==='tyke'?-1:1)*((left+right)/2-canvas.width/2)*scale;
      portrait.y+=(canvas.height-bottom)*scale;
      this.root.add(portrait.setScale(scale*(motion?cfg.entryScale:1)).setAlpha(motion?0:1));
      scene.tweens.add({targets:portrait,scale,alpha:1,duration:motion?cfg.entryMs:0,ease:'Back.Out'});
    } else {
      // Draft rewards without final art must not impersonate a unique portrait.
      const chest=artKey(scene,item.kind==='skins'?'chest_skin_base':'chest_fighter_base');
      if(chest)this.root.add(scene.add.image(VIEW.cx,VIEW.cy-30,chest).setDisplaySize(200,180));
      this.label(VIEW.cx,VIEW.cy+80,t('reveal.portrait_art_pending'),18,'#b7c5e0');
    }

    const titleAt=cfg.entryMs+cfg.portraitHoldMs;
    this.timers.push(scene.time.delayedCall(titleAt,()=>{
      if(this.destroyed)return;
      const band=scene.add.rectangle(VIEW.cx,VIEW.bottom-70,VIEW.width,140,0x030711,.85);
      this.root.add(band);
      const title=this.label(VIEW.cx,VIEW.bottom-103,item.kind==='skins'?t('reveal.new_skin'):t('reveal.new_fighter'),14,'#ffd261');
      const name=this.label(VIEW.cx,VIEW.bottom-75,itemName(item),32,'#fff3db');
      name.setScale(Math.min(1,VIEW.width*.9/name.width));
      title.setAlpha(0);name.setAlpha(0);
      scene.tweens.add({targets:[title,name],alpha:1,duration:motion?cfg.nameFadeMs:0});
    }));
    this.timers.push(scene.time.delayedCall(titleAt+cfg.ackDelayMs,()=>{
      if(this.destroyed)return;
      const button=scene.add.container(VIEW.cx,VIEW.bottom-29);
      const g=scene.add.graphics();cartoonButton(g,-105,-19,210,38,0x28af70,8);button.add(g);
      const text=scene.add.text(0,0,t('reveal.awesome'),{fontFamily:'Arial Black, Arial',fontSize:18,fontStyle:'bold',color:'#fff6dc',shadow:{offsetX:0,offsetY:2,color:'#23415a',blur:1,fill:true},resolution:PIXEL_RATIO}).setOrigin(.5);button.add(text);
      const acknowledge=()=>{if(this.destroyed)return;this.destroy();close();};
      const hit=scene.add.rectangle(0,0,210,38,0,0).setDepth(610).setInteractive({useHandCursor:true});
      bindButtonFeedback(hit,state=>{
        g.clear();cartoonButton(g,-105,-19,210,38,0x28af70,8);
        g.setY(state==='pressed'?2:0).setAlpha(state==='disabled'?.45:1);
        text.setY(state==='pressed'?2:0);
        if(state==='hover')g.fillStyle(0xffffff,.1).fillRoundedRect(-105,-19,210,38,8);
      });
      hit.on('pointerup',()=>{if(hit.getData('buttonReleasedInside'))acknowledge();});
      button.add(hit);navRegister(scene,hit,acknowledge);
      this.root.add(button.setScale(motion?cfg.buttonEntryScale:1).setAlpha(motion?0:1));
      scene.tweens.add({targets:button,scale:1,alpha:1,duration:motion?cfg.nameFadeMs:0,ease:'Back.Out'});
    }));
    scene.events.once('shutdown',this.destroy,this);
  }

  private label(x:number,y:number,text:string,size:number,color:string):Phaser.GameObjects.Text {
    const label=this.scene.add.text(x,y,text,{fontFamily:'Arial Black, Arial',fontSize:size,fontStyle:'bold',color,
      stroke:'#061023',strokeThickness:3,padding:{left:12,right:20,top:6,bottom:6},resolution:PIXEL_RATIO}).setOrigin(.5);
    this.root.add(label);return label;
  }

  destroy():void {
    if(this.destroyed)return;
    this.destroyed=true;
    this.stopStinger();
    this.scene.events.off('shutdown',this.destroy,this);
    this.timers.forEach(t=>t.remove(false));
    this.scene.tweens.killTweensOf([this.root,...this.root.list,...this.root.list.flatMap(o=>o instanceof Phaser.GameObjects.Container?o.list:[])]);
    this.root.destroy(true);
  }
}
