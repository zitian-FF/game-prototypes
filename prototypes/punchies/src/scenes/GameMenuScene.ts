import { MenuScene } from './MenuScene';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { cartoonPanel } from '../ui/cartoonChrome';
import { titleButton } from '../ui/titleButton';
import { devices } from '../input/devices';
export class GameMenuScene extends MenuScene {
  private leaving=false;
  private source=''; private multiplayer=false;
  constructor(){super('GameMenu');}
  create(data:{message?:string;source?:string;multiplayer?:boolean}):void {
    this.leaving=false;this.scene.bringToTop();
    applyCameraPixelRatio(this);this.source=data.source??'Training';this.multiplayer=!!data.multiplayer;
    if(!this.multiplayer)this.scene.pause(this.source);
    this.scene.get(this.source).input.enabled=false;
    this.events.once('shutdown',()=>{
      this.registry.remove('gameMenu:'+this.source);
      const source=this.scene.get(this.source);source.input.enabled=true;devices.clear();
      if(!this.leaving && source.scene.isPaused())source.scene.resume();
    });
    this.drawMenu(false);
  }
  private close():void {this.scene.stop();}
  private drawMenu(confirm:boolean):void {
    this.children.removeAll(true);
    this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071020,.78).setInteractive();
    const g=this.add.graphics();cartoonPanel(g,VIEW.cx-190,VIEW.cy-123,380,246,0x28517d,15);
    this.add.text(VIEW.cx,VIEW.cy-89,confirm?'RETURN TO MAIN MENU?':this.multiplayer?'MATCH MENU':'PAUSED',
      {fontFamily:'Arial Black, Arial',fontSize:22,color:'#fff3da',stroke:'#081225',strokeThickness:3,resolution:PIXEL_RATIO}).setOrigin(.5);
    if(confirm){
      this.add.text(VIEW.cx,VIEW.cy-27,this.multiplayer?'The match keeps running.\nReturning forfeits this match.':'Your current round will end.',{fontFamily:'Arial',fontSize:15,color:'#fff3da',align:'center',resolution:PIXEL_RATIO}).setOrigin(.5);
      titleButton(this,VIEW.cx-86,VIEW.cy+62,155,38,'CANCEL',()=>this.drawMenu(false),false,302);
      titleButton(this,VIEW.cx+86,VIEW.cy+62,155,38,'RETURN',()=>{
        this.leaving=true;const source=this.scene.get(this.source);
        if(this.source==='Match'){source.events.emit('menuReturn');this.close();}
        else {this.close();source.scene.start('Menu');}
      },false,302,'red');
    }else{
      titleButton(this,VIEW.cx,VIEW.cy-28,280,38,'SETTINGS',()=>this.openInputPopup(),false,302);
      titleButton(this,VIEW.cx,VIEW.cy+22,280,38,'RETURN TO MAIN MENU',()=>this.drawMenu(true),false,302,'red');
      titleButton(this,VIEW.cx,VIEW.cy+78,180,32,'RESUME',()=>this.close(),false,302,'green');
    }
  }
}
