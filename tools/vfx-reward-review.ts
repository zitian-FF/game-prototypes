import Phaser from 'phaser';
import {ArtBootScene,fighterGroups,whenGroupsReady,artKey} from '../prototypes/punchies/src/render/art';
import {MatchIntro} from '../prototypes/punchies/src/ui/fightPresentation';
import {accentAtlas} from '../prototypes/punchies/src/ui/rewardAccents';
import {RewardReveal} from '../prototypes/punchies/src/ui/rewardReveal';
import {matchResult} from '../prototypes/punchies/src/ui/matchPresentation';
import {SHOP_ITEMS} from '../prototypes/punchies/src/shop/draft';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
import {initLanguage} from '../prototypes/punchies/src/i18n/init';
import {t} from '../prototypes/punchies/src/i18n';
import {tune} from '../prototypes/punchies/src/sim/tune';
await initLanguage();
let mode='clash',review:Review,ready=false;
class Review extends Phaser.Scene {
 age=0;intro?:MatchIntro;reveal?:RewardReveal;running=true;loaded=false;
 constructor(){super('VfxReview');}
 create(){review=this;this.scene.stop('Menu');this.scene.stop('FirstFight');applyCameraPixelRatio(this);
  whenGroupsReady(this,[...fighterGroups(['marco','mia','tee'])],()=>{this.loaded=true;this.show();ready=true;});
 }
 show(){const bg=artKey(this,'gym_background');if(bg)this.add.image(VIEW.cx,VIEW.cy,bg).setDisplaySize(VIEW.width,VIEW.height);
  this.age=0;
  if(mode==='atlas'){const k=accentAtlas(this);this.add.image(VIEW.cx-170,VIEW.cy,k,'burst');this.add.image(VIEW.cx+120,VIEW.cy,k,'slash');this.add.image(VIEW.cx,VIEW.cy+90,k,'spark');}
  else if(mode==='clash')this.intro=new MatchIntro(this,['marco','mia']);
  else if(mode==='epic'||mode==='legendary'){
   const item=mode==='epic'?SHOP_ITEMS.find(i=>i.kind==='skins'&&i.boxer==='marco'&&i.skinType==='palette')!:SHOP_ITEMS.find(i=>i.boxer==='tee'&&i.kind==='fighters')!;
   this.reveal=new RewardReveal(this,item,()=>{document.querySelector('#status')!.textContent='Acknowledged';});
  }else matchResult(this,t('common.victory'),{rematch:()=>{},changeBoxer:()=>{},menu:()=>{}},[2,1],{char:'marco',skin:'default'},'victory');
 }
 update(_time:number,delta:number){if(!this.loaded)return;this.age+=delta;this.intro?.draw(this.age);
  document.querySelector('#status')!.textContent=JSON.stringify({mode,age:Math.round(this.age),objects:this.children.list.length,tweens:this.tweens.getTweens().length,updateListeners:this.events.listenerCount('update'),accent:this.children.list.filter(o=>o.name==='punchies-victory-accent').map(o=>({visible:(o as any).visible,depth:o.depth,children:(o as any).list.map((v:any)=>({alpha:v.alpha,visible:v.visible,texture:v.texture.key,frame:v.frame.name,x:v.x,y:v.y,crop:v._crop}))})),renderer:game.renderer.type,atlasBytes:512*256*4+960*960*4});
 }
 preview(age:number){this.age=age;this.intro?.draw(age);this.scene.pause();this.running=false;document.querySelector('#status')!.textContent=JSON.stringify({mode,age,objects:this.children.list.length,preview:'Clash uses actual draw(age); reward/result frames freeze actual scene time'});}
}
class Boot extends ArtBootScene {create(){super.create();this.scene.launch('VfxReview');}}
const params=new URLSearchParams(location.search);mode=params.get('mode')??'clash';
const game=new Phaser.Game({type:params.has('canvas')?Phaser.CANVAS:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
game.scene.add('VfxReview',Review,false);game.scene.add('ArtBoot',Boot,true);
game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
for(const key of ['clash','epic','legendary','victory'])document.getElementById(key)!.addEventListener('click',()=>{if(!ready)return;mode=key;review.scene.restart();});
document.getElementById('freeze')!.addEventListener('click',()=>{if(ready)review.scene.pause();});
document.getElementById('run')!.addEventListener('click',()=>{if(ready)review.scene.resume();});
document.getElementById('frame')!.addEventListener('click',()=>{if(ready)review.preview(Number((document.getElementById('age') as HTMLInputElement).value));});
// Optional deterministic freeze at an actual scene-clock boundary, after render.
const capture=Number(params.get('at')??0);let captured=false;
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{if(capture&&ready&&review.age>=capture&&!captured){captured=true;review.scene.pause();}});
