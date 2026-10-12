import type Phaser from 'phaser';
import type {ProfileAvatar} from '../progress/profile';
import {skinTexture} from '../render/skins';
import {rosterHeadFrame} from '../render/portraitHeadshots';
import {portraitBounds} from '../render/portraitBounds';
/** Missing textures fall back visually; ownership is never modified. */
export function avatarImage(scene:Phaser.Scene,a:ProfileAvatar,x:number,y:number,w:number,h:number,depth:number){
 const key=skinTexture(scene,a.fighter,a.skin,'portrait_'+a.fighter)??'punchies:portrait_marco';
 if(!scene.textures.exists(key))return null;
 return scene.add.image(x,y,key,rosterHeadFrame(scene,key,a.fighter)).setDisplaySize(w,h).setDepth(depth);
}
export function waistPortrait(scene:Phaser.Scene,a:ProfileAvatar,x:number,bottom:number,w:number,h:number,depth:number){
 const key=skinTexture(scene,a.fighter,a.skin,'portrait_'+a.fighter)??'punchies:portrait_marco';if(!scene.textures.exists(key))return null;
 const im=scene.add.image(x,bottom,key).setDepth(depth),b=portraitBounds(scene,key),flip=a.fighter==='tyke';
 return im.setFlipX(flip).setOrigin(flip?1-(b.left+b.right)/2/im.width:(b.left+b.right)/2/im.width,b.bottom/im.height).setScale(Math.min(w/(b.right-b.left),h/(b.bottom-b.top)));
}
