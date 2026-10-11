import { FightStage } from '../prototypes/punchies/src/scenes/FightStage';
import { createSimState } from '../prototypes/punchies/src/sim/sim';
import { MatchIntro } from '../prototypes/punchies/src/ui/fightPresentation';
import { peerProfile,sideProfiles } from '../prototypes/punchies/src/progress/profile';
import Phaser from 'phaser';
import {portal} from '../prototypes/punchies/src/portal/select';
import {KEYS} from '../prototypes/punchies/src/portal/keys';
import {ProfileScene} from '../prototypes/punchies/src/scenes/ProfileScene';
import {MenuScene} from '../prototypes/punchies/src/scenes/MenuScene';
import {ArtBootScene,backdrop} from '../prototypes/punchies/src/render/art';
import {ScreenTransition} from '../prototypes/punchies/src/ui/presentation';
import {installTextLocale} from '../prototypes/punchies/src/i18n/textStyle';
import {setLanguage,setLocaleLoader,setEnglishOverrides} from '../prototypes/punchies/src/i18n';
import en from '../prototypes/punchies/src/i18n/locales/en.json';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
import {applyMatch,newProgress,progressDay,xpForLevel,levelFromXp} from '../prototypes/punchies/src/progress/rules';
import cfg from '../prototypes/punchies/src/progress/progress-config.json';
import {matchResult} from '../prototypes/punchies/src/ui/matchPresentation';
const params=new URLSearchParams(location.search),state=params.get('state')??'fresh',lang=params.get('lang')??'en';
const memory=new Map<string,string>();portal.storage={async preload(){},getItem:key=>memory.get(key)??null,setItem:(key,value)=>{memory.set(key,value);},removeItem:key=>{memory.delete(key);}};
let progress=newProgress(progressDay());progress.totalXp=state==='mid'?1600:state==='max'?Array.from({length:49},(_,i)=>xpForLevel(cfg,i+1)).reduce((a,b)=>a+b,0):state==='levelup'?360:state==='capped'?180:state==='result'?180:0;progress.rewardedLevel=levelFromXp(cfg,progress.totalXp);progress.matches=state==='fresh'?0:34;progress.wins=state==='fresh'?0:19;progress.xpToday=state==='capped'?300:state==='max'?300:0;
memory.set(KEYS.progress,JSON.stringify(progress));memory.set(KEYS.profile,JSON.stringify({alias:'Test Boxer',generated:null}));
const actual=Object.fromEntries(await Promise.all(['ja','ko','zh','es','ar'].map(async code=>[code,(await import(`../prototypes/punchies/src/i18n/locales/${code}.json`)).default])));
setLocaleLoader(async(code)=>({...actual[code],...(lang==='long'?Object.fromEntries(Object.entries(en).filter(([key])=>key.startsWith('profile.')).map(([key,value])=>[key,value+' — extended translation for layout'])):{})}),{ja:1,ko:1,zh:1,es:1,ar:1});
await setLanguage(lang==='long'?'es':lang as any);installTextLocale(Phaser);
class Result extends Phaser.Scene{constructor(){super('Result');}create(){applyCameraPixelRatio(this);backdrop(this,0,'gym_background');const award=applyMatch(cfg,progress,{kind:'vsai',win:true},progressDay());this.registry.set('lastAward',{...award,grantedRewards:award.levelUps.flatMap(up=>up.rewards).filter(reward=>reward.kind!=='skin')});matchResult(this,'VICTORY',{rematch:()=>this.scene.restart(),changeBoxer:()=>this.scene.start('Profile'),menu:()=>this.scene.start('Menu')},[2,0],{char:'marco',title:'scrapper'});}}
class Combat extends Phaser.Scene {
 private stage!:FightStage;
 private sim!:ReturnType<typeof createSimState>;
 private intro:MatchIntro|null=null;
 constructor(){super('Combat');}
 create(){applyCameraPixelRatio(this);const profiles=sideProfiles(0,params.get('peer')==='yes'?peerProfile({alias:'挑戦者',title:'champion',level:40}):null);this.stage=new FightStage(this,['MARCO','MIA'],0,false,['default','default'],profiles);this.sim=createSimState({timed:true,showcase:false,fighters:[{char:'marco'},{char:'mia'}]});if(state==='intro')this.intro=new MatchIntro(this,['marco','mia'],['default','default'],profiles);}
 update(time:number){this.stage.draw(this.sim,time);this.intro?.draw(900);}
}
class Boot extends ArtBootScene{create(){super.create();for(const scene of this.game.scene.getScenes(true))if(scene.scene.key!=='ArtBoot')scene.scene.stop();this.scene.launch(['hud','intro'].includes(state)?'Combat':['result','levelup','capped'].includes(state)?'Result':'Profile');document.querySelector('#status')!.textContent='Ready · mock saves only';}}
const game=new Phaser.Game({type:Phaser.AUTO,fps:{forceSetTimeOut:true,target:60},parent:'app',backgroundColor:'#081426',input:{activePointers:4},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
game.scene.add('ScreenTransition',ScreenTransition,false);game.scene.add('Menu',MenuScene,false);game.scene.add('Profile',ProfileScene,false);game.scene.add('Result',Result,false);game.scene.add('Combat',Combat,false);game.scene.add('ArtBoot',Boot,true);

game.events.once('ready',()=>{game.canvas.tabIndex=0;game.canvas.focus();game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});

window.addEventListener('keydown',e=>{document.querySelector('#status')!.textContent='Key '+e.key+' · '+game.scene.getScenes(true).map(s=>s.scene.key).join(',');});

const pad={buttons:Array.from({length:16},()=>({pressed:false,touched:false,value:0})),axes:[0,0],connected:true,index:0,id:'Xbox mock',mapping:'standard',timestamp:0};
Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
for(const [label,index] of [['Pad ↓',13],['Pad →',15],['Pad A',0],['Pad B',1]] as const){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{pad.buttons[index].pressed=true;pad.buttons[index].value=1;game.events.once(Phaser.Core.Events.POST_STEP,()=>{pad.buttons[index].pressed=false;pad.buttons[index].value=0;});};document.querySelector('header')!.append(button);}

