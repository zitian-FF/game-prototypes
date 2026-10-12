import Phaser from 'phaser';
import {t} from '../i18n';
import {progressView,progressionLadder,setTitle} from '../progress/progress';
import {getAlias,setAlias,aliasEditable,getProfileAvatar,setProfileAvatar,ownedAvatarChoices} from '../progress/profile';
import cfg from '../progress/progress-config.json';
import aliasCfg from '../progress/alias.json';
import {titleName} from '../progress/titles';
import {backdrop} from '../render/art';
import {applyCameraPixelRatio,VIEW} from '../render/pixelRatio';
import {titleButton} from '../ui/titleButton';
import {getNav} from '../ui/menuNav';
import {startScreen} from '../ui/presentation';
import {profileOverviewLayout,xpFraction} from '../ui/progressionModel';
import {equippedTitle,profileText,xpMeter,rewardName} from '../ui/progressionChrome';
import {avatarImage} from '../ui/profileAvatar';
import {charName} from '../sim/character';
import {skinName} from '../shop/roster';
import {whenGroupsReady} from '../render/art';
import {onRatingState,loadRating} from '../net/rating';
import {ratingLabel} from '../ui/ratingPresentation';
import {addVersionStamp} from '../version/versionStamp';

export class ProfileScene extends Phaser.Scene {
 constructor(){super('Profile');}
 create():void {
  applyCameraPixelRatio(this);backdrop(this,0,'gym_background');
  this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071126,.84).setDepth(120);
  addVersionStamp(this);
  titleButton(this,VIEW.left+70,VIEW.top+29,112,38,t('common.back'),()=>startScreen(this,'Menu'),false,130,'default','back');
  profileText(this,VIEW.cx,VIEW.top+30,t('profile.heading'),26,VIEW.width-290);
  const v=progressView(),p=profileOverviewLayout(VIEW.width,VIEW.height),x=VIEW.cx-p.w/2,y=VIEW.top+72;
  const leftX=x+p.left/2,rightX=x+p.left+p.gap;this.avatarOpen=false;
  this.add.graphics().setDepth(130).fillStyle(0x234c78,.95).fillRoundedRect(x,y,p.left,p.h,16);
  const avatar=getProfileAvatar();
  const avatarHit=this.add.rectangle(leftX,y+46,90,72,0x14243c).setDepth(130).setInteractive({useHandCursor:true});
  let image:Phaser.GameObjects.Image|null=null;
  const refreshAvatar=()=>{if(this.scene.isActive()){image?.destroy();image=avatarImage(this,avatar,leftX,y+46,86,66,132);}};
  refreshAvatar();whenGroupsReady(this,[avatar.fighter],refreshAvatar);
  avatarHit.on('pointerup',()=>this.pickAvatar());getNav(this).add(avatarHit,()=>this.pickAvatar());
  profileText(this,leftX,y+94,getAlias(),22,p.left-22);
  equippedTitle(this,leftX,y+119,v.title,p.left-20);
  const rating=profileText(this,leftX,y+142,'',13,p.left-20,'#ffe38b');
  const unsubscribe=onRatingState(state=>{if(!rating.active)return;rating.setText(ratingLabel(state.status==='ready'?{phase:'available',rating:state.rating}:state.status==='loading'?{phase:'loading'}:{phase:'unavailable'},t));rating.setScale(Math.min(1,(p.left-20)/Math.max(1,rating.width)));});
  this.events.once('shutdown',unsubscribe);void loadRating();
  profileText(this,leftX,y+166,t('profile.level',{level:v.level}),17,p.left-20,'#8feaff');
  xpMeter(this,leftX,y+185,p.left-30).draw(xpFraction(v));
  profileText(this,leftX,y+204,v.maxed?t('profile.max'):t('profile.xp',{xp:v.xp,total:v.xpToNext}),12,p.left-20);
  profileText(this,leftX,y+223,t('profile.daily_xp',{xp:v.xpToday,total:v.capToday}),11,p.left-16,v.capReached?'#ff9eaa':'#bfd5f2');
  profileText(this,leftX,y+241,t('profile.record',{matches:v.matches,wins:v.wins}),11,p.left-16);
  const bw=(p.left-34)/2;
  if(aliasEditable())titleButton(this,leftX-bw/2-5,y+p.h-23,bw,36,t('profile.edit_alias'),()=>this.editAlias(),false,130);
  else profileText(this,leftX-bw/2-5,y+p.h-23,t('profile.fixed_alias'),11,bw,'#bfd5f2');
  titleButton(this,leftX+bw/2+5,y+p.h-23,bw,36,t('profile.change_title'),()=>this.pickTitle(),false,130,'purple');
  profileText(this,rightX+p.right/2,y+15,t('profile.ladder'),20,p.right,'#ffe38b');
  const ladder=progressionLadder(),count=Math.max(3,Math.min(6,Math.floor((p.h-78)/43))),rowH=(p.h-78)/count;
  let offset=Math.max(0,Math.min(ladder.length-count,v.level-2));
  const rows:Phaser.GameObjects.GameObject[]=[];
  const render=()=>{
   rows.splice(0).forEach(o=>o.destroy());const before=new Set(this.children.list);
   ladder.slice(offset,offset+count).forEach((up,i)=>{
    const cy=y+39+i*rowH;
    this.add.graphics().setDepth(130).fillStyle(up.current?0x263c57:0x112237,.9).fillRoundedRect(rightX,cy,p.right,rowH-5,8);
    if(up.current)this.add.rectangle(rightX+3,cy+(rowH-5)/2,3,rowH-13,0x52d3ed).setDepth(132);
    profileText(this,rightX+43,cy+(rowH-5)/2,t('profile.level',{level:up.level}),11,76,'#8feaff');
    const label=up.rewards.length?up.rewards.map(rewardName).join(' · '):t('profile.keep_going');
    const text=profileText(this,rightX+p.right/2+5,cy+(rowH-5)/2,label,12,p.right-182);
    if(text.height>rowH-10)text.setScale(Math.min(text.scaleX,(rowH-10)/text.height));
    profileText(this,rightX+p.right-40,cy+(rowH-5)/2,up.current?t('profile.current'):up.reached?t('profile.reached'):t('profile.locked'),10,70,up.reached?'#a0dfc5':'#8196b1');
   });rows.push(...this.children.list.filter(o=>!before.has(o)));
  };
  const scroll=(dir:number)=>{offset=Math.max(0,Math.min(ladder.length-count,offset+dir*count));render();};
  render();
  titleButton(this,rightX+38,y+p.h-21,60,32,'↑',()=>scroll(-1),false,130);
  titleButton(this,rightX+p.right-38,y+p.h-21,60,32,'↓',()=>scroll(1),false,130);
  profileText(this,rightX+p.right/2,y+p.h-21,t('profile.track_hint'),11,p.right-154,'#adc7e9');
  let dragY:number|null=null;
  const dragStart=(pointer:Phaser.Input.Pointer)=>{dragY=!this.avatarOpen&&pointer.x>=rightX?pointer.y:null;};
  const dragEnd=(pointer:Phaser.Input.Pointer)=>{if(dragY!==null&&Math.abs(pointer.y-dragY)>30)scroll(pointer.y<dragY?1:-1);dragY=null;};
  this.input.on('pointerdown',dragStart);this.input.on('pointerup',dragEnd);
  this.events.once('shutdown',()=>{this.input.off('pointerdown',dragStart);this.input.off('pointerup',dragEnd);});
  const wheel=(_p:Phaser.Input.Pointer,_o:unknown,_dx:number,dy:number)=>{if(!this.avatarOpen&&_p.x>=rightX)scroll(dy>0?1:-1);};
  this.input.on('wheel',wheel);this.events.once('shutdown',()=>this.input.off('wheel',wheel));
  getNav(this).modalBack(this.add.rectangle(VIEW.cx,VIEW.cy,1,1,0,0).setDepth(128),()=>startScreen(this,'Menu'));
 }
 private avatarOpen=false;
 private pickAvatar():void {
  if(this.avatarOpen)return;this.avatarOpen=true;
  const before=new Set(this.children.list),d=400,choices=ownedAvatarChoices(),fighters=[...new Set(choices.map(a=>a.fighter))];
  const shade=this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x050d20,.96).setDepth(d).setInteractive();
  const requested=new Set<string>();
  let selected=getProfileAvatar(),page=Math.floor(fighters.indexOf(selected.fighter)/4),closed=false;
  const items:Phaser.GameObjects.GameObject[]=[];
  const close=()=>{if(closed)return;closed=true;this.avatarOpen=false;this.children.list.filter(o=>!before.has(o)).forEach(o=>o.destroy());};
  const status=profileText(this,VIEW.cx,VIEW.bottom-120,'',12,VIEW.width-60,'#ff9eaa',d+4);
  const render=()=>{
   items.splice(0).forEach(o=>o.destroy());const prior=new Set(this.children.list);
   profileText(this,VIEW.cx,VIEW.top+35,t('profile.avatar_heading'),24,VIEW.width-40,'#fff1d5',d+4);
   const width=Math.min(680,VIEW.width-50),cw=width/4;
   fighters.slice(page*4,page*4+4).forEach((fighter,i)=>{
    const cx=VIEW.cx-width/2+cw*(i+.5),cy=VIEW.top+130;
    const active=fighter===selected.fighter,a=active?selected:choices.find(a=>a.fighter===fighter)!;
    const hit=this.add.rectangle(cx,cy,cw-12,118,active?0x2c6386:0x1b304b).setDepth(d+2).setInteractive({useHandCursor:true});
    const choose=()=>{selected=a;status.setText('');render();};hit.on('pointerup',choose);getNav(this).add(hit,choose);
    avatarImage(this,a,cx,cy-13,cw-22,75,d+4);profileText(this,cx,cy+40,charName(fighter),13,cw-16,'#fff1d5',d+4);
    if(!this.textures.exists('punchies:portrait_'+fighter)&&!requested.has(fighter)){requested.add(fighter);whenGroupsReady(this,[fighter],()=>{if(!closed&&this.textures.exists('punchies:portrait_'+fighter))render();});}
   });
   const skins=choices.filter(a=>a.fighter===selected.fighter),index=Math.max(0,skins.findIndex(a=>a.skin===selected.skin));
   const cycle=(dir:number)=>{selected=skins[(index+dir+skins.length)%skins.length];status.setText('');render();};
   titleButton(this,VIEW.cx-210,VIEW.top+231,62,40,'‹',()=>cycle(-1),false,d+2);
   titleButton(this,VIEW.cx+210,VIEW.top+231,62,40,'›',()=>cycle(1),false,d+2);
   profileText(this,VIEW.cx,VIEW.top+231,skinName(selected.fighter,selected.skin)+' · '+t('profile.page',{n:index+1,total:skins.length}),15,330,'#8feaff',d+4);
   if(fighters.length>4){titleButton(this,VIEW.cx-95,VIEW.bottom-89,65,32,'↑',()=>{page=Math.max(0,page-1);render();},false,d+2);titleButton(this,VIEW.cx+95,VIEW.bottom-89,65,32,'↓',()=>{page=Math.min(Math.ceil(fighters.length/4)-1,page+1);render();},false,d+2);}
   items.push(...this.children.list.filter(o=>!prior.has(o)));
  };
  titleButton(this,VIEW.cx-110,VIEW.bottom-36,190,40,t('common.cancel'),close,false,d+2,'default','back');
  titleButton(this,VIEW.cx+110,VIEW.bottom-36,190,40,t('profile.use_avatar'),()=>{if(setProfileAvatar(selected)){close();this.scene.restart();}else status.setText(t('profile.avatar_save_error'));},false,d+2,'green');
  getNav(this).modalBack(shade,close);render();
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
