import {rankedIdentityCapsule,rankedCapsuleBounds,type RankedPlayers} from './rankedIdentityCapsule';
import type { WireProfile } from '../progress/alias';
import { titleName } from '../progress/titles';
import Phaser from 'phaser';
import { t } from '../i18n';
import { tune } from '../sim/tune';
import { maxHealth, maxStamina, stunThreshold } from '../sim/character';
import type { Fighter, SimState } from '../sim/types';
import type { SeriesState } from '../sim/series';
import { remainingSeconds } from '../sim/sim';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { reducedMotion } from './presentation';
import {superMeterLayout} from './superMeterLayout';
import {SuperMeterLightning} from './superMeterLightning';
import {fighterSuper,superReady} from '../sim/super';


export interface SurvivalBossHud { key:string; name:string; health:number|null; maxHealth:number|null; }

export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private timer: Phaser.GameObjects.Text;
  private staminaRejectedAt = [-Infinity, -Infinity];
  private shownHealth = [-1, -1];
  private series: SeriesState = {bestOf:3,roundNumber:1,wins:[0,0]};
  shown: Set<string> | null = null;
  resourceRow: number[] = [];
  sidesShown = [true,true];
  timerText: string | null = null;
  survivalBoss:SurvivalBossHud|null=null;
  private bossName:Phaser.GameObjects.Text;
  private bossHealth:Phaser.GameObjects.Text;
  private bossKey='';
  private bossTrail=-1;
  private bossTimerMode=false;
  showRoundSockets = true;

  private capsules:ReturnType<typeof rankedIdentityCapsule>[]=[];
  private names: Phaser.GameObjects.Text[] = [];
  private titles: Phaser.GameObjects.Text[] = [];
  private upperReady: Phaser.GameObjects.Text[] = [];
  private superLightning:SuperMeterLightning[]=[];
  private meterLabels: {text:Phaser.GameObjects.Text;part:string}[]=[];

  constructor(private scene: Phaser.Scene, names: [string, string], profiles: [WireProfile|null,WireProfile|null]=[null,null],ranked?:RankedPlayers) {
    this.g=scene.add.graphics().setDepth(90);
    const text=(x:number,y:number,s:string,size:number,color:string)=>scene.add.text(x,y,s,{fontFamily:'Arial',fontSize:`${size}px`,fontStyle:'bold',color,stroke:'#061020',strokeThickness:2,resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(92);
    this.timer=text(VIEW.cx,VIEW.top+20,'99',29,'#fff1d1').setStroke('#030816',3).setFontFamily('Impact, Arial Black, sans-serif');
    this.bossName=text(VIEW.cx+VIEW.width*.08,VIEW.top+56,'',11,'#fff1d1').setOrigin(0,.5).setVisible(false);
    this.bossHealth=text(VIEW.cx+VIEW.width*.40-10,VIEW.top+56,'',10,'#dbe9fa').setOrigin(1,.5).setVisible(false);
    for(const [label,part,y] of [[t('common.hp'),'health',40],[t('hud.stm'),'stamina',56],[t('common.stun'),'stun',70]] as const){
      this.meterLabels.push({text:text(VIEW.cx,VIEW.top+y,label,9,'#f5eedf'),part});
    }
    for(let i=0;i<2;i++){
      if(ranked)this.capsules.push(rankedIdentityCapsule(scene,rankedCapsuleBounds(i),i,ranked[i]));
      const sign=i===0?-1:1;
      const name=text(VIEW.cx+sign*VIEW.width*.34,VIEW.top+56,names[i],11,'#fff1d1');
      name.setScale(Math.min(1,VIEW.width*.18/name.width));
      this.names.push(name);
      const title=text(VIEW.cx+sign*VIEW.width*.34,VIEW.top+83,profiles[i]?titleName(profiles[i]!.title):'',10,'#caa2ff');
      title.setScale(Math.min(1,VIEW.width*.18/Math.max(1,title.width)));
      this.titles.push(title);
      this.superLightning.push(new SuperMeterLightning(scene,superMeterLayout(VIEW,i,3).bounds));
      this.upperReady.push(text(VIEW.cx+sign*(VIEW.width*.20+38),VIEW.top+70,t('common.super'),10,'#fff3a1').setStroke('#8a4600',2).setShadow(0,0,'#ffce32',12,true,true).setVisible(false));
    }
  }
  setSeries(series:SeriesState):void{this.series=series;}
  rejectStamina(fighter:number):void{this.staminaRejectedAt[fighter]=this.scene.time.now;}
  draw(s:SimState):void{
    const g=this.g;g.clear();
    const show=(p:string)=>this.shown===null||this.shown.has(p);
    // One outlined clock and stepped meter silhouette, with shared central tabs.
    if(show('timer')){
      const hex=(scale:number,dy=0)=>[[-29,3],[29,3],[53,21],[29,40],[-29,40],[-53,21]].map(([x,y])=>({x:VIEW.cx+x*scale,y:VIEW.top+21+(y-21)*scale+dy}));
      g.fillStyle(0x020613).fillPoints(hex(1,3),true);g.lineStyle(7,0x020613).strokePoints(hex(1),true);
      g.fillStyle(0x14243b).fillPoints(hex(1),true);g.lineStyle(1.5,0x617994).strokePoints(hex(1),true);
      g.lineStyle(1,0xe4edfb,.3).lineBetween(VIEW.cx-25,VIEW.top+5,VIEW.cx+25,VIEW.top+5);
      g.fillStyle(0x1f324e).fillPoints([{x:VIEW.cx-22,y:VIEW.top+8},{x:VIEW.cx+22,y:VIEW.top+8},{x:VIEW.cx+35,y:VIEW.top+18},{x:VIEW.cx-35,y:VIEW.top+18}],true);
      for(let side=0;this.showRoundSockets&&side<2;side++)for(let i=0;i<(this.series.bestOf===3?2:1);i++){
        const sign=side===0?-1:1,x=VIEW.cx+sign*(35+i*9),y=VIEW.top+8+i*8;
        const p=[{x,y:y-4},{x:x+4,y},{x,y:y+4},{x:x-4,y}];
        g.lineStyle(4,0x020613).strokePoints(p,true);g.fillStyle(i<this.series.wins[side]?0xffd35b:0x18243a).fillPoints(p,true);
        g.lineStyle(1.5,0xd5e0ef).strokePoints(p,true);
      }
    }
    this.meterLabels.forEach(({text,part})=>text.setVisible(show(part)));
    this.names.forEach((t,i)=>t.setVisible(!this.capsules.length&&show('health')&&this.sidesShown[i]));
    this.capsules.forEach((c,i)=>c.setVisible(show('health')&&this.sidesShown[i]));
    this.titles.forEach((t,i)=>t.setVisible(!this.capsules.length&&show('health')&&this.sidesShown[i]));
    for(let i=0;i<2;i++){
      if(!this.sidesShown[i]){this.upperReady[i].setVisible(false);this.superLightning[i].setReady(false);continue;}
      const f=s.fighters[i],left=i===0;
      this.shownHealth[i]=this.shownHealth[i]<0?f.health:Math.max(f.health,this.shownHealth[i]-.4);
      if(show('health'))this.bar(left,34,14,.40,f.health/maxHealth(f),this.shownHealth[i]/maxHealth(f),0xef4db6,0,true);
      const elapsed=this.scene.time.now-this.staminaRejectedAt[i];
      const flash=elapsed<tune.view.staminaRejectFlashMs?.35+.6*Math.abs(Math.cos(elapsed*tune.view.staminaRejectFlashHz*Math.PI/1000)):0;
      if(show('stamina'))this.bar(left,50,12,(29+(VIEW.width*.34-29)*.8)/VIEW.width,f.stamina/maxStamina(f),0,f.exhausted?0xef3545:0x34bfe8,flash);
      const stun=Math.min(1,f.stun/stunThreshold(f));
      if(show('stun'))this.bar(left,64,12,.20,f.stunFromMeter?1:stun,0,f.stunFromMeter?0xffdf43:stun>.7?0xff9d35:0xb88b53);

      const showUpper=this.resourceRow.includes(i)&&show('uppercut');
      if(showUpper)this.drawResources(f,i);
      const ready=this.upperReady[i],layout=superMeterLayout(VIEW,i,fighterSuper(f).starCost);
      ready.setPosition(layout.cx,layout.cy);
      ready.setVisible(showUpper&&superReady(f));
      this.superLightning[i].setBounds(layout.bounds);this.superLightning[i].setReady(showUpper&&superReady(f));
      const pulse=reducedMotion()?1:(1+Math.sin(this.scene.time.now*2*Math.PI/Math.max(1,tune.view.fightPresentation.upperPulseMs)))/2;
      ready.setAlpha(.9+.1*pulse).setScale(Math.min(1,(layout.bounds.width-18)/Math.max(1,ready.width*1.2))*(1.08+.12*pulse));
    }
    const boss=this.survivalBoss;
    const bossShown=!!boss&&show('health');
    this.bossName.setVisible(bossShown);this.bossHealth.setVisible(bossShown);
    if(boss&&bossShown){
      const active=boss.health!==null&&boss.maxHealth!==null&&boss.maxHealth>0;
      if(this.bossKey!==boss.key){this.bossKey=boss.key;this.bossTrail=-1;}
      if(active){
        const hp=Math.max(0,boss.health!),max=boss.maxHealth!;
        this.bossTrail=this.bossTrail<0?hp:Math.max(hp,this.bossTrail-.4);
        this.bar(false,34,14,.40,hp/max,this.bossTrail/max,0xef4db6,0,true);
        this.bossHealth.setText(`${Math.ceil(hp)} / ${Math.ceil(max)} ${t('common.hp')}`);
      }else this.bossHealth.setText(boss.health===null?t('survival.boss_incoming'):'');
      this.bossHealth.setScale(1);this.bossHealth.setScale(Math.min(1,VIEW.width*.15/Math.max(1,this.bossHealth.width)));
      this.bossName.setText(t('survival.boss',{name:boss.name})).setScale(1);
      const available=Math.max(1,this.bossHealth.x-this.bossName.x-this.bossHealth.width*this.bossHealth.scaleX-12);
      this.bossName.setScale(Math.min(1,available/Math.max(1,this.bossName.width)));
    }
    if(!!boss!==this.bossTimerMode){this.bossTimerMode=!!boss;this.timer.setFontSize(boss?17:29).setScale(1);}
    this.timer.setText(boss?t('survival.boss_clock'):this.timerText??(s.timed?String(remainingSeconds(s)).padStart(2,'0'):'--')).setVisible(show('timer'));
    if(boss)this.timer.setScale(Math.min(1,78/Math.max(1,this.timer.width)));

  }
  private drawResources(f:Fighter,side:number):void{
    const g=this.g,layout=superMeterLayout(VIEW,side,fighterSuper(f).starCost);
    const ready=superReady(f);
    const starAlpha=ready?.25:1;
    for(let i=0;i<layout.count;i++){
      const {x,y}=layout.sockets[i];
      const star=(radius:number)=>Array.from({length:10},(_,k)=>{
        const angle=-Math.PI/2+k*Math.PI/5,r=k%2?radius*.46:radius;
        return {x:x+Math.cos(angle)*r,y:y+Math.sin(angle)*r};
      });
      g.fillStyle(0x071020).fillPoints(star(8),true);
      g.lineStyle(1.5,0x72839e,ready?.3:1).strokePoints(star(8),true);
      if(i<f.stars){
        g.fillStyle(0xffcf32,starAlpha).fillPoints(star(6.5),true);
        g.lineStyle(1,0xffed91,starAlpha).strokePoints(star(6.5),true);
      }
    }
  }
  private bar(left:boolean,yy:number,h:number,reach:number,frac:number,trail:number,color:number,flash=0,health=false):void{
    const g=this.g,sign=left?-1:1,y=VIEW.top+yy;
    const length=VIEW.width*reach-29;
    // Swept wing: curved clock-side root, parallel rails, sharp diagonal tip.
    const shape=(inset:number)=>{
      const top=inset,bottom=h-inset,tip=length-inset;
      const root=12+inset;
      const p=[{x:root,y:top},{x:tip,y:top},{x:tip-(bottom-top),y:bottom},{x:inset,y:bottom}];
      for(let i=1;i<7;i++){const t=i/7;
        p.push({x:inset+(root-inset)*t*t,y:bottom+(top-bottom)*t});}
      return p;
    };
    const project=(p:{x:number;y:number}[])=>p.map(v=>({x:VIEW.cx+sign*(29+v.x),y:y+v.y}));
    const frame=project(shape(0));
    g.fillStyle(0x030817).fillPoints(frame.map(v=>({x:v.x,y:v.y+3})),true);
    g.fillStyle(health?0x06091b:0x14243b).fillPoints(frame,true);g.lineStyle(health?6:5,0x030817).strokePoints(frame,true);
    g.lineStyle(1.5,health?0x665077:0x8194ae).strokePoints(frame,true);
    const clip=(p:{x:number;y:number}[],cut:number,inside:(x:number)=>boolean)=>{
      const result:{x:number;y:number}[]=[];
      for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],ai=inside(a.x),bi=inside(b.x);
        if(ai)result.push(a);
        if(ai!==bi){const t=(cut-a.x)/(b.x-a.x);result.push({x:cut,y:a.y+(b.y-a.y)*t});}}
      return result;
    };
    const well=shape(2),cut=2+Phaser.Math.Clamp(frac,0,1)*(length-4);
    const fill=(f:number,c:number,a:number)=>{
      if(f<=0)return;const p=clip(well,2+Phaser.Math.Clamp(f,0,1)*(length-4),x=>x<=2+Phaser.Math.Clamp(f,0,1)*(length-4));
      if(p.length<3)return;
      g.fillStyle(c,a).fillPoints(project(p),true);
      const upper=p.map(v=>({...v,y:Math.min(v.y,4)}));
      g.fillStyle(0xffffff,.3*a).fillPoints(project(upper),true);
    };
    if(flash>0){const empty=clip(well,cut,x=>x>=cut);if(empty.length>=3)g.fillStyle(0xff3b30,flash).fillPoints(project(empty),true);}
    if(trail>frac)fill(trail,0xfff1d1,.7);fill(frac,color,1);
    // Small angular slash repeats the reference's lightning-like detail at the root.
    const slash=[{x:18,y:h-3},{x:25,y:3},{x:48,y:3},{x:41,y:6},{x:29,y:6},{x:24,y:h-3}];
    if(!health)g.fillStyle(0x071122,.65).fillPoints(project(slash),true);
  }
}
