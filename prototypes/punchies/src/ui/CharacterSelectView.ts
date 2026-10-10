import Phaser from 'phaser';
import { t } from '../i18n';
import { skinTexture } from '../render/skins';
import { artKey } from '../render/art';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { CHARACTER_IDS, CHARACTER_INFO, type CharId } from '../sim/character';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';
import { cartoonPanel, cartoonButton, bindButtonFeedback } from './cartoonChrome';
interface PanelState {
 dummy?:boolean;id:CharId;label:string;hidden:boolean;locked:boolean;focused:boolean;cursor:boolean;available:boolean;selected:boolean;skin:string;skinName:string;skinIndex:number;skinCount:number;status:string;stats:[string,number][];
}
export interface SelectionState {training?:boolean;panels:PanelState[];step:number;steps:string[];action:string;level:string|null;hint:string;bestOf:number;formatEditable?:boolean;}
import { rosterSlots } from './rosterLayout';
export class CharacterSelectView {
 private root:Phaser.GameObjects.Container;
 private chrome:Phaser.GameObjects.Graphics;
 private content:Phaser.GameObjects.Container[]=[];
 private panelHits:Phaser.GameObjects.Rectangle[]=[];
 private panelKeys=['',''];
 private cards:Phaser.GameObjects.Graphics[]=[];
 private locks:Phaser.GameObjects.Image[][]=[];
 private progress:Phaser.GameObjects.Text[]=[];
 private action:Phaser.GameObjects.Text;
 private format:Phaser.GameObjects.Text;
 private formatHint:Phaser.GameObjects.Text;
 private level:Phaser.GameObjects.Text;
 private levelButtons:Phaser.GameObjects.Text[];
 private hint:Phaser.GameObjects.Text;
 private previous='';
 private bounds=new Map<string,{left:number;top:number;right:number;bottom:number}>();
 constructor(private scene:Phaser.Scene,private callbacks:{skin(s:number,d:number):void;card(i:number):void;panel(i:number):void;action():void;back():void;level(d:number):void;format():void;}){
  const scale=Math.min(VIEW.width/844,VIEW.height/390);
  this.root=scene.add.container(VIEW.cx-422*scale,VIEW.cy-195*scale).setScale(scale);
  this.chrome=this.graphics(this.root);
  this.text(this.root,422,27,t('charselect.choose_your_boxer'),31).setStroke('#071024',5);
  this.button(45,29,80,30,t('charselect.back'),callbacks.back);
  this.format=this.button(80,75,136,27,t('charselect.best_of_3'),callbacks.format,false,0x8b57c9);
  this.formatHint=this.text(this.root,80,97,'',11,'#dbe9fa').setWordWrapWidth(155);
  [290,422,554].forEach((x,i)=>{this.progress.push(this.text(this.root,x,76,'',11));if(i<2)this.text(this.root,x+66,76,'›',20,'#a8bad5');});
  for(let s=0;s<2;s++){
   const hit=scene.add.rectangle(s===0?111:733,237,214,224,0,0).setInteractive({useHandCursor:true});
   hit.on('pointerdown',()=>callbacks.panel(s));this.root.add(hit);this.panelHits.push(hit);
   const c=scene.add.container();this.root.add(c);this.content.push(c);
  }
  rosterSlots().forEach((pos,i)=>{
   const card=scene.add.container(pos.x,pos.y);this.root.add(card);const frame=this.graphics(card);this.cards.push(frame);
   this.locks.push([0,1].map(side=>{const lock=scene.add.image(side===0?-18:18,-13,artKey(scene,'locked_icon')??'__DEFAULT').setDisplaySize(13,15).setVisible(false);card.add(lock);return lock;}));
   const id=CHARACTER_IDS[i];
   if(id){const key=artKey(scene,'portrait_'+id);if(key){
    const texture=scene.textures.get(key),source=texture.getSourceImage(),name='roster-grid';
    if(!texture.has(name)){const initial=texture.firstFrame;texture.add(name,0,0,Math.round(source.height*.12),source.width,Math.round(source.height*.65));texture.firstFrame=initial;}
    card.add(scene.add.image(0,-5,key,name).setDisplaySize(43,27).setFlipX(id==='tyke'));
   }
   this.text(card,0,13,id.toUpperCase(),7);
   const hit=scene.add.rectangle(0,0,51,34,0,0).setInteractive({useHandCursor:true});hit.on('pointerdown',()=>callbacks.card(i));card.add(hit);
   hit.on('pointerover',()=>card.setScale(1.06)).on('pointerout',()=>card.setScale(1)).on('pointerup',()=>card.setScale(1));
   }else{
    // Neutral black bust: intentionally reveals no future character artwork.
    const silhouette=this.graphics(card);silhouette.fillStyle(0x02050b).fillCircle(0,-8,6).fillEllipse(0,7,25,17).fillCircle(-14,4,4).fillCircle(14,4,4);
   }
  });
  this.action=this.button(422,366,238,36,t('common.confirm_boxer'),callbacks.action,true);
  this.level=this.button(744,75,105,27,'',()=>callbacks.level(1));
  this.levelButtons=[this.level,this.button(672,75,27,27,'‹',()=>callbacks.level(-1)),this.button(816,75,27,27,'›',()=>callbacks.level(1))];
  this.hint=this.text(this.root,422,334,'',11,'#bbcce3').setWordWrapWidth(408);
 }
 private graphics(parent:Phaser.GameObjects.Container):Phaser.GameObjects.Graphics{const g=this.scene.add.graphics();parent.add(g);return g;}
 private text(parent:Phaser.GameObjects.Container,x:number,y:number,value:string,size:number,color='#fff7e6'):Phaser.GameObjects.Text{
  const text=this.scene.add.text(x,y,value,{fontFamily:'Arial, sans-serif',fontSize:size+'px',fontStyle:'bold',color,stroke:'#0b1731',strokeThickness:1,resolution:PIXEL_RATIO}).setOrigin(.5);parent.add(text);return text;
 }
 private button(x:number,y:number,w:number,h:number,label:string,tap:()=>void,primary=false,tint=0x397dc2):Phaser.GameObjects.Text{
  const g=this.graphics(this.root),color=primary?0xf3bc35:tint;
  const hit=this.scene.add.rectangle(x,y,w,h,0,0).setInteractive({useHandCursor:true});this.root.add(hit);
  const text=this.text(this.root,x,y,label,primary?17:12).setStroke('#23415a',0).setShadow(0,2,'#23415a',1,true,true);
  bindButtonFeedback(hit,state=>{g.clear();cartoonButton(g,x-w/2,y-h/2+(state==='pressed'?2:0),w,h,color,8);if(state==='hover')g.fillStyle(0xffffff,.12).fillRoundedRect(x-w/2,y-h/2,w,h,8);text.y=y+(state==='pressed'?2:0);});
  hit.on('pointerup',()=>{if(hit.getData('buttonReleasedInside'))tap();});text.setData('chrome',g).setData('hit',hit);return text;
 }
 render(state:SelectionState):void{
  const signature=JSON.stringify(state);if(signature===this.previous)return;this.previous=signature;
  const g=this.chrome;g.clear();g.lineStyle(5,0x167cff).lineBetween(260,51,422,51);g.lineStyle(5,0xef3545).lineBetween(422,51,586,51);
  this.progress.forEach((text,i)=>{const active=state.step===i,complete=i<state.step;g.lineStyle(active?3:1,active?0x5bd8ff:complete?0x6bcba5:0x526078).lineBetween(242+i*132,89,338+i*132,89);text.setText((complete?'✓':i+1)+'  '+state.steps[i]).setColor(active?'#77ddff':complete?'#9dddc3':'#9fb0ca');});
  this.format.setText(t('charselect.best_of',{n:state.bestOf}));this.setButtonVisible(this.format,!state.training);
  const editable=state.formatEditable!==false;
  (this.format.getData('hit') as Phaser.GameObjects.Rectangle).input!.enabled=!state.training&&editable;
  this.formatHint.setVisible(!state.training).setText(editable?t('charselect.format_hint'):t('charselect.host_sets_format'));
  // Dark central well gives future slots room without competing with the portraits.
  g.fillStyle(0x080d20,.78).fillRoundedRect(218,98,408,233,12);
  state.panels.forEach((p,s)=>{
   this.panelHits[s].input!.enabled=!p.dummy;
   const key=JSON.stringify([p.dummy,p.id,p.hidden,p.stats,p.skin,p.selected,p.skinIndex,p.skinCount,p.status]);
   if(key!==this.panelKeys[s]){const changed=this.panelKeys[s]!=='';this.panelKeys[s]=key;this.buildPanel(s,p);const c=this.content[s];this.scene.tweens.killTweensOf(c);c.setPosition(0,0).setAlpha(1);
    if(changed&&!reducedMotion()){
     const cfg=tune.view.menu;c.x=(s===0?-1:1)*cfg.characterSlideDistance;c.setAlpha(.25);
     this.scene.tweens.add({targets:c,x:0,alpha:1,duration:cfg.characterSlideMs,ease:cfg.characterSlideEase,onComplete:()=>{
      const flash=this.graphics(this.root);flash.fillStyle(s===0?0x5bd8ff:0xff788d,.4).fillRoundedRect(s===0?5:639,181,200,152,8);
      this.scene.tweens.add({targets:flash,alpha:0,duration:cfg.characterImpactMs,onComplete:()=>flash.destroy()});
      this.scene.tweens.add({targets:c,x:(s===0?1:-1)*cfg.characterImpactPixels,duration:cfg.characterImpactMs/3,yoyo:true,repeat:1,onComplete:()=>c.x=0});
     }});
    }
   }
  });
  this.cards.forEach((frame,i)=>{frame.clear();this.locks[i].forEach(lock=>lock.setVisible(false));const real=i<CHARACTER_IDS.length;cartoonPanel(frame,-25,-17,50,34,real?0x354665:0x161d2b,5);
   state.panels.forEach((p,side)=>{if(!real||p.dummy||p.hidden||!p.cursor||p.id!==CHARACTER_IDS[i])return;
    const color=side===0?0x65d9ff:0xff8593;frame.lineStyle(2,color).strokeRoundedRect(-26,-18,52,36,6);
    const x=side===0?-18:18;frame.fillStyle(color).fillCircle(x,-13,6);frame.lineStyle(1,0xffffff);
    if(!p.available){this.locks[i][side].setVisible(true);}else frame.beginPath().moveTo(x-3,-13).lineTo(x-1,-11).lineTo(x+3,-15).strokePath();
   });
  });
  this.action.setText(state.action).setScale(Math.min(1,218/this.action.width));this.level.setText(state.level??t('common.versus'));this.levelButtons.forEach(b=>this.setButtonVisible(b,state.level!==null));this.hint.setText(state.hint);
 }
 private setButtonVisible(text:Phaser.GameObjects.Text,show:boolean):void{text.setVisible(show);(text.getData('chrome')as Phaser.GameObjects.Graphics).setVisible(show);const hit=text.getData('hit')as Phaser.GameObjects.Rectangle;hit.setVisible(show);hit.input!.enabled=show;}
 private buildPanel(s:number,p:PanelState):void{
  const parent=this.content[s];parent.removeAll(true);const x=s===0?6:640,centre=x+99;
  const panel=this.graphics(parent);panel.fillStyle(0x081022,.88).fillRoundedRect(x,103,198,77,7);
  panel.fillStyle(s===0?0x173b65:0x4e233c,.7).fillRoundedRect(x,181,198,155,8);
  if(p.hidden&&!p.dummy){this.text(parent,centre,251,p.label,17);this.text(parent,centre,276,p.status,9,'#aebbd0');return;}
  const texture=p.dummy?artKey(this.scene,'portrait_training_dummy'):skinTexture(this.scene,p.id,p.skin,'portrait_'+p.id);
  if(texture&&this.scene.textures.exists(texture)){
   const image=this.scene.add.image(centre,315,texture).setOrigin(.5,1);let b=this.bounds.get(texture);
   if(!b){const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(this.scene.textures.get(texture).getSourceImage()as HTMLImageElement,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;b={left:image.width,top:image.height,right:0,bottom:0};for(let y=0;y<canvas.height;y++)for(let px=0;px<canvas.width;px++)if(pixels[(y*canvas.width+px)*4+3]>=16){b.left=Math.min(b.left,px);b.top=Math.min(b.top,y);b.right=Math.max(b.right,px+1);b.bottom=Math.max(b.bottom,y+1);}if(b.right<=b.left)b={left:0,top:0,right:image.width,bottom:image.height};this.bounds.set(texture,b);}
   const visibleHeight=p.dummy?130:({bruno:134,marco:125,mia:115,tee:115,tyke:134,dragon:125,longan:125,captain:125}[p.id]);
   const scale=Math.min(visibleHeight/(b.bottom-b.top),198/(b.right-b.left));const flip=(s===1)!==(!p.dummy&&p.id==='tyke');image.setScale(scale).setFlipX(flip);image.x-=(flip?-1:1)*((b.left+b.right)/2-image.width/2)*scale;image.y+=(image.height-b.bottom)*scale;parent.add(image);
  }
  const title=p.dummy?t('common.dummy'):CHARACTER_INFO[p.id].name.toUpperCase();const text=this.text(parent,centre,321,title,16);if(text.width>186)text.setScale(186/text.width);
  this.text(parent,centre,338,p.dummy?t('training.practice_target'):t('char.'+p.id+'.nick')+' · '+p.label,9,s===0?'#8ddaff':'#ff9eae');
  const bars=this.graphics(parent),colors=[0xf451b8,0x5ce38b,0x37d4ee,0xffc449,0xb583f5];if(!p.dummy)p.stats.forEach(([label,value],i)=>{const y=108+i*13;this.text(parent,x+5,y+5,label,10).setOrigin(0,.5);bars.fillStyle(0x050a18).fillRoundedRect(x+89,y,102,10,3);const width=Math.max(0,Math.min(1,value*.8))*98;if(width>0){bars.fillStyle(colors[i]).fillRoundedRect(x+91,y+1,width,8,Math.min(3,width/2));bars.fillStyle(0xffffff,.25).fillRoundedRect(x+92,y+2,Math.max(0,width-2),2,1);}bars.lineStyle(1,0x8ba0c8).strokeRoundedRect(x+89,y,102,10,3);});
  if(p.selected&&p.available&&!p.dummy){this.text(parent,centre,356,p.skinName+' '+p.skinIndex+'/'+p.skinCount,8,'#fff1a8');[-1,1].forEach(d=>{const a=this.text(parent,centre+d*89,356,d<0?'‹':'›',19);a.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.callbacks.skin(s,d));});}
 }
}
