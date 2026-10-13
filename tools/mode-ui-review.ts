import Phaser from 'phaser';
import {portal} from '../prototypes/punchies/src/portal/select';
import {store as storage} from '../prototypes/punchies/src/portal/store';
import {SurvivalStore} from '../prototypes/punchies/src/survival/save';
import {NEUTRAL_INPUT} from '../prototypes/punchies/src/sim/types';
import {ProfileScene} from '../prototypes/punchies/src/scenes/ProfileScene';
import {MenuScene} from '../prototypes/punchies/src/scenes/MenuScene';
import {CharSelectScene} from '../prototypes/punchies/src/scenes/CharSelectScene';
import {SurvivalEntryScene} from '../prototypes/punchies/src/scenes/SurvivalEntryScene';
import {SurvivalScene} from '../prototypes/punchies/src/scenes/SurvivalScene';
import {GameMenuScene} from '../prototypes/punchies/src/scenes/GameMenuScene';
import {ArtBootScene,backdrop} from '../prototypes/punchies/src/render/art';
import {ScreenTransition,startScreen} from '../prototypes/punchies/src/ui/presentation';
import {t,setLanguage,setLocaleLoader} from '../prototypes/punchies/src/i18n';
import {installTextLocale} from '../prototypes/punchies/src/i18n/textStyle';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
import en from '../prototypes/punchies/src/i18n/locales/en.json';
const params=new URLSearchParams(location.search),screen=params.get('screen')??'entry',lang=params.get('lang')??'en';
const memory=new Map<string,string>();let failWrites=false;
portal.storage={async preload(){},getItem:key=>memory.get(key)??null,setItem:(key,value)=>{if(!failWrites)memory.set(key,value);},removeItem:key=>{memory.delete(key);}};
const store=new SurvivalStore(storage),run=store.begin({fighter:'marco',skin:'default',seed:14,runId:'mock-review-only'});
if(['intermission','resume','defeat','incompatible','save-error'].includes(screen)){
 run.wave=4;run.remainingTicks=1;run.waveKills=3;run.waveZombieKills=3;run.totalKills=3;run.player.health-=9;
 store.step(run,NEUTRAL_INPUT);
 if(screen==='incompatible'){run.balanceVersion='outdated-review-fixture';store.checkpoint(run);}
 if(screen==='defeat'){store.advance(run);run.player.health=0;store.step(run,NEUTRAL_INPUT);}
 if(screen==='save-error')failWrites=true;
}
if(['entry','menu','select','ranked','queue-error','searching'].includes(screen))memory.clear();
const locales=Object.fromEntries(await Promise.all(['zh','ja','ar','es'].map(async code=>[code,(await import(`../prototypes/punchies/src/i18n/locales/${code}.json`)).default])));
setLocaleLoader(async code=>({...locales[code],...(lang==='long'?Object.fromEntries(Object.entries(en).filter(([key])=>/^survival\./.test(key)).map(([key,value])=>[key,value+' — extended layout review string'])):{})}),{zh:1,ja:1,ar:1,es:1});
await setLanguage((lang==='long'?'es':lang) as any);installTextLocale(Phaser);
class Boot extends ArtBootScene {create(){super.create();for(const s of this.game.scene.getScenes(true))if(s.scene.key!=='ArtBoot')s.scene.stop();if(screen==='menu')this.scene.launch('Menu');else if(screen==='select')this.scene.launch('CharSelect',{mode:'survival'});else if(['active','intermission','defeat','save-error'].includes(screen))this.scene.launch('Survival',{run});else this.scene.launch('SurvivalEntry');document.querySelector('#status')!.textContent='Ready · mock saves';}}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',backgroundColor:'#081426',input:{activePointers:4},fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
for(const [key,scene] of [['ScreenTransition',ScreenTransition],['Menu',MenuScene],['Profile',ProfileScene],['CharSelect',CharSelectScene],['SurvivalEntry',SurvivalEntryScene],['Survival',SurvivalScene],['GameMenu',GameMenuScene]] as const)game.scene.add(key,scene,false);
game.scene.add('ArtBoot',Boot,true);game.events.once('ready',()=>{game.canvas.tabIndex=0;game.canvas.focus();game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});window.setInterval(()=>game.loop.resume(),500);
const pad={buttons:Array.from({length:16},()=>({pressed:false,touched:false,value:0})),axes:[0,0],connected:true,index:0,id:'Xbox mock',mapping:'standard',timestamp:0};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
for(const [label,index] of [['Pad ↓',13],['Pad A',0],['Pad B',1],['Pad Start',9]] as const){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{pad.buttons[index].pressed=true;pad.buttons[index].value=1;window.setTimeout(()=>{pad.buttons[index].pressed=false;pad.buttons[index].value=0;},120);};document.querySelector('header')!.append(button);}

const restore=document.createElement('button');restore.textContent='Restore saves';restore.onclick=()=>{failWrites=false;restore.textContent='Saves restored';};document.querySelector('header')!.append(restore);
