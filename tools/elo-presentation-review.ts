import Phaser from 'phaser';
import {ArtBootScene,backdrop,fighterGroups,whenGroupsReady} from '../prototypes/punchies/src/render/art';
import {MenuScene} from '../prototypes/punchies/src/scenes/MenuScene';
import {LobbyScene} from '../prototypes/punchies/src/scenes/LobbyScene';
import {ScreenTransition} from '../prototypes/punchies/src/ui/presentation';
import {matchResult} from '../prototypes/punchies/src/ui/matchPresentation';
import {ratingLabel,ratingStatusText,type RatingPresentationState} from '../prototypes/punchies/src/ui/ratingPresentation';
import {t,setLanguage,setLocaleLoader} from '../prototypes/punchies/src/i18n';
import {installTextLocale} from '../prototypes/punchies/src/i18n/textStyle';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
const params=new URLSearchParams(location.search),view=params.get('view')??'lobby',lang=params.get('lang')??'en';
const locales=Object.fromEntries(await Promise.all(['zh','ar','es'].map(async code=>[code,(await import(`../prototypes/punchies/src/i18n/locales/${code}.json`)).default])));
setLocaleLoader(async code=>({...locales[code],...(lang==='long'?{'rating.result':'Your match is confirmed. Updated points: {points}, change: {delta}. Extended translated message for layout review.'}:{})}),{zh:1,ar:1,es:1});
await setLanguage((lang==='long'?'es':lang) as any);installTextLocale(Phaser);
class ResultReview extends Phaser.Scene {
 constructor(){super('ResultReview');}
 create(){applyCameraPixelRatio(this);backdrop(this);whenGroupsReady(this,fighterGroups(['marco']),()=>{
  matchResult(this,t('common.victory'),{rematch:()=>this.scene.start('Menu'),changeBoxer:()=>this.scene.start('Menu'),menu:()=>this.scene.start('Menu')},[2,1],{char:'marco'},'victory');
  const state:RatingPresentationState=view==='settled'?{phase:'settled',rating:1016,delta:16}:{phase:view as 'pending'|'expired'|'unavailable'};
  ratingStatusText(this,VIEW.cx,VIEW.top+24,Math.min(560,VIEW.width-80),155).set(ratingLabel(state,t));
 });}
}
class Boot extends ArtBootScene {create(){super.create();for(const scene of this.game.scene.getScenes(true))if(scene.scene.key!=='ArtBoot')scene.scene.stop();this.scene.launch(view==='lobby'?'Lobby':'ResultReview',view==='lobby'?{role:'host'}:undefined);}}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
for(const [key,scene] of [['Menu',MenuScene],['Lobby',LobbyScene],['ResultReview',ResultReview],['ScreenTransition',ScreenTransition]] as const)game.scene.add(key,scene,false);
game.scene.add('ArtBoot',Boot,true);game.events.once('ready',()=>{game.canvas.tabIndex=0;game.canvas.focus();game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});window.setInterval(()=>game.loop.resume(),500);
(document.querySelector('#view') as HTMLSelectElement).value=view;(document.querySelector('#lang') as HTMLSelectElement).value=lang;
document.querySelector('#show')!.addEventListener('click',()=>location.search=new URLSearchParams({view:(document.querySelector('#view') as HTMLSelectElement).value,lang:(document.querySelector('#lang') as HTMLSelectElement).value}).toString());
