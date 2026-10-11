import Phaser from 'phaser';
import {t} from '../i18n';
import {progressView,setTitle} from '../progress/progress';
import {getAlias,setAlias,aliasEditable} from '../progress/profile';
import cfg from '../progress/progress-config.json';
import aliasCfg from '../progress/alias.json';
import {titleName} from '../progress/titles';
import {backdrop} from '../render/art';
import {applyCameraPixelRatio,VIEW} from '../render/pixelRatio';
import {titleButton} from '../ui/titleButton';
import {getNav} from '../ui/menuNav';
import {startScreen} from '../ui/presentation';
import {inputGlyph} from '../ui/inputGlyph';
import {profileLayout,xpFraction} from '../ui/progressionModel';
import {equippedTitle,profileText,xpMeter,rewardName,rewardIcon} from '../ui/progressionChrome';
import {addVersionStamp} from '../version/versionStamp';

export class ProfileScene extends Phaser.Scene {
 constructor(){super('Profile');}
 create():void {
  applyCameraPixelRatio(this);backdrop(this,0,'gym_background');
  this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071126,.84).setDepth(120);
  addVersionStamp(this);
  titleButton(this,VIEW.left+70,VIEW.top+29,112,38,t('common.back'),()=>startScreen(this,'Menu'),false,130,'default','back');
  profileText(this,VIEW.cx,VIEW.top+30,t('profile.heading'),26,VIEW.width-290);
  const v=progressView(),p=profileLayout(VIEW.width,VIEW.height),x=VIEW.cx-p.w/2,y=VIEW.top+72;
  const leftX=x+p.left/2,rightX=x+p.left+p.gap;
  this.add.graphics().setDepth(130).fillStyle(0x234c78,.95).fillRoundedRect(x,y,p.left,p.h,16);
  profileText(this,leftX,y+27,getAlias(),23,p.left-22);
  equippedTitle(this,leftX,y+55,v.title,p.left-20);
  const levelText=profileText(this,leftX,y+87,t('profile.level',{level:v.level}),19,p.left-20,'#8feaff');
  if(levelText.height>24)levelText.setScale(Math.min(levelText.scaleX,24/levelText.height));
  xpMeter(this,leftX,y+111,p.left-30).draw(xpFraction(v));
  profileText(this,leftX,y+133,v.maxed?t('profile.max'):t('profile.xp',{xp:v.xp,total:v.xpToNext}),13,p.left-20);
  profileText(this,leftX,y+159,t('profile.daily_xp',{xp:v.xpToday,total:v.capToday}),12,p.left-16,v.capReached?'#ff9eaa':'#bfd5f2');
  profileText(this,leftX,y+186,t('profile.record',{matches:v.matches,wins:v.wins}),13,p.left-16);
  const bw=(p.left-34)/2;
  if(aliasEditable())titleButton(this,leftX-bw/2-5,y+p.h-28,bw,38,t('profile.edit_alias'),()=>this.editAlias(),false,130);
  else profileText(this,leftX-bw/2-5,y+p.h-28,t('profile.fixed_alias'),11,bw,'#bfd5f2');
  titleButton(this,leftX+bw/2+5,y+p.h-28,bw,38,t('profile.change_title'),()=>this.pickTitle(),false,130,'purple');
  profileText(this,rightX+p.right/2,y+14,v.maxed?t('profile.track_complete'):t('profile.next_rewards'),20,p.right,'#ffe38b');
  if(v.maxed)profileText(this,rightX+p.right/2,y+p.h/2,t('profile.max_message'),20,p.right-30);
  v.nextRewards.forEach((up,i)=>{
   const cx=rightX+(i%2)*(p.cardW+12)+p.cardW/2,cy=y+47+Math.floor(i/2)*(p.cardH+12);
   this.add.graphics().setDepth(130).fillStyle(i===0?0x34345c:0x172d49).fillRoundedRect(cx-p.cardW/2,cy,p.cardW,p.cardH,12);
   profileText(this,cx,cy+17,t('profile.level',{level:up.level}),13,p.cardW-12,'#a4dcff');
   rewardIcon(this,up.rewards[0],cx,cy+Math.min(65,p.cardH*.46),Math.min(92,p.cardH*.72),132);
   const label=profileText(this,cx,cy+p.cardH-24,up.rewards.map(rewardName).join('\n'),13,p.cardW-14);
   if(label.height>42)label.setScale(Math.min(label.scaleX,42/label.height));
  });
  inputGlyph(this,VIEW.cx-110,VIEW.bottom-22,0,132);inputGlyph(this,VIEW.cx+30,VIEW.bottom-22,1,132);
  profileText(this,VIEW.cx-52,VIEW.bottom-22,t('profile.select'),11,80,'#adc7e9');
  profileText(this,VIEW.cx+83,VIEW.bottom-22,t('common.back'),11,75,'#adc7e9');
  getNav(this).modalBack(this.add.rectangle(VIEW.cx,VIEW.cy,1,1,0,0).setDepth(128),()=>startScreen(this,'Menu'));
 }
 private pickTitle():void {
  const v=progressView(),before=new Set(this.children.list),d=400;
  const shade=this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x050d20,.96).setDepth(d).setInteractive();
  let page=0;
  const close=()=>{this.children.list.filter(o=>!before.has(o)).forEach(o=>o.destroy());};
  const permanent=new Set(this.children.list),pageItems:Phaser.GameObjects.GameObject[]=[];
  const render=()=>{
   pageItems.splice(0).forEach(o=>o.destroy());
   const prior=new Set(this.children.list);
   profileText(this,VIEW.cx,VIEW.top+29,t('profile.change_title'),23,VIEW.width-60,'#fff1d5',d+2);
   const start=page*4;
   cfg.titles.slice(start,start+4).forEach((entry,i)=>{
    const unlocked=v.unlockedTitles.includes(entry.id),cy=VIEW.top+79+i*53;
    profileText(this,VIEW.cx-95,cy,titleName(entry.id),17,230,unlocked?'#e9ceff':'#7d91ae',d+2);
    if(unlocked){const text=titleButton(this,VIEW.cx+155,cy,140,38,entry.id===v.title?t('profile.equipped'):t('profile.equip'),()=>{if(setTitle(entry.id)){close();this.scene.restart();}},false,d+1,'purple');if(entry.id===v.title)(text.getData('bg') as Phaser.GameObjects.Rectangle).disableInteractive();}
    else profileText(this,VIEW.cx+155,cy,t('profile.unlock_level',{level:entry.level}),13,140,'#8b9db8',d+2);
   });
   profileText(this,VIEW.cx,VIEW.bottom-75,t('profile.page',{n:page+1,total:Math.ceil(cfg.titles.length/4)}),12,180,'#adc7e9',d+2);
   const prev=titleButton(this,VIEW.cx-155,VIEW.bottom-40,90,38,'‹',()=>{page--;render();},false,d+1);
   const next=titleButton(this,VIEW.cx+155,VIEW.bottom-40,90,38,'›',()=>{page++;render();},false,d+1);
   if(page===0)(prev.getData('bg') as Phaser.GameObjects.Rectangle).disableInteractive();
   if((page+1)*4>=cfg.titles.length)(next.getData('bg') as Phaser.GameObjects.Rectangle).disableInteractive();
   titleButton(this,VIEW.cx,VIEW.bottom-40,140,38,t('common.back'),close,false,d+1,'default','back');
   pageItems.push(...this.children.list.filter(o=>!prior.has(o)&&!permanent.has(o)));
  };
  getNav(this).modalBack(shade,close);render();
 }
 private editAlias():void {
  if(!aliasEditable())return;
  const before=new Set(this.children.list),d=400,nav=getNav(this);
  const shade=this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x050d20,.97).setDepth(d).setInteractive();
  let value=getAlias(),closed=false;
  profileText(this,VIEW.cx,VIEW.top+28,t('profile.edit_alias'),24,VIEW.width-40,'#fff1d5',d+2);
  const name=profileText(this,VIEW.cx,VIEW.top+65,value,22,480,'#8feaff',d+2);
  const status=profileText(this,VIEW.cx,VIEW.top+98,t('profile.alias_hint',{min:aliasCfg.minLength,max:aliasCfg.maxLength}),12,VIEW.width-40,'#b9d0ee',d+2);
  const refresh=()=>{name.setText(value||' ');status.setText(t('profile.alias_hint',{min:aliasCfg.minLength,max:aliasCfg.maxLength}));};
  const type=(s:string)=>{if([...value+s].length<=aliasCfg.maxLength){value+=s;refresh();}};
  const del=()=>{value=[...value].slice(0,-1).join('');refresh();};
  const close=()=>{if(closed)return;closed=true;nav.textEntry=false;window.removeEventListener('keydown',key);window.removeEventListener('compositionend',compose);this.events.off('shutdown',close);this.children.list.filter(o=>!before.has(o)).forEach(o=>o.destroy());};
  const save=()=>{const result=setAlias(value);if(result.ok){close();this.scene.restart();}else{status.setText(({short:t('profile.alias_short'),long:t('profile.alias_long'),chars:t('profile.alias_chars'),reserved:t('profile.alias_reserved'),blocked:t('profile.alias_blocked')})[result.reason]);status.setColor('#ff9eaa');}};
  ['1234567890','QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].forEach((row,r)=>[...row].forEach((ch,c)=>titleButton(this,VIEW.cx+(c-(row.length-1)/2)*43,VIEW.top+133+r*40,38,35,ch,()=>type(ch),false,d+1)));
  titleButton(this,VIEW.cx-164,VIEW.bottom-72,100,35,t('profile.clear'),()=>{value='';refresh();},false,d+1,'red');
  titleButton(this,VIEW.cx,VIEW.bottom-72,210,35,t('profile.space'),()=>type(' '),false,d+1);
  titleButton(this,VIEW.cx+164,VIEW.bottom-72,100,35,t('menu.del'),del,false,d+1);
  titleButton(this,VIEW.cx-85,VIEW.bottom-28,150,38,t('common.cancel'),close,false,d+1,'default','back');
  titleButton(this,VIEW.cx+85,VIEW.bottom-28,150,38,t('profile.save'),save,false,d+1,'green');
  const key=(e:KeyboardEvent)=>{if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||!this.scene.isActive())return;if(e.key==='Escape')close();else if(e.key==='Enter')save();else if(e.key==='Backspace'){e.preventDefault();del();}else if(e.key.length===1){e.preventDefault();type(e.key);}};
  const compose=(e:CompositionEvent)=>type(e.data);
  nav.textEntry=true;getNav(this).modalBack(shade,close);
  window.addEventListener('keydown',key);window.addEventListener('compositionend',compose);this.events.once('shutdown',close);
 }
}
