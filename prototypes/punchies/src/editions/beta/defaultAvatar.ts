import type Phaser from 'phaser';
import type {ProfileAvatar} from '../../progress/profile';
import {rosterHeadFrame} from '../../render/portraitHeadshots';
/** Beta has only default portraits. Crop to the target ratio rather than stretching. */
export function avatarImage(scene:Phaser.Scene,a:ProfileAvatar,x:number,y:number,w:number,h:number,depth:number){
 const desired='punchies:portrait_'+a.fighter,key=scene.textures.exists(desired)?desired:'punchies:portrait_marco';
 if(!scene.textures.exists(key))return null;
 return scene.add.image(x,y,key,rosterHeadFrame(scene,key,key===desired?a.fighter:'marco',w/h)).setDisplaySize(w,h).setDepth(depth);
}
