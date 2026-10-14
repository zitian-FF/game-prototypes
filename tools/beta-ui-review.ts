import Phaser from 'phaser';
import {ProfileScene} from '../prototypes/punchies/src/editions/beta/ProfileScene';
import {MenuScene} from '../prototypes/punchies/src/scenes/MenuScene';
import {titleProfileEntry} from '../prototypes/punchies/src/editions/beta/titleProfileEntry';
import {VIEW,PIXEL_RATIO,applyCameraPixelRatio} from '../prototypes/punchies/src/render/pixelRatio';
class Preload extends Phaser.Scene {
 constructor(){super('Preload');}
 preload(){for(const id of ['marco','mia','bruno','roxy','nadia'])this.load.image('punchies:portrait_'+id,'../prototypes/punchies/assets/loose/portrait_'+id+'.webp');for(const id of ['gym_background','gym_props','logo','icon_jab','icon_cross'])this.load.image('punchies:'+id,'../prototypes/punchies/assets/loose/'+id+'.webp');}
 create(){this.scene.start(new URLSearchParams(location.search).get('screen')==='menu'?'Menu':'Profile');}
}
class Entry extends Phaser.Scene {constructor(){super('Entry');}create(){applyCameraPixelRatio(this);titleProfileEntry(this,()=>this.scene.start('Profile'));}}
const game=new Phaser.Game({type:Phaser.CANVAS,parent:'app',width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO,backgroundColor:'#071024',fps:{forceSetTimeOut:true,target:30},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[Preload,ProfileScene,MenuScene,Entry]});game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
