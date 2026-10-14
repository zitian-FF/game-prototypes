import Phaser from 'phaser';
import {TouchControls} from '../prototypes/punchies/src/ui/TouchControls';
import {IntentLayer} from '../prototypes/punchies/src/input/intents';
import {Hud} from '../prototypes/punchies/src/ui/Hud';
import {createSimState} from '../prototypes/punchies/src/sim/sim';
import {VIEW,PIXEL_RATIO,applyCameraPixelRatio} from '../prototypes/punchies/src/render/pixelRatio';
import {audioSettingsPanel} from '../prototypes/punchies/src/ui/audioSettingsPanel';
import {getNav} from '../prototypes/punchies/src/ui/menuNav';
import type {ControlModes} from '../prototypes/punchies/src/ui/controlMode';
class Review extends Phaser.Scene {
  private controls!:TouchControls;private hud!:Hud;private intents=new IntentLayer();
  private state=createSimState({fighters:[{},{}]});private held=new Set<string>();
  preload(){this.load.image('punchies:icon_jab','../prototypes/punchies/assets/loose/icon_jab.webp');this.load.image('punchies:icon_cross','../prototypes/punchies/assets/loose/icon_cross.webp');}
  create(){applyCameraPixelRatio(this);getNav(this).fightMode=true;
    const g=this.add.graphics();g.lineStyle(2,0x47618a,.4).strokeRect(VIEW.cx-185,VIEW.top+110,370,VIEW.height-170);
    this.add.text(VIEW.cx,VIEW.cy,'PRESENTATION REVIEW\nGameplay integration pending',{fontSize:'17px',align:'center',color:'#607ba2',resolution:PIXEL_RATIO}).setOrigin(.5);
    this.controls=new TouchControls(this,this.intents);this.hud=new Hud(this,['MARCO','MIA']);this.hud.resourceRow=[0,1];
    const modes=(pair:ControlModes)=>{this.controls.setMode(pair[0],(source,held)=>{if(held)this.held.add(source);else this.held.delete(source);});this.hud.setControlModes(pair);this.controls.draw(this.state.fighters[0]);this.hud.draw(this.state);};
    document.querySelector<HTMLButtonElement>('#modern')!.onclick=()=>modes(['modern','modern']);
    document.querySelector<HTMLButtonElement>('#classic')!.onclick=()=>modes(['classic','classic']);
    document.querySelector<HTMLButtonElement>('#mixed')!.onclick=()=>modes(['modern','classic']);
    document.querySelector<HTMLButtonElement>('#settings')!.onclick=()=>{this.controls.reset();this.controls.enabled=false;audioSettingsPanel(this,()=>{},()=>{},()=>{});};
    modes(['modern','modern']);
  }
  update(){if(!this.controls)return;this.controls.draw(this.state.fighters[0]);this.hud.draw(this.state);
    document.querySelector('#status')!.textContent=`Held Normal: ${this.held.size>0} · local presentation only`;
  }
}
const game=new Phaser.Game({type:Phaser.CANVAS,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO,parent:'app',backgroundColor:'#101f34',fps:{forceSetTimeOut:true,target:30},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Review});

game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
