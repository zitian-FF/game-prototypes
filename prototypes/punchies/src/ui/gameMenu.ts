import Phaser from 'phaser';
import { VIEW } from '../render/pixelRatio';
import { titleButton } from './titleButton';
import { devices } from '../input/devices';
export function addGameMenu(scene:Phaser.Scene,clear:()=>void):void {
  const open=()=>{
    if(scene.scene.isActive('GameMenu'))return;
    clear();devices.clear();
    scene.registry.set('gameMenu:'+scene.scene.key,true);
    scene.scene.launch('GameMenu',{source:scene.scene.key,multiplayer:['Match','LocalVs'].includes(scene.scene.key)});
  };
  titleButton(scene,VIEW.left+24,VIEW.top+24,34,34,'☰',open,false,220);
  scene.events.once('shutdown',()=>{scene.registry.remove('gameMenu:'+scene.scene.key);if(scene.scene.isActive('GameMenu'))scene.scene.stop('GameMenu');});
}
