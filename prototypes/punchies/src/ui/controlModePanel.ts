import type Phaser from 'phaser';
import {VIEW,PIXEL_RATIO} from '../render/pixelRatio';
import {t} from '../i18n';
import {loadControlModes,saveControlMode} from '../input/controlPreferences';
import {controlModeSelector} from './controlModeSelector';
import {getNav} from './menuNav';
import {titleButton} from './titleButton';

export function controlModePanel(scene:Phaser.Scene,back:()=>void):void {
  const depth=410,items:Phaser.GameObjects.GameObject[]=[],switches:ReturnType<typeof controlModeSelector>[]=[];
  const anchor=scene.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071020,.9).setDepth(depth).setInteractive();items.push(anchor);
  const width=Math.min(760,VIEW.width-24),column=(width-42)/2,offset=(column+14)/2;
  const panel=scene.add.graphics().setDepth(depth+1);items.push(panel);
  panel.fillStyle(0x020816,.9).fillRoundedRect(VIEW.cx-width/2-4,VIEW.cy-191,width+8,384,20);
  panel.fillStyle(0x10263d).fillRoundedRect(VIEW.cx-width/2,VIEW.cy-189,width,378,17);
  panel.lineStyle(1,0x527694,.6).strokeRoundedRect(VIEW.cx-width/2,VIEW.cy-189,width,378,17);
  panel.fillStyle(0x1b3b59).fillRoundedRect(VIEW.cx-width/2+5,VIEW.cy-184,width-10,54,13);
  // All material/card/marker surfaces remain passive: selectors and Back own input.
  const text=(x:number,y:number,value:string,size=16,maxWidth=column,maxHeight=48,color='#fff4df',align:'left'|'center'='center')=>{
    const label=scene.add.text(x,y,value,{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color,align,wordWrap:{width:maxWidth,useAdvancedWrap:true},padding:{left:2,right:2,top:1,bottom:1},resolution:PIXEL_RATIO}).setOrigin(align==='left'?0:.5,.5).setDepth(depth+2);
    label.setScale(Math.min(1,maxWidth/Math.max(1,label.width),maxHeight/Math.max(1,label.height)));items.push(label);return label;
  };
  text(VIEW.cx,VIEW.cy-163,t('controls.mode'),24,width-40,30);
  const modes=[...loadControlModes()];
  const cards:Phaser.GameObjects.Graphics[]=[],badges:Phaser.GameObjects.Text[][]=[];
  const cardTop=VIEW.cy-101,cardHeight=225;
  const redraw=()=>cards.forEach((g,i)=>{
    const mode=i===0?'modern':'classic',selected=modes.includes(mode),x=VIEW.cx+(i===0?-offset:offset)-column/2,accent=i===0?0x62dced:0xffcc68;
    g.clear().fillStyle(i===0?0x163d50:0x443927).fillRoundedRect(x,cardTop,column,cardHeight,12);
    g.fillStyle(i===0?0x22576a:0x675030).fillRoundedRect(x+1,cardTop+1,column-2,43,11);
    g.fillStyle(i===0?0x102e40:0x322d24).fillRect(x+1,cardTop+36,column-2,7);
    g.lineStyle(selected?2:1,selected?accent:0x506078,selected?.9:.45).strokeRoundedRect(x,cardTop,column,cardHeight,12);
    // Quiet painted hatches/material, no raised button bevel or pressed state.
    g.lineStyle(1,0xffffff,.07);for(let px=x+74;px<x+column-70;px+=29)g.lineBetween(px,cardTop+8,px+7,cardTop+4);
    const cx=x+29,cy=cardTop+22;
    g.fillStyle(0x081727).fillPoints([{x:cx-18,y:cy-11},{x:cx,y:cy-21},{x:cx+18,y:cy-11},{x:cx+18,y:cy+11},{x:cx,y:cy+21},{x:cx-18,y:cy+11}],true);
    g.lineStyle(1.5,accent,.9).strokePoints([{x:cx-18,y:cy-11},{x:cx,y:cy-21},{x:cx+18,y:cy-11},{x:cx+18,y:cy+11},{x:cx,y:cy+21},{x:cx-18,y:cy+11}],true,true);
    for(let side=0;side<2;side++){
      const bx=x+column-48+side*29;
      if(modes[side]===mode){g.fillStyle(0x07182a).fillRoundedRect(bx-12,cy-11,24,22,5);g.lineStyle(1,accent,.65).strokeRoundedRect(bx-12,cy-11,24,22,5);}
      badges[i][side].setVisible(modes[side]===mode);
    }
    g.lineStyle(1,accent,.18).lineBetween(x+14,cardTop+130,x+column-14,cardTop+130);
  });
  for(const [i,mode] of (['modern','classic'] as const).entries()){
    const x=VIEW.cx+(i===0?-offset:offset)-column/2,g=scene.add.graphics().setDepth(depth+1);cards.push(g);items.push(g);
    text(x+29,cardTop+22,i===0?'M':'C',24,32,28,i===0?'#8af0ff':'#ffe4a4');
    text(x+57,cardTop+22,t('controls.'+mode),19,column-130,28,'#fff3d7','left');
    badges.push([0,1].map(side=>text(x+column-48+side*29,cardTop+22,`P${side+1}`,11,24,20,i===0?'#8af0ff':'#ffe4a4')));
    const list=(copy:string,top:number,positive:boolean)=>{
      text(x+14,top,t(positive?'controls.advantages':'controls.tradeoffs'),11,column-28,16,positive?'#b6e8c4':'#ffc9a5','left');
      copy.split('\n').forEach((value,row)=>{
        const y=top+24+row*18,marker=scene.add.graphics().setDepth(depth+2);items.push(marker);
        marker.fillStyle(positive?0x174836:0x593023).fillCircle(x+22,y,7);
        marker.lineStyle(2,positive?0x99edb6:0xffbb93,1);
        if(positive)marker.beginPath().moveTo(x+18,y).lineTo(x+21,y+3).lineTo(x+26,y-3).strokePath();
        else marker.lineBetween(x+18,y,x+26,y);
        text(x+36,y,value,14,column-50,17,'#f1eada','left');
      });
    };
    list(mode==='modern'?t('controls.modern_pros'):t('controls.classic_pros'),cardTop+58,true);
    list(mode==='modern'?t('controls.modern_cons'):t('controls.classic_cons'),cardTop+145,false);
  }
  for(const side of [0,1] as const){const x=VIEW.cx+(side===0?-offset:offset);
    text(x-column/2+20,VIEW.cy-125,`P${side+1}`,15,38,30);
    switches.push(controlModeSelector(scene,x+24,VIEW.cy-125,column-56,modes[side],mode=>{modes[side]=mode;saveControlMode(side,mode);redraw();},depth+2));
  }
  redraw();
  text(VIEW.cx,VIEW.cy+144,t('controls.modern_note'),11,width-36,29,'#b8cce1');
  text(VIEW.cx-85,VIEW.cy+176,t('controls.next_match'),11,width-220,18,'#a8bcd3');
  let closed=false;const close=()=>{if(closed)return;closed=true;switches.forEach(s=>s.destroy());items.forEach(i=>i.destroy());back();};
  const button=titleButton(scene,VIEW.cx+width/2-78,VIEW.cy+174,128,28,t('common.back'),close,false,depth+2,'default','back');items.push(button,button.getData('bg'));
  getNav(scene).modalBack(anchor,close);
}
