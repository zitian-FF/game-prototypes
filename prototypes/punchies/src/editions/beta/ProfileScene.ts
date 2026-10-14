import Phaser from 'phaser';
import {t} from '../../i18n';
import {betaView} from '../../progress/beta';
import {getAlias,setAlias,aliasEditable,getProfileAvatar,setProfileAvatar,type ProfileAvatar} from '../../progress/profile';
import aliasCfg from '../../progress/alias.json';
import {backdrop,whenGroupsReady} from '../../render/art';
import {applyCameraPixelRatio,VIEW} from '../../render/pixelRatio';
import {titleButton} from '../../ui/titleButton';
import {getNav} from '../../ui/menuNav';
import {startScreen} from '../../ui/presentation';
import {avatarImage} from './defaultAvatar';
import {charName,isCharId} from '../../sim/character';
import {onRatingState,loadRating} from '../../net/rating';
import {ratingLabel} from '../../ui/ratingPresentation';
import {addVersionStamp} from '../../version/versionStamp';
import {profileText} from './text';

export class ProfileScene extends Phaser.Scene {
 constructor(){super('Profile');}
 create():void {
  applyCameraPixelRatio(this);backdrop(this,0,'gym_background');
  this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071126,.88).setDepth(120);addVersionStamp(this);
  titleButton(this,VIEW.left+70,VIEW.top+29,112,38,t('common.back'),()=>startScreen(this,'Menu'),false,130,'default','back');
  profileText(this,VIEW.cx,VIEW.top+30,t('profile.heading'),26,VIEW.width-290);
  const v=betaView(),width=Math.min(760,VIEW.width-40),left=width*.40,gap=20,right=width-left-gap,x=VIEW.cx-width/2,y=VIEW.top+76,height=Math.min(290,VIEW.height-96),lx=x+left/2,rx=x+left+gap;
  this.add.graphics().setDepth(130).fillStyle(0x234c78,.95).fillRoundedRect(x,y,left,height,16);
  this.add.graphics().setDepth(130).fillStyle(0x112237,.94).fillRoundedRect(rx,y,right,height,16);
  const a={...getProfileAvatar(),skin:'default'};
  const hit=this.add.rectangle(lx,y+52,96,80,0x14243c).setDepth(131).setInteractive({useHandCursor:true});
  let image:Phaser.GameObjects.Image|null=null,alive=true;
  this.events.once('shutdown',()=>{alive=false;});
  const draw=()=>{if(!alive)return;image?.destroy();image=avatarImage(this,a,lx,y+52,90,74,132);};
  draw();whenGroupsReady(this,[a.fighter],draw);
  hit.on('pointerup',()=>this.pickAvatar());getNav(this).add(hit,()=>this.pickAvatar());
  profileText(this,lx,y+110,getAlias(),22,left-24);
  profileText(this,lx,y+151,t('profile.record',{matches:v.completed,wins:v.wins}),15,left-24);
  const rating=profileText(this,lx,y+193,'',14,left-24,'#ffe38b');
  const off=onRatingState(state=>{if(!rating.active)return;rating.setScale(1).setText(ratingLabel(state.status==='ready'?{phase:'available',rating:state.rating}:state.status==='loading'?{phase:'loading'}:{phase:'unavailable'},t));rating.setScale(Math.min(1,(left-24)/Math.max(1,rating.width),38/Math.max(1,rating.height)));});
  this.events.once('shutdown',off);void loadRating();
  if(aliasEditable())titleButton(this,lx,y+height-25,left-30,38,t('profile.edit_alias'),()=>this.editAlias(),false,130);
  else profileText(this,lx,y+height-25,t('profile.fixed_alias'),13,left-24);
  profileText(this,rx+right/2,y+25,t('beta.completed_matches',{matches:v.completed}),18,right-28,'#8feaff');
  v.milestones.forEach((m,i)=>{
   const cy=y+88+i*103;
   this.add.graphics().setDepth(131).fillStyle(m.unlocked?0x214b4a:0x1b304b).fillRoundedRect(rx+12,cy-36,right-24,88,12);
   profileText(this,rx+right/2,cy-16,charName(m.fighter),18,right-40,m.unlocked?'#9ce8bd':'#fff1d5');
   profileText(this,rx+right/2,cy+16,m.unlocked?t('profile.reached'):t('beta.unlock_requirement',{fighter:charName(m.fighter),matches:m.required}),13,right-40,m.unlocked?'#9ce8bd':'#c1d4ed');
  });
  getNav(this).modalBack(this.add.rectangle(VIEW.cx,VIEW.cy,1,1,0,0).setDepth(128),()=>startScreen(this,'Menu'));
 }
 private avatarOpen=false;
 private pickAvatar():void {
  if(this.avatarOpen)return;this.avatarOpen=true;
  const before=new Set(this.children.list),d=400,choices=betaView().fighters.filter(isCharId).map(fighter=>({fighter,skin:'default'})),nav=getNav(this);
  const shade=this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x050d20,.96).setDepth(d).setInteractive();
  let selected:ProfileAvatar={...getProfileAvatar(),skin:'default'},closed=false;
  const objects:Phaser.GameObjects.GameObject[]=[],requested=new Set<string>();
  const close=()=>{if(closed)return;closed=true;this.avatarOpen=false;this.events.off('shutdown',close);this.children.list.filter(o=>!before.has(o)).forEach(o=>o.destroy());};
  const status=profileText(this,VIEW.cx,VIEW.bottom-98,'',12,VIEW.width-60,'#ff9eaa',d+4);
  const render=()=>{
   if(closed)return;objects.splice(0).forEach(o=>o.destroy());const prior=new Set(this.children.list);
   profileText(this,VIEW.cx,VIEW.top+35,t('profile.avatar_heading'),24,VIEW.width-40,'#fff1d5',d+4);
   const width=Math.min(700,VIEW.width-50),cw=width/Math.max(1,choices.length);
   choices.forEach((a,i)=>{
    const cx=VIEW.cx-width/2+cw*(i+.5),cy=VIEW.cy;
    const hit=this.add.rectangle(cx,cy,cw-10,126,a.fighter===selected.fighter?0x2c6386:0x1b304b).setDepth(d+2).setInteractive({useHandCursor:true});
    const choose=()=>{selected=a;status.setText('');render();};hit.on('pointerup',choose);nav.add(hit,choose);
    avatarImage(this,a,cx,cy-13,cw-22,78,d+4);profileText(this,cx,cy+43,charName(a.fighter),13,cw-14,'#fff1d5',d+4);
    if(!this.textures.exists('punchies:portrait_'+a.fighter)&&!requested.has(a.fighter)){requested.add(a.fighter);whenGroupsReady(this,[a.fighter],()=>{if(!closed)this.time.delayedCall(0,render);});}
   });objects.push(...this.children.list.filter(o=>!prior.has(o)));
  };
  titleButton(this,VIEW.cx-110,VIEW.bottom-36,190,40,t('common.cancel'),close,false,d+2,'default','back');
  titleButton(this,VIEW.cx+110,VIEW.bottom-36,190,40,t('profile.use_avatar'),()=>{if(setProfileAvatar(selected)){close();this.scene.restart();}else status.setText(t('profile.avatar_save_error'));},false,d+2,'green');
  nav.modalBack(shade,close);this.events.once('shutdown',close);render();
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
