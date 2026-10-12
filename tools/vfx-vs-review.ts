import Phaser from 'phaser';
import {ArtBootScene,fighterGroups,whenGroupsReady} from '../prototypes/punchies/src/render/art';
import {FightStage} from '../prototypes/punchies/src/scenes/FightStage';
import {createSimState,step} from '../prototypes/punchies/src/sim/sim';
import {NEUTRAL_INPUT} from '../prototypes/punchies/src/sim/types';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
import {initLanguage} from '../prototypes/punchies/src/i18n/init';
await initLanguage();
const params=new URLSearchParams(location.search),capture=Number(params.get('at')??1000);let ready=false,captured=false,review:Review;
class Review extends Phaser.Scene {
 stage!:FightStage;sim=createSimState({timed:true,showcase:true,fighters:[{char:'marco'},{char:'mia'}]});acc=0;
 constructor(){super('VsStampReview');}
 create(){review=this;this.scene.stop('Menu');this.scene.stop('FirstFight');applyCameraPixelRatio(this);whenGroupsReady(this,fighterGroups(['marco','mia']),()=>{const ranked=params.has('ranked')?[{profile:{alias:'tiantian',title:'rookie',level:24},rating:{phase:'available' as const,rating:1284}},{profile:{alias:'北極星 NorthStar 長い選手名',title:'rookie',level:12},rating:{phase:'unavailable' as const}}] as import('../prototypes/punchies/src/ui/rankedIdentityCapsule').RankedPlayers:undefined;this.stage=new FightStage(this,['MARCO','MIA'],0,true,undefined,undefined,ranked);ready=true;});}
 update(_time:number,delta:number){if(!ready)return;this.acc+=delta;while(this.acc>=1000/60){this.acc-=1000/60;this.stage.handleEvents(step(this.sim,[NEUTRAL_INPUT,NEUTRAL_INPUT]),this.sim);}this.stage.draw(this.sim,this.time.now,false);
 document.getElementById('status')!.textContent=JSON.stringify({elapsed:this.sim.tick*1000/60,goTick:this.sim.fightStartTick,objects:this.children.list.length,world:this.stage.persp.world?.list.length,vsCached:this.textures.exists('punchies:vs-stamp-v1'),vsSize:[this.textures.get('punchies:vs-stamp-v1').getSourceImage().width,this.textures.get('punchies:vs-stamp-v1').getSourceImage().height],controlsLocked:this.sim.tick<this.sim.fightStartTick,fireAtlas:this.textures.exists('punchies:clash-fire-collision-v2')||this.textures.exists('punchies:clash-fire-frames-v1'),renderer:game.renderer.type});}
}
class Boot extends ArtBootScene{create(){super.create();this.scene.launch('VsStampReview');}}
const game=new Phaser.Game({type:params.has('canvas')?Phaser.CANVAS:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
game.scene.add('VsStampReview',Review,false);game.scene.add('ArtBoot',Boot,true);game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{if(ready&&!captured&&review.sim.tick*1000/60>=capture){captured=true;review.scene.pause();}});
