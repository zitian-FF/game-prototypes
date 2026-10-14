import Phaser from 'phaser';
import {CharacterSelectView} from '../prototypes/punchies/src/ui/CharacterSelectView';
import {CHARACTER_IDS,type CharId} from '../prototypes/punchies/src/sim/character';
import {VIEW,PIXEL_RATIO,applyCameraPixelRatio} from '../prototypes/punchies/src/render/pixelRatio';
import {horizontalRosterPick,verticalRosterPick} from '../prototypes/punchies/src/ui/rosterLayout';
class Review extends Phaser.Scene {
  private view!:CharacterSelectView;private selected:CharId='marco';private confirmed=false;private lockedFixture=false;
  preload(){for(const id of CHARACTER_IDS)this.load.image('punchies:portrait_'+id,id==='kai'?'../prototypes/punchies/asset-patches/kai/portrait_kai.webp':'../prototypes/punchies/assets/loose/portrait_'+id+'.webp');for(const id of ['locked_icon','character_select_background'])this.load.image('punchies:'+id,'../prototypes/punchies/assets/loose/'+id+'.webp');}
  create(){applyCameraPixelRatio(this);this.add.image(VIEW.cx,VIEW.cy,'punchies:character_select_background').setDisplaySize(VIEW.width,VIEW.height).setAlpha(.55);
    const pick=(i:number)=>{this.selected=CHARACTER_IDS[i];this.confirmed=false;this.render();};
    this.view=new CharacterSelectView(this,{skin:()=>{},card:pick,panel:()=>{},action:()=>{this.confirmed=!this.confirmed;this.render();},back:()=>{},level:()=>{},format:()=>{}});
    this.input.keyboard?.on('keydown',(e:KeyboardEvent)=>{if(e.key==='l'){this.lockedFixture=!this.lockedFixture;this.render();return;}const i=CHARACTER_IDS.indexOf(this.selected);if(e.key==='ArrowRight')pick(horizontalRosterPick(i,1));if(e.key==='ArrowLeft')pick(horizontalRosterPick(i,-1));if(e.key==='ArrowDown')pick(verticalRosterPick(i,1));if(e.key==='ArrowUp')pick(verticalRosterPick(i,-1));});this.render();
  }
  private render(){const panel=(id:CharId,side:number)=>({id,label:side?'OPPONENT':'YOU',hidden:false,locked:side===0&&this.confirmed,focused:side===0,cursor:true,available:!this.lockedFixture||['marco','mia','bruno'].includes(id),selected:side===0&&this.confirmed,skin:'default',skinName:'DEFAULT',skinIndex:1,skinCount:1,status:'',stats:[['HP',.7,.7],['ENDURANCE',.7,.7],['SPEED',.7,.7],['POWER',.7,.7],['REACH',.7,.7]] as [string,number,number][],uppercut:{stars:3},rosterAvailable:this.lockedFixture?CHARACTER_IDS.slice(0,3):CHARACTER_IDS});
    this.view.render({panels:[panel(this.selected,0),panel('mia',1)],step:this.confirmed?1:0,steps:['YOUR BOXER','OPPONENT','FIGHT'],action:this.confirmed?'CONFIRM OPPONENT':'CONFIRM BOXER',level:'EASY',hint:'Choose a boxer',bestOf:3});
  }
}
const game=new Phaser.Game({type:Phaser.CANVAS,parent:'app',width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO,backgroundColor:'#071024',fps:{forceSetTimeOut:true,target:30},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Review});game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
