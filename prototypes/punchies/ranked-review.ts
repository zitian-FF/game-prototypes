import Phaser from 'phaser';
import {STAGING_BUILD,DEBUG_TOOLS_BUILD} from './src/buildFlags';
import {initLanguage} from './src/i18n/init';
import {t} from './src/i18n';
import {Hud} from './src/ui/Hud';
import {matchResult} from './src/ui/matchPresentation';
import type {RankedPlayers} from './src/ui/rankedIdentityCapsule';
import {createSimState} from './src/sim/sim';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from './src/render/pixelRatio';
declare const __PUNCHIES_STAGING_QA__:boolean;
if(!STAGING_BUILD||!DEBUG_TOOLS_BUILD||!__PUNCHIES_STAGING_QA__)throw Error('Ranked fixture requires all staging QA build gates');
document.body.dataset.rankedReview='PUNCHIES_RANKED_FICTIONAL_QA_ONLY';
const params=new URLSearchParams(location.search);
const screen=document.querySelector<HTMLSelectElement>('#screen')!,rating=document.querySelector<HTMLSelectElement>('#rating')!;
screen.value=params.get('screen')??'hud';rating.value=params.get('rating')??'unavailable';
function players():RankedPlayers {
 const profiles=[{alias:'tiantian',title:'contender',level:12},{alias:'北極星 NorthStar',title:'veteran',level:24}];
 return profiles.map((profile,i)=>{
  if(rating.value==='settled'||rating.value==='legacy'){const before=i?1428:1284,after=i?1406:1306,delta=after-before;
   return {profile,rating:{phase:'settled',rating:after,delta},...(rating.value==='settled'?{snapshot:{before,after,delta,matches:14}}:{})};
  }
  return {profile,rating:{phase:rating.value==='pending'?'pending':'unavailable'}};
 }) as RankedPlayers;
}
void initLanguage().then(()=>{
 class Review extends Phaser.Scene {
  private hud?:Hud;private sim=createSimState({timed:true,fighters:[{char:'marco'},{char:'bruno'}]});
  constructor(){super('RankedUiReview');}
  preload(){this.load.image('punchies:portrait_marco','./prototypes/punchies/assets/loose/portrait_marco.webp');this.load.image('punchies:gym_background','./prototypes/punchies/assets/loose/gym_background.webp');}
  create(){applyCameraPixelRatio(this);this.hud=undefined;
   if(this.textures.exists('punchies:gym_background'))this.add.image(VIEW.cx,VIEW.cy,'punchies:gym_background').setDisplaySize(VIEW.width,VIEW.height).setTint(0x424e68);
   const p=players();
   if(screen.value==='results'){
    matchResult(this,t('common.victory'),{rematch(){},changeBoxer(){},menu(){}},[2,1],{char:'marco',title:'contender'},'victory',{players:p,localIdx:0,nextMatch(){document.getElementById('status')!.textContent='Fixture action only; no matchmaking request.';}});
   }else{
    this.hud=new Hud(this,['MARCO','BRUNO'],[p[0].profile,p[1].profile],p);this.hud.resourceRow=[0,1];
    this.add.text(VIEW.cx,VIEW.cy,'Static HUD layout fixture',{color:'#fff4df',fontSize:14}).setOrigin(.5);
    this.add.rectangle(VIEW.left+32,VIEW.top+26,44,44,0x22658b).setDepth(220);this.add.text(VIEW.left+32,VIEW.top+26,'☰',{fontSize:24,color:'#ffffff'}).setOrigin(.5).setDepth(221);
   }
   document.getElementById('status')!.textContent=`Fictional component fixture · ${screen.value} · ${rating.value}`;
  }
  update(){this.hud?.draw(this.sim);}
 }
 const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',backgroundColor:'#081324',scene:Review,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
 for(const control of [screen,rating])control.addEventListener('change',()=>game.scene.getScene('RankedUiReview').scene.restart());
});
