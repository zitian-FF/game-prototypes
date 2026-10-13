import Phaser from 'phaser';
import {ArtBootScene,fighterGroups,whenGroupsReady} from '../prototypes/punchies/src/render/art';
import {FightStage} from '../prototypes/punchies/src/scenes/FightStage';
import {MatchIntro} from '../prototypes/punchies/src/ui/fightPresentation';
import {FighterView} from '../prototypes/punchies/src/render/FighterView';
import {createSimState} from '../prototypes/punchies/src/sim/sim';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
const params=new URLSearchParams(location.search),mode=params.get('mode')??'combat',off=params.has('off');
const samples:number[]=[],intervals:number[]=[],calls:number[]=[];let cpuStart=0,last=0,first=0,drawCalls=0,ready=false,finished=false;
class Review extends Phaser.Scene {
 stage!:FightStage;sim=createSimState({timed:false,fighters:[{char:'marco'},{char:'mia'}]});age=0;hitAt=0;intro?:MatchIntro;introAt=0;
 crowd:{view:FighterView;fighter:typeof this.sim.fighters[0]}[]=[];
 constructor(){super('Perf');}
 create(){this.scene.stop('Menu');this.scene.stop('FirstFight');applyCameraPixelRatio(this);
  whenGroupsReady(this,[...fighterGroups(['marco','mia']),'zombie'],()=>{
   this.sim.tick=1000;this.sim.fightStartTick=0;this.stage=new FightStage(this,['MARCO','MIA'],-1,false);
   const before=new Set(this.children.list);
   if(mode==='crowd')for(let i=0;i<12;i++){
    const f=structuredClone(this.sim.fighters[1]);f.x=350+i%4*38;f.y=175+Math.floor(i/4)*34;
    const view=new FighterView(this,0x9dbc61);view.visualId='zombie';this.crowd.push({view,fighter:f});
   }
   (this.stage as any).persp.take(this.children.list.filter(o=>!before.has(o)));
   if(off)(this.stage as any).fx.directionalSpark=()=>{};
   if(mode==='vs'){this.intro=new MatchIntro(this,['marco','mia']);this.introAt=this.age;}
   ready=true;
  });
 }
 update(_time:number,delta:number){if(!ready||finished)return;
  this.age+=delta;this.stage.draw(this.sim,this.time.now);
  if(mode==='vs'){
   this.intro?.draw(600+(this.age-this.introAt)%800);
  }else{
   this.crowd.forEach(({view,fighter},i)=>{fighter.x+=Math.sin(this.age/500+i)*.15;view.draw(fighter,this.time.now,false);});
   if(this.age>this.hitAt){this.hitAt=this.age+120;
    for(let i=0;i<(mode==='crowd'?4:1);i++)this.stage.handleEvents([{kind:'hit',attacker:0,x:470+i*12,y:200+i*6,punch:'cross',sweet:i%2===0,counter:false,row:'normal',damage:5,buffed:false}],this.sim);
   }
  }
 }
 report(){
  const quantile=(a:number[],p:number)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)]??0;
  const mean=(a:number[])=>a.reduce((a,b)=>a+b,0)/(a.length||1);
  const data={mode,off,frames:samples.length,seconds:(performance.now()-first)/1000,fps:samples.length/((performance.now()-first)/1000),
   cpuMean:mean(samples),cpuP95:quantile(samples,.95),intervalMedian:quantile(intervals,.5),intervalP95:quantile(intervals,.95),
   drawMean:mean(calls),drawPeak:Math.max(...calls),objects:this.children.list.length,world:(this.stage as any).persp.world?.list.length,
   tweens:this.tweens.getTweens().length,...(this.stage as any).fx.sparks?.diagnostics?.(),renderer:game.renderer.type,dpr:devicePixelRatio,canvas:[game.canvas.width,game.canvas.height]};
  document.querySelector('#status')!.textContent=JSON.stringify(data);finished=true;this.scene.pause();
 }
}
class Boot extends ArtBootScene {create(){super.create();this.scene.launch('Perf');}}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
const gl=(game.renderer as any).gl;if(gl)for(const name of ['drawArrays','drawElements']){const original=gl[name].bind(gl);gl[name]=(...args:any[])=>{drawCalls++;return original(...args);};}
game.events.on(Phaser.Core.Events.PRE_STEP,()=>{cpuStart=performance.now();drawCalls=0;});
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{
 if(!ready||finished)return;const now=performance.now();
 if(!first){first=now;last=now;return;}
 samples.push(now-cpuStart);intervals.push(now-last);calls.push(drawCalls);last=now;
 if(now-first>=10000)(game.scene.getScene('Perf') as Review).report();
});
game.scene.add('Perf',Review,false);game.scene.add('ArtBoot',Boot,true);
game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});

